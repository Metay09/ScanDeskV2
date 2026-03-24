import { useState, useCallback, useEffect, useRef } from "react";
import { SYNC_QUEUE_DELAY_MS } from "../constants";
import { createQueueItem, addToQueue, removeFromQueue, getRetryableItems, markAsProcessing, markAsFailed } from "../services/syncQueue";
import { postgresApiInsert, postgresApiUpdate, postgresApiDelete, sheetsDelete, syncRecordToSheets } from "../services/integrations";
import { toDbPayload } from "../services/recordModel";

/**
 * PostgreSQL ve Google Sheets senkronizasyon kuyruğunu yönetir.
 * Her iki entegrasyon aynı anda aktif olabilir.
 *
 * @param {object}   integration    - { postgresApi: { active, serverUrl, apiKey }, gsheets: { active, scriptUrl } }
 * @param {function} toast          - Bildirim fonksiyonu
 * @param {function} onSyncUpdate   - `(id, success, error)` — kayıt sync durumunu günceller
 *
 * @returns {{ syncQueue, setSyncQueue, isSyncing, retryableCount, addToSyncQueue, processSyncQueue }}
 */
export function useSyncQueue(integration, toast, onSyncUpdate) {
  const [syncQueue, setSyncQueue] = useState([]);
  // Ref: processSyncQueue'nun stale closure sorunu yaşamadan her zaman
  // güncel kuyruğu okuyabilmesi için state'in aynasını tutuyoruz.
  const syncQueueRef = useRef([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // syncQueue state'i değiştiğinde ref'i güncelle
  useEffect(() => { syncQueueRef.current = syncQueue; }, [syncQueue]);

  const retryableCount = getRetryableItems(syncQueue).length;

  const addToSyncQueue = useCallback((action, recordId, payload, integrationType = "postgres_api") => {
    const item = createQueueItem(action, recordId, payload, integrationType);
    setSyncQueue(prev => addToQueue(prev, item));
  }, []);

  const processSyncQueue = useCallback(async (silent = false) => {
    const pgActive = integration.postgresApi?.active;
    const gsActive = integration.gsheets?.active;

    if (!pgActive && !gsActive) {
      if (!silent) toast("Entegrasyon aktif değil", "var(--err)");
      return { success: 0, failed: 0 };
    }

    if (isSyncing) {
      if (!silent) toast("Senkronizasyon zaten devam ediyor", "var(--acc)");
      return { success: 0, failed: 0 };
    }

    setIsSyncing(true);

    // syncQueueRef.current kullan: addToSyncQueue ile eklenen öğeler
    // henüz React state commit edilmeden çağrıldığında bile güncel listeyi görür.
    const retryable = getRetryableItems(syncQueueRef.current).filter(item => {
      const type = item.integrationType || "postgres_api";
      return (type === "postgres_api" && pgActive) || (type === "gsheets" && gsActive);
    });

    if (retryable.length === 0) {
      await new Promise(r => setTimeout(r, SYNC_QUEUE_DELAY_MS));
      setIsSyncing(false);
      if (!silent) toast("Bekleyen işlem yok", "var(--ok)");
      return { success: 0, failed: 0 };
    }
    let successCount = 0;
    let failedCount  = 0;
    let retriedCount = 0;

    for (const item of retryable) {
      try {
        const wasRetry = item.status === "failed";
        setSyncQueue(prev => markAsProcessing(prev, item.id));

        if (item.integrationType === "gsheets" || (!item.integrationType && gsActive && !pgActive)) {
          if (item.action === "create" || item.action === "update") {
            await syncRecordToSheets(integration.gsheets, item.payload.record ?? item.payload, item.payload.fields);
            onSyncUpdate(item.recordId, true, null);
          } else if (item.action === "delete") {
            await sheetsDelete(integration.gsheets, item.recordId);
          }
        } else {
          // postgres_api
          if (item.action === "create") {
            await postgresApiInsert(integration.postgresApi, toDbPayload(item.payload));
            onSyncUpdate(item.recordId, true, null);
          } else if (item.action === "update") {
            await postgresApiUpdate(integration.postgresApi, item.recordId, toDbPayload(item.payload));
            onSyncUpdate(item.recordId, true, null);
          } else if (item.action === "delete") {
            await postgresApiDelete(integration.postgresApi, item.recordId);
          }
        }

        setSyncQueue(prev => removeFromQueue(prev, item.id));
        successCount++;
        if (wasRetry) retriedCount++;
      } catch (err) {
        setSyncQueue(prev => markAsFailed(prev, item.id, err.message));
        if (item.action !== "delete") onSyncUpdate(item.recordId, false, err.message);
        failedCount++;
      }
    }

    setIsSyncing(false);

    if (!silent) {
      if (failedCount === 0 && retriedCount === 0) {
        toast(`${successCount} işlem senkronize edildi`, "var(--ok)");
      } else if (failedCount === 0 && retriedCount > 0) {
        toast(`${successCount} işlem senkronize edildi (${retriedCount} yeniden denendi)`, "var(--ok)");
      } else if (successCount > 0 && failedCount > 0) {
        toast(`${successCount} başarılı, ${failedCount} başarısız`, "var(--err)");
      } else {
        toast(`Tümü başarısız: ${failedCount} hata`, "var(--err)");
      }
    }

    return { success: successCount, failed: failedCount, retried: retriedCount };
  }, [integration, isSyncing, onSyncUpdate, toast]); // syncQueue bağımlılığı kaldırıldı — ref üzerinden okunuyor

  // processSyncQueue'nun en güncel halini ref'te tutuyoruz.
  // Auto-process effect'i re-render sonrası en güncel fonksiyonu çağırabilsin.
  const processSyncQueueRef = useRef(processSyncQueue);
  useEffect(() => { processSyncQueueRef.current = processSyncQueue; });

  // Kuyruğa yeni "pending" öğe eklendiğinde otomatik işle.
  // İnternet bağlantısı kesiliyken biriken items, bağlantı gelince de işlenir.
  useEffect(() => {
    const pending = syncQueue.filter(i => i.status === "pending");
    if (pending.length > 0 && !isSyncing) {
      // Küçük gecikme: React state commit'inin tamamlanmasını bekle
      const t = setTimeout(() => processSyncQueueRef.current(true), 50);
      return () => clearTimeout(t);
    }
  }, [syncQueue.length, isSyncing]);

  // İnternet bağlantısı geldiğinde bekleyenleri otomatik senkronize et
  useEffect(() => {
    const handleOnline = () => processSyncQueueRef.current(true);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return { syncQueue, setSyncQueue, isSyncing, retryableCount, addToSyncQueue, processSyncQueue };
}
