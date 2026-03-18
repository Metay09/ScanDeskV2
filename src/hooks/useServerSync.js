import { useEffect, useRef, useCallback } from "react";

/**
 * SSE tabanlı gerçek zamanlı senkronizasyon hook'u.
 *
 * - Sunucuya sürekli SSE bağlantısı kurar.
 * - users_updated    → onUsersUpdate() çağırır
 * - config_updated   → onConfigUpdate() çağırır
 * - tarama_*         → onTaramaEvent(type, data) çağırır
 * - Bağlantı kopunca 3 saniye sonra yeniden bağlanır.
 * - SSE hiç çalışmazsa (bazı Android cihazlarda) 30 saniyede bir polling yapar.
 * - SSE bağlantısı kurulunca polling durur.
 *
 * @param {object} integration  - { active, type, postgresApi: { serverUrl, apiKey } }
 * @param {function} onUsersUpdate  - sunucudan güncel kullanıcı listesini çek
 * @param {function} onConfigUpdate - sunucudan güncel config'i çek
 * @param {function} [onTaramaEvent] - (type: "added"|"updated"|"deleted", data: {id}) => void
 */
export function useServerSync({ integration, onUsersUpdate, onConfigUpdate, onTaramaEvent, onRefTableUpdate }) {
  const esRef         = useRef(null);
  const pollingRef    = useRef(null);
  const reconnectRef  = useRef(null);
  const sseWorkingRef = useRef(false);
  const activeRef     = useRef(false);

  // Callback'leri ref'te tut — bağlantı kapatılmadan güncel değere erişilsin
  const onUsersUpdateRef   = useRef(onUsersUpdate);
  const onConfigUpdateRef  = useRef(onConfigUpdate);
  const onTaramaEventRef   = useRef(onTaramaEvent);
  const onRefTableUpdateRef = useRef(onRefTableUpdate);
  useEffect(() => { onUsersUpdateRef.current  = onUsersUpdate;  }, [onUsersUpdate]);
  useEffect(() => { onConfigUpdateRef.current = onConfigUpdate; }, [onConfigUpdate]);
  useEffect(() => { onTaramaEventRef.current  = onTaramaEvent;  }, [onTaramaEvent]);
  useEffect(() => { onRefTableUpdateRef.current = onRefTableUpdate; }, [onRefTableUpdate]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      if (sseWorkingRef.current) { stopPolling(); return; }
      try { await onUsersUpdateRef.current?.(); } catch { /* sessiz */ }
      try { await onConfigUpdateRef.current?.(); } catch { /* sessiz */ }
    }, 30000);
  }, [stopPolling]);

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    if (esRef.current) return; // zaten bağlı

    const int = integration;
    if (!int?.postgresApi?.active) return;

    const { serverUrl, apiKey } = int.postgresApi;
    const base = serverUrl.replace(/\/$/, "");
    const url  = `${base}/api/events?key=${encodeURIComponent(apiKey)}`;

    let es;
    try { es = new EventSource(url); }
    catch { startPolling(); return; }

    esRef.current = es;

    es.addEventListener("connected", () => {
      sseWorkingRef.current = true;
      stopPolling();
    });

    es.addEventListener("users_updated", () => {
      onUsersUpdateRef.current?.().catch(() => {});
    });

    es.addEventListener("config_updated", () => {
      onConfigUpdateRef.current?.().catch(() => {});
    });

    es.addEventListener("ref_table_updated", () => {
      onRefTableUpdateRef.current?.().catch(() => {});
    });

    es.addEventListener("tarama_added", (e) => {
      try { onTaramaEventRef.current?.("added", JSON.parse(e.data)); } catch { /* */ }
    });

    es.addEventListener("tarama_updated", (e) => {
      try { onTaramaEventRef.current?.("updated", JSON.parse(e.data)); } catch { /* */ }
    });

    es.addEventListener("tarama_deleted", (e) => {
      try { onTaramaEventRef.current?.("deleted", JSON.parse(e.data)); } catch { /* */ }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (!sseWorkingRef.current) {
        // SSE hiç çalışmadı → polling başlat
        startPolling();
      }

      // 3 saniye sonra yeniden bağlan
      if (activeRef.current) {
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          connect();
        }, 3000);
      }
    };
  }, [integration, startPolling, stopPolling]);

  useEffect(() => {
    if (!integration?.postgresApi?.active) return;

    activeRef.current = true;
    connect();

    return () => {
      activeRef.current = false;
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      esRef.current?.close();
      esRef.current = null;
      stopPolling();
    };
  }, [integration?.postgresApi?.active, integration?.postgresApi?.serverUrl, integration?.postgresApi?.apiKey, connect, stopPolling]);
}
