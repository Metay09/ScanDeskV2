import { useState, useEffect, useRef, useCallback } from "react";
import { Ic, I } from "./Icon";
import { genId } from "../constants";
import { fmtDate, fmtTime, nowTs, playBeep, getCurrentShift, FIXED_SHIFTS, getCustomerList, getShiftDate, deriveShiftDate } from "../utils";
import { postgresApiInsert, sheetsInsert, syncRecordToSheets } from "../services/integrations";
import { toDbPayload } from "../services/recordModel";
import EditRecordModal from "./EditRecordModal";
import CustomerPicker from "./CustomerPicker";
import ShiftInheritModal from "./ShiftInheritModal";
import ShiftTakeoverPrompt from "./ShiftTakeoverPrompt";
import FieldInput from "./FieldInput";
import DetailFormModal from "./DetailFormModal";

export default function ScanPage({ fields, onSave, onEdit, onSyncUpdate, records, lastSaved, customers, isAdmin, user, integration, scanSettings, toast, shiftExpired = false, shiftTakeovers = {}, onShiftTakeover, addToSyncQueue }) {
  const customerList = getCustomerList(customers);
  const normalizeCustomer = (val) => val === "-Boş-" ? "" : val;
  const inputRef  = useRef(null);
  const focusTimer = useRef(null);
  const addDetailAfterScanRef = useRef(false);

  const [barcode, setBarcode]     = useState("");
  const [extras, setExtras]       = useState(() => {
    // Load sticky fields from localStorage
    try {
      const saved = localStorage.getItem("scandesk_sticky_fields");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [flash, setFlash]         = useState("ready");
  const [customer, setCustomer]   = useState(() => {
    // Load from localStorage, default to empty string
    try {
      const saved = localStorage.getItem("scandesk_default_customer") || "";
      return normalizeCustomer(saved);
    } catch {
      return "";
    }
  });
  const [aciklama, setAciklama]   = useState(() => {
    // Load from localStorage, default to empty string
    try {
      const saved = localStorage.getItem("scandesk_default_aciklama") || "";
      return saved;
    } catch {
      return "";
    }
  });
  const [pendingBc, setPendingBc] = useState(null);

  const [editDupRec, setEditDupRec] = useState(null);
  const [inheritModal, setInheritModal] = useState(false);
  const onBarcodeRef = useRef(null);
  const expectedBarcodeLength = useRef(null);

  // Vardiya devralma: giriş anında kontrol
  const [showTakeoverPrompt, setShowTakeoverPrompt] = useState(false);
  const takeoverChecked = useRef(false);
  useEffect(() => {
    if (takeoverChecked.current || isAdmin) return;
    takeoverChecked.current = true;
    const loginShift = getCurrentShift();
    const loginDate = getShiftDate(undefined, loginShift);
    const key = `${loginDate}_${loginShift}`;
    if (!(shiftTakeovers || {})[key]) {
      setShowTakeoverPrompt(true);
    }
  }, [isAdmin, shiftTakeovers]);

  const handleTakeoverAccept = () => {
    const loginShift = getCurrentShift();
    const loginDate = getShiftDate(undefined, loginShift);
    onShiftTakeover?.(loginShift, loginDate);
    setShowTakeoverPrompt(false);
    setInheritModal(true);
  };

  const handleTakeoverCancel = () => {
    setShowTakeoverPrompt(false);
  };

  const { autoSave, addDetailAfterScan, vibration, beep, recentLimit = 10 } = scanSettings;

  // Admin: vardiya ve tarih seçebilir; normal kullanıcı: saate göre otomatik
  const [adminShift, setAdminShift] = useState(() => getCurrentShift());
  const [adminDate, setAdminDate] = useState(() => fmtDate());
  const [userShift, setUserShift] = useState(() => getCurrentShift());

  // Update user shift periodically for non-admin users
  useEffect(() => {
    if (isAdmin) return;
    const interval = setInterval(() => {
      setUserShift(getCurrentShift());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isAdmin]);

  const currentShift = isAdmin ? adminShift : userShift;
  const currentShiftDate = isAdmin ? adminDate : getShiftDate(undefined, currentShift);

  // Reset expected barcode length when shift changes
  useEffect(() => {
    expectedBarcodeLength.current = null;
  }, [currentShift, currentShiftDate]);

  useEffect(() => { addDetailAfterScanRef.current = addDetailAfterScan; }, [addDetailAfterScan]);

  // Persist customer selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("scandesk_default_customer", customer);
    } catch (e) {
      console.error("Failed to save customer to localStorage:", e);
    }
  }, [customer]);

  // Persist aciklama selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("scandesk_default_aciklama", aciklama);
    } catch (e) {
      console.error("Failed to save aciklama to localStorage:", e);
    }
  }, [aciklama]);

  // Persist sticky fields (other dynamic fields) to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("scandesk_sticky_fields", JSON.stringify(extras));
    } catch (e) {
      console.error("Failed to save sticky fields to localStorage:", e);
    }
  }, [extras]);

  const scheduleFocus = useCallback(() => {
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 120);
  }, []);

  useEffect(() => { scheduleFocus(); }, [scheduleFocus]);

  const handleCustomerSelect = (val) => {
    setCustomer(normalizeCustomer(val));
    scheduleFocus();
  };

  /* ── Helpers ── */
  const normalizeCode = (c) => String(c ?? "").trim();
  const findExistingRec = (bc) => (records || []).find(r => {
    const rBc = String(r.barcode ?? "").trim();
    const rShift = String(r.shift ?? "");
    const rDate = deriveShiftDate(r);
    return rBc === bc && rShift === String(currentShift ?? "") && rDate === currentShiftDate;
  });
  const validateBarcodeForSave = useCallback((bc) => {
    if (!bc) {
      return { ok: false, msg: null };
    }

    // Shift expiry check
    if (shiftExpired && !isAdmin) {
      return { ok: false, msg: "Vardiya sona erdi — okutma devre dışı" };
    }

    // Length validation
    if (scanSettings.enforceBarcodeLengthMatch) {
      if (expectedBarcodeLength.current === null) {
        // First barcode - set the expected length
        expectedBarcodeLength.current = bc.length;
      } else if (bc.length !== expectedBarcodeLength.current) {
        // Length mismatch
        return {
          ok: false,
          msg: `⚠ Barkod uzunluğu ${expectedBarcodeLength.current} olmalı (okunan: ${bc.length})`
        };
      }
    }

    // Duplicate check
    const ex = findExistingRec(bc);
    if (ex) {
      return { ok: false, msg: "Mükerrer kod kaydedilemez !", dup: true, existingRecord: ex };
    }

    return { ok: true, msg: null };
  }, [shiftExpired, isAdmin, scanSettings, findExistingRec]);
  const onBarcode = (code) => {
    if (shiftExpired && !isAdmin) {
      toast("Vardiya sona erdi — okutma devre dışı", "var(--err)");
      return false;
    }
    const bc = normalizeCode(code);
    doSaveCode(bc, undefined);
    return true;
  };
  onBarcodeRef.current = onBarcode;

  // Auto-save when barcode length matches expected length
  // Uses debounce to wait for typing/scanning to finish before checking
  const autoSaveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(autoSaveTimer.current);
    if (!autoSave) return;
    if (!scanSettings.enforceBarcodeLengthMatch) return;
    if (expectedBarcodeLength.current === null) return;
    if (pendingBc) return;

    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;
    if (trimmedBarcode.length !== expectedBarcodeLength.current) return; // Wait silently until length matches

    // Length matches - wait briefly then save
    autoSaveTimer.current = setTimeout(() => {
      if (addDetailAfterScan) {
        const validation = validateBarcodeForSave(trimmedBarcode);
        if (!validation.ok) {
          if (validation.msg) toast(validation.msg, "var(--err)");
          setBarcode("");
          return;
        }
        setPendingBc(trimmedBarcode);
      } else {
        onBarcode(trimmedBarcode);
      }
    }, 550);

    return () => clearTimeout(autoSaveTimer.current);
  }, [barcode, autoSave, scanSettings.enforceBarcodeLengthMatch, pendingBc, addDetailAfterScan, onBarcode, validateBarcodeForSave, toast]);

  /* ── Save ── */
  const requiredFields = fields.filter(f => f.id !== "barcode" && f.id !== "note" && f.required);

  const doSaveCode = useCallback((code, extrasOverride) => {
    const bc = (code || "").trim();

    // Check required fields
    const currentExtras = extrasOverride ?? extras;
    const missing = requiredFields.filter(f => !currentExtras[f.id] && currentExtras[f.id] !== 0);
    if (missing.length > 0) {
      toast(`Zorunlu alanları doldurun: ${missing.map(f => f.label).join(", ")}`, "var(--err)");
      setBarcode("");
      scheduleFocus();
      return;
    }

    // Apply unified validation
    const validation = validateBarcodeForSave(bc);
    if (!validation.ok) {
      // For duplicates, only show warning - user can manually edit via recent scans list
      if (validation.msg) {
        toast(validation.msg, "var(--err)");
      }
      if (vibration && navigator.vibrate) navigator.vibrate([120, 80, 120]);
      if (beep) playBeep();
      setBarcode("");
      scheduleFocus();
      return;
    }
    const now = new Date();
    const extraFields = fields.filter(f => f.id !== "barcode");
    // Admin: seçilen vardiyayı kullan; normal kullanıcı: saate göre otomatik
    const shift = isAdmin ? adminShift : getCurrentShift();

    // Admin farklı tarih seçtiyse, timestamp'i o tarihe göre oluştur
    let recordTimestamp = now.toISOString();
    if (isAdmin && adminDate !== fmtDate()) {
      const [y, m, d] = adminDate.split("-").map(Number);
      const adjusted = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      recordTimestamp = adjusted.toISOString();
    }

    // Create customFields object for dynamic fields
    const customFields = {};
    // Add dynamic fields (excluding barcode and note)
    extraFields.filter(f => f.id !== "note").forEach(f => {
      const v = (extrasOverride ?? extras)[f.id];
      customFields[f.id] = (f.type === "Tarih" && !v) ? now.toISOString().slice(0, 10) : (v ?? "");
    });

    // Build record with fixed fields + customFields
    const row = {
      id: genId(),
      barcode: bc,
      timestamp: recordTimestamp,
      shift,
      customer: customer || "",
      aciklama: aciklama || "",
      scanned_by: user.name,
      scanned_by_username: user.username,
      syncStatus: "pending",
      syncError: "",
      source: "scan",
      sourceRecordId: "",
      updatedAt: now.toISOString(),
      customFields,
    };

    onSave(row);
    setBarcode("");
    setPendingBc(null);
    setExtras({});
    setFlash("saved");
    setTimeout(() => { setFlash("ready"); scheduleFocus(); }, 700);
    if (vibration && navigator.vibrate) navigator.vibrate([25, 15, 25]);
    if (beep) playBeep();

    if (integration.active) {
      const ef = fields.filter(f => f.id !== "barcode");
      const headers = ["Barkod", ...ef.map(f => f.label), "Müşteri", "Açıklama", "Kaydeden", "Kullanıcı Adı", "Tarih", "Saat"];
      // Flatten customFields for sync payload
      const rowArr  = [row.id, bc, ...ef.map(f => row.customFields[f.id] ?? ""), row.customer, row.aciklama, row.scanned_by, row.scanned_by_username, now.toLocaleDateString("tr-TR"), now.toLocaleTimeString("tr-TR")];
      if (integration.type === "postgres_api") {
        // Convert camelCase to snake_case for PostgreSQL compatibility
        const dbPayload = toDbPayload(row);
        postgresApiInsert(integration.postgresApi, dbPayload)
          .then(() => {
            // Success: mark as synced
            onSyncUpdate?.(row.id, true, null);
          })
          .catch(e => {
            // Failure: mark as failed with error and add to queue
            onSyncUpdate?.(row.id, false, e.message);
            addToSyncQueue?.("create", row.id, row);
            toast("PostgreSQL başarısız, kuyruğa eklendi", "var(--acc)");
          });
      } else {
        // Google Sheets with no-cors mode
        // Note: no-cors fetch returns opaque response - cannot detect server errors
        // We can only mark as "synced" when request is sent, not when server confirms
        sheetsInsert(integration.gsheets, headers, rowArr)
          .then(() => {
            // Request sent successfully (but server response unknown due to no-cors)
            // Don't update sync status for Google Sheets
          })
          .catch(e => {
            // Network error or request failed to send
            toast("Sheets hatası: " + e.message, "var(--err)");
          });
      }
    }
  }, [customer, aciklama, extras, fields, user, onSave, onSyncUpdate, scheduleFocus, vibration, beep, integration, toast, isAdmin, adminShift, adminDate, validateBarcodeForSave, addToSyncQueue]);

  const doSave = useCallback(() => {
    if (pendingBc) doSaveCode(pendingBc, extras);
    else doSaveCode(barcode, extras);
  }, [pendingBc, barcode, extras, doSaveCode]);

  const copyFromShift = useCallback((sourceShift, sourceUsername, selectedIds) => {
    const targetShift = isAdmin ? adminShift : getCurrentShift();
    const todayStr = getShiftDate(undefined, targetShift);
    const selectedSet = new Set(selectedIds);

    // Check for already taken records to prevent duplicates
    const alreadyTakenSourceIds = new Set(
      (records || [])
        .filter(r =>
          r.scanned_by_username === user.username &&
          r.shift === targetShift &&
          deriveShiftDate(r) === todayStr &&
          r.source === "shift_takeover" &&
          r.sourceRecordId
        )
        .map(r => r.sourceRecordId)
    );

    const toCopy = (records || []).filter(r =>
      r.shift === sourceShift &&
      deriveShiftDate(r) === todayStr &&
      r.scanned_by_username === sourceUsername &&
      selectedSet.has(r.id) &&
      !alreadyTakenSourceIds.has(r.id) // Prevent duplicate takeover
    );

    const now = new Date();

    toCopy.forEach(r => {
      const newRecord = {
        ...r,
        id: genId(),
        timestamp: now.toISOString(),
        shift: targetShift,
        scanned_by: user.name,
        scanned_by_username: user.username,
        source: "shift_takeover",
        sourceRecordId: r.id,
        syncStatus: "pending",
        updatedAt: now.toISOString(),
        customFields: r.customFields || {}
      };
      onSave(newRecord);

      // Entegrasyon senkronizasyonu
      if (integration.active) {
        if (integration.type === "postgres_api") {
          const dbPayload = toDbPayload(newRecord);
          postgresApiInsert(integration.postgresApi, dbPayload)
            .then(() => onSyncUpdate?.(newRecord.id, true, null))
            .catch(e => {
              onSyncUpdate?.(newRecord.id, false, e.message);
              addToSyncQueue?.("create", newRecord.id, newRecord);
            });
        } else if (integration.type === "gsheets") {
          syncRecordToSheets(integration.gsheets, newRecord, fields)
            .catch(e => console.error("Sheets devralma hatası:", e));
        }
      }
    });

    setInheritModal(false);

    if (toCopy.length > 0) {
      toast(`✓ ${toCopy.length} kayıt devralındı`, "var(--ok)");
    } else {
      toast("Devralınacak kayıt bulunamadı veya tümü zaten devralınmış", "var(--acc)");
    }
  }, [records, onSave, onSyncUpdate, toast, isAdmin, adminShift, user, integration, fields, addToSyncQueue]);

  const handleKey = e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    clearTimeout(autoSaveTimer.current);
    const bc = barcode.trim();

    // Show detail form if setting is enabled, otherwise proceed with save
    if (addDetailAfterScan && bc && !pendingBc) {
      // Validate before showing detail form
      const validation = validateBarcodeForSave(bc);
      if (!validation.ok) {
        // Only show warning - user can manually edit via recent scans list
        if (validation.msg) toast(validation.msg, "var(--err)");
        if (scanSettings.vibration && navigator.vibrate) navigator.vibrate([120, 80, 120]);
        if (scanSettings.beep) playBeep();
        return;
      }
      setPendingBc(bc);
      return;
    }

    // If in detail form, save and close
    if (pendingBc) {
      doSave();
      return;
    }

    // Trigger save via the unified flow
    if (autoSave) {
      onBarcode(bc);
    } else {
      doSave();
    }
  };

  return (
    <div className="page">
      {/* Vardiya Bilgisi — admin seçebilir, kullanıcı sadece görür */}
      <div className="shift-bar">
        <div className="shift-bar-label">
          <Ic d={I.fields} s={13} />
          <span>Vardiya:</span>
        </div>
        {isAdmin ? (
          <>
            <div className="shift-btns">
              {FIXED_SHIFTS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  className={`shift-btn${adminShift === s.label ? " active" : ""}`}
                  onClick={() => setAdminShift(s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={adminDate}
              onChange={e => setAdminDate(e.target.value)}
              className="shift-date"
            />
          </>
        ) : (
          <span style={{ fontWeight: 800, color: "var(--acc)", fontSize: 12 }}>{currentShift}</span>
        )}
        <span className="shift-time">{fmtTime()}</span>
      </div>

      {/* Vardiya sona erdi uyarısı */}
      {shiftExpired && !isAdmin && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          padding: "10px 14px", background: "var(--err)", borderRadius: "var(--r)",
          color: "#fff", fontSize: 13, fontWeight: 700
        }}>
          <Ic d={I.lock} s={16} /> Vardiyanız sona erdi. Okutma devre dışı — verilerinizi dışa aktarabilirsiniz.
        </div>
      )}

      {/* Müşteri */}
      <div className="cust-bar">
        <CustomerPicker
          customers={customerList}
          value={customer}
          onChange={handleCustomerSelect}
          onClose={scheduleFocus}
          canManage={true}
          onAdd={customers.add}
          onRemove={customers.remove}
        />
      </div>

      {/* Açıklama (persistent field like customer) */}
      <div className="cust-bar">
        <label className="lbl" style={{ marginBottom: 0, fontSize: 12 }}>Açıklama</label>
        <input
          type="text"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Açıklama girin..."
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            padding: "0 12px",
            background: "var(--s2)",
            color: "var(--tx)",
            border: "1.5px solid var(--brd)",
            fontSize: 13,
            fontWeight: 700,
          }}
        />
      </div>

      {/* Zorunlu alanlar - hızlı okutmada inline göster */}
      {autoSave && requiredFields.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {requiredFields.map(f => (
            <div key={f.id} className="cust-bar">
              <label className="lbl" style={{ marginBottom: 0, fontSize: 12, color: "var(--err)" }}>{f.label} *</label>
              <div style={{ flex: 1, border: `2px solid var(--err)`, borderRadius: 10 }}>
                <FieldInput
                  field={f}
                  value={extras[f.id] || ""}
                  onChange={(v) => setExtras(p => ({ ...p, [f.id]: v }))}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      <div className={`status-bar ${flash === "saved" ? "s-saved" : "s-ready"}`}>
        {flash === "saved" ? <><Ic d={I.check} s={16} /> Kaydedildi!</>
         : <><div className="pulse" style={{ color: "var(--ok)" }} /> {autoSave ? "Hazır — okutun" : "Okutun, ardından Kaydet'e basın"}</>}
      </div>

      {/* Barcode input */}
      <div className="bc-wrap">
        <span className="bc-icon"><Ic d={I.barcode} s={22} /></span>
        <input
          ref={inputRef}
          className="barcode-input"
          value={barcode}
          onChange={e => setBarcode(e.target.value)}
          onKeyDown={handleKey}
          placeholder={shiftExpired && !isAdmin ? "Vardiya sona erdi — okutma devre dışı" : "Barkod okutun veya girin..."}
          disabled={shiftExpired && !isAdmin}
          autoComplete="off" autoCorrect="off"
          autoCapitalize="none" spellCheck={false} inputMode="text"
        />
      </div>

      {!autoSave && (
        <button className="btn btn-ok btn-full btn-lg" style={{ marginBottom: 10 }} onClick={() => {
          const bc = barcode.trim();
          if (addDetailAfterScan && bc && !pendingBc) {
            const validation = validateBarcodeForSave(bc);
            if (!validation.ok) {
              if (validation.msg) toast(validation.msg, "var(--err)");
              if (vibration && navigator.vibrate) navigator.vibrate([120, 80, 120]);
              if (beep) playBeep();
              return;
            }
            setPendingBc(bc);
            return;
          }
          doSave();
        }}>
          <Ic d={I.save} s={20} /> Kaydet
        </button>
      )}

      {/* Signature bar */}
      <div className="sig-bar">
        <Ic d={I.sig} s={14} />
        <span><span style={{ color: 'var(--acc)' }}>İmza:</span> <b>{user.name}</b> ({user.username})</span>
        {autoSave && <span style={{ opacity: .7 }}>· otomatik kayıt</span>}
        {integration.active && <span style={{ marginLeft: "auto", opacity: .7, fontSize: 11 }}>→ {integration.type === "postgres_api" ? "PostgreSQL API" : "Sheets"}</span>}
      </div>

      {/* Son Okutmalar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--tx2)', fontWeight: 800, marginBottom: 6 }}>Son Okutmalar</div>

        {(() => {
          const todayShift = currentShiftDate;
          const all = (records || []).filter(r =>
            r.scanned_by_username === user?.username &&
            r.shift === currentShift &&
            deriveShiftDate(r) === todayShift
          ).slice().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          const lim = scanSettings.recentLimit;
          const view = (lim === 0 || lim === "0" || lim === "full") ? all : all.slice(0, Number(lim || 10));
          return (
            <div style={{ maxHeight: 260, overflow: 'auto', border: '1.5px solid var(--brd)', borderRadius: 'var(--r)', padding: 8, background: 'var(--card)' }}>
              {view.length === 0 ? (
                <div style={{ color: 'var(--tx3)', fontSize: 12 }}>Henüz kayıt yok</div>
              ) : (
                view.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: i === view.length - 1 ? 'none' : '1px solid var(--brd)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="bc" style={{ fontWeight: 900 }}>{r.barcode}</div>
                        {r.source === "shift_takeover" && (
                          <span style={{ fontSize: 9, color: 'var(--tx3)', background: 'var(--s2)', border: '1px solid var(--brd)', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                            devralındı
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                        {(r.scanned_by || '—')} · {(r.customer || '—')} &nbsp; {new Date(r.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        {/* Show custom field preview if available */}
                        {r.customFields && Object.keys(r.customFields).length > 0 && (
                          <span style={{ marginLeft: 8, opacity: 0.7 }}>
                            {Object.entries(r.customFields).slice(0, 2).map(([k, v]) => v && `${k}: ${v}`).filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="btn btn-info btn-sm" style={{ height: 32, padding: "0 8px" }} onClick={() => setEditDupRec(r)}><Ic d={I.edit} s={12} /></button>
                  </div>
                ))
              )}
            </div>
          );
        })()}
      </div>

      {editDupRec && <EditRecordModal record={editDupRec} fields={fields} customers={customers} canManageCustomers={true} onSave={(r)=>{ onEdit(r); setEditDupRec(null); }} onClose={()=>{ setEditDupRec(null); setBarcode(""); }} />}

      {inheritModal && <ShiftInheritModal currentShift={currentShift} currentUser={user} records={records} onCopy={copyFromShift} onClose={() => setInheritModal(false)} />}

      {showTakeoverPrompt && !isAdmin && (
        <ShiftTakeoverPrompt
          shift={currentShift}
          onTakeover={handleTakeoverAccept}
          onCancel={handleTakeoverCancel}
        />
      )}

      {pendingBc && addDetailAfterScan && (
        <DetailFormModal
          barcode={pendingBc}
          fields={fields.filter(f => f.id !== "barcode" && f.id !== "note")}
          extras={extras}
          onExtrasChange={(fieldId, value) => setExtras(p => ({ ...p, [fieldId]: value }))}
          customer={customer}
          onCustomerChange={handleCustomerSelect}
          aciklama={aciklama}
          onAciklamaChange={setAciklama}
          customerList={customerList}
          onCustomerAdd={customers.add}
          onCustomerRemove={customers.remove}
          canManageCustomers={true}
          onSave={doSave}
          onClose={() => { setPendingBc(null); setBarcode(""); scheduleFocus(); }}
        />
      )}
    </div>
  );
}
