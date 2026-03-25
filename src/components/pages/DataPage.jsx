import { useState, useRef } from "react";
import { Ic, I } from "../ui/Icon";
import EditRecordModal from "../modals/EditRecordModal";
import Modal from "../ui/Modal";
import { genId } from "../../constants";
import { toggleSetMember, deriveShiftDate, getShiftDate, fmtDate, FIXED_SHIFTS } from "../../utils";
import { getDynamicFieldValue, FIXED_FIELDS } from "../../services/recordModel";

export default function DataPage({ fields, records, onDelete, onEdit, onExport, onImport, customers, aciklamalar, settings, toast, isAdmin, currentShift, user, users, integration, onSyncUpdate }) {
  const [q, setQ]           = useState("");
  const [grouped, setGrouped] = useState(true);
  const [editRec, setEditRec] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [pendingImport, setPendingImport] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedUser, setSelectedUser]   = useState(null);
  const [selectedDate, setSelectedDate]   = useState(() => fmtDate());
  const [shiftOpen, setShiftOpen]         = useState(false);
  const [userOpen, setUserOpen]           = useState(false);
  const [selMode, setSelMode] = useState(false);
  const importRef = useRef(null);
  const longPressRef = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const toggleSel = (id) => setSel(p => toggleSetMember(p, id));
  const clearSel = () => setSel(new Set());
  const exitSelMode = () => { setSelMode(false); clearSel(); };
  const startLongPress = (ids) => {
    const idSet = Array.isArray(ids) ? new Set(ids) : new Set([ids]);
    longPressRef.current = setTimeout(() => {
      setSelMode(true);
      setSel(idSet);
      if (user?.userSettings?.vibration !== false && navigator.vibrate) navigator.vibrate([30, 20, 30]);
    }, 500);
  };
  const cancelLongPress = () => clearTimeout(longPressRef.current);

  const currentShiftDate = getShiftDate(undefined, currentShift);

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) { toast && toast("Dosyada veri bulunamadı", "var(--acc)"); return; }
        const allF = [{ id: "barcode", label: "Barkod" }, ...fields.filter(f => f.id !== "barcode")];
        // Build label→id map for column matching
        const labelMap = {};
        allF.forEach(f => {
          labelMap[f.label.toLowerCase()] = f.id;
          labelMap[f.id.toLowerCase()] = f.id;
        });
        labelMap["müşteri"] = "customer";
        labelMap["musteri"] = "customer";
        labelMap["açıklama"] = "aciklama";
        labelMap["aciklama"] = "aciklama";
        labelMap["kaydeden"] = "scanned_by";
        labelMap["kullanıcı adı"] = "scanned_by_username";
        labelMap["kullanici adi"] = "scanned_by_username";
        labelMap["tarih"] = "date";
        labelMap["saat"] = "time";
        labelMap["vardiya"] = "shift";
        labelMap["vardiya tarihi"] = "shiftDate";
        labelMap["shiftdate"] = "shiftDate";
        // System fields for import/export round-trip
        labelMap["id"] = "id";
        labelMap["timestamp"] = "timestamp";
        labelMap["senkronizasyon durumu"] = "syncStatus";
        labelMap["senkronizasyon hatası"] = "syncError";
        labelMap["senkronizasyon hatasi"] = "syncError";
        labelMap["kaynak"] = "source";
        labelMap["kaynak kayıt id"] = "sourceRecordId";
        labelMap["kaynak kayit id"] = "sourceRecordId";
        labelMap["sourcerecordid"] = "sourceRecordId";
        labelMap["güncellenme"] = "updatedAt";
        labelMap["guncellenme"] = "updatedAt";

        // Use FIXED_FIELDS from recordModel for consistency

        // Helper to parse value based on field type
        const parseFieldValue = (value, fieldId) => {
          if (value == null || value === "") return "";

          // Find field definition to get type
          const field = allF.find(f => f.id === fieldId);
          if (!field || !field.type) return String(value);

          // Parse based on field type
          switch (field.type) {
            case "Sayı": {
              // Number type - parse as number if valid
              const num = Number(value);
              return isNaN(num) ? "" : num;
            }
            case "Onay Kutusu": {
              // Checkbox type - parse as boolean
              const strVal = String(value).toLowerCase();
              if (strVal === "true" || strVal === "1" || strVal === "yes" || strVal === "evet") return true;
              if (strVal === "false" || strVal === "0" || strVal === "no" || strVal === "hayır") return false;
              return Boolean(value);
            }
            case "Tarih": {
              // Date type - keep as YYYY-MM-DD string, validate format
              const dateStr = String(value);
              // Ensure valid ISO date format YYYY-MM-DD
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
              }
              // Try to parse and convert to ISO format
              const d = new Date(dateStr);
              return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
            }
            case "Metin":
            case "Seçim":
            default:
              // Text and other types - keep as string
              return String(value);
          }
        };

        // İçe aktarmada sistem alanları yeni okutma gibi doldurulur.
        // Excel'den yalnızca barkod, müşteri, açıklama ve dinamik alanlar alınır.
        const IMPORT_SKIP_FIELDS = new Set([
          "date", "time", "timestamp", "shift", "shiftDate",
          "scanned_by", "scanned_by_username",
          "syncStatus", "syncError", "source", "sourceRecordId", "updatedAt",
          "id",
        ]);
        const now = new Date();
        const imported = rows.map(row => {
          const rec = { id: genId(), customFields: {} };
          Object.entries(row).forEach(([col, val]) => {
            const fid = labelMap[col.toLowerCase().trim()];
            // Sistem alanlarını atla — bunlar aşağıda yeni okutma gibi doldurulur
            if (!fid || IMPORT_SKIP_FIELDS.has(fid)) return;
            if (fid === "barcode" || fid === "customer" || fid === "aciklama") {
              // Barkod, müşteri ve açıklama doğrudan root'a
              rec[fid] = String(val ?? "");
            } else if (FIXED_FIELDS.includes(fid)) {
              rec[fid] = String(val ?? "");
            } else {
              // Dinamik alan → customFields
              rec.customFields[fid] = parseFieldValue(val, fid);
            }
          });

          if (!rec.barcode) return null;

          // Sistem alanlarını yeni okutma gibi doldur
          rec.timestamp = now.toISOString();
          rec.shift = currentShift;
          rec.shiftDate = currentShiftDate;
          rec.scanned_by = user?.name ?? "";
          rec.scanned_by_username = user?.username ?? "";
          rec.syncStatus = "pending";
          rec.syncError = "";
          rec.source = "import";
          rec.sourceRecordId = "";
          rec.updatedAt = now.toISOString();

          return rec;
        }).filter(Boolean);
        if (!imported.length) { toast && toast("Barkod sütunu bulunamadı", "var(--err)"); return; }

        // Check for duplicates (barcode only - not shift/date)
        const existingBarcodes = new Set(records.map(r => String(r.barcode ?? "").trim()));
        const newRecords = [];
        const duplicates = [];

        imported.forEach(rec => {
          const key = String(rec.barcode ?? "").trim();
          if (existingBarcodes.has(key)) {
            duplicates.push(rec);
          } else {
            newRecords.push(rec);
            existingBarcodes.add(key); // Prevent duplicates within the file itself
          }
        });

        // Show import summary - both admin and regular users can see it
        const totalCount = imported.length;
        const duplicateCount = duplicates.length;
        const newCount = newRecords.length;

        if (duplicateCount > 0) {
          toast && toast(`${totalCount} kayıt bulundu: ${newCount} yeni, ${duplicateCount} tekrar`, "var(--inf)");
        }

        // Auto-skip duplicates, only import new records
        if (newCount === 0) {
          toast && toast("Tüm kayıtlar sistemde zaten mevcut", "var(--acc)");
          return;
        }

        // Show analysis panel to all users (both admin and regular)
        setPendingImport({
          records: newRecords,
          duplicates,
          total: totalCount,
          newCount,
          duplicateCount
        });
      } catch (err) {
        toast && toast("Dosya okunamadı: " + err.message, "var(--err)");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApproveImport = () => {
    if (pendingImport) {
      // Only import new records (duplicates are auto-skipped)
      onImport(pendingImport.records);
      toast && toast(`${pendingImport.newCount} yeni kayıt içe aktarıldı`, "var(--ok)");
      setPendingImport(null);
    }
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    toast && toast("İçe aktarma iptal edildi", "var(--acc)");
  };

  const allF = [{ id: "barcode", label: "Barkod", type: "Metin" }, ...fields.filter(f => f.id !== "barcode")];
  const dynamicF = fields.filter(f => f.id !== "barcode");
  // Admin tüm kayıtları görebilir; normal kullanıcılar seçili tarihteki kendi kayıtlarını görür
  const visibleRecords = isAdmin
    ? records.filter(r => {
        if (selectedDate && deriveShiftDate(r) !== selectedDate) return false;
        if (selectedShift && r.shift !== selectedShift) return false;
        if (selectedUser  && r.scanned_by_username !== selectedUser) return false;
        return true;
      })
    : records.filter(r =>
        r.scanned_by_username === user?.username &&
        r.shift === currentShift &&
        deriveShiftDate(r) === currentShiftDate
      );
  const filtered = visibleRecords.filter(r => {
    if (!q) return true;
    // Search in fixed fields and customFields
    const searchInFixed = [...allF, { id: "customer" }, { id: "aciklama" }, { id: "scanned_by" }, { id: "shift" }].some(f => {
      const val = f.id === "barcode" || f.id === "customer" || f.id === "aciklama" || f.id === "scanned_by" || f.id === "shift"
        ? r[f.id]
        : getDynamicFieldValue(r, f.id);
      return String(val ?? "").toLowerCase().includes(q.toLowerCase());
    });

    // Also search in all customFields values
    if (!searchInFixed && r.customFields && typeof r.customFields === 'object') {
      return Object.values(r.customFields).some(val =>
        String(val ?? "").toLowerCase().includes(q.toLowerCase())
      );
    }

    return searchInFixed;
  });
  const groups = {};
  filtered.forEach(r => { const k = r.customer || "(Müşteri yok)"; if (!groups[k]) groups[k] = []; groups[k].push(r); });

  const hasIntegration = integration?.postgresApi?.active || integration?.gsheets?.active;

  const SyncDot = ({ status, error }) => {
    if (!hasIntegration) return null;
    const cfg = status === "synced"
      ? { color: "var(--ok)", title: "Senkronize edildi", symbol: "●" }
      : status === "failed"
      ? { color: "var(--err)", title: error || "Senkronizasyon başarısız", symbol: "●" }
      : { color: "var(--acc)", title: "Senkronizasyon bekliyor", symbol: "●" };
    return (
      <span title={cfg.title} style={{ color: cfg.color, fontSize: 10, lineHeight: 1, cursor: "default" }}>
        {cfg.symbol}
      </span>
    );
  };

  const Rows = ({ rows, showCust }) => rows.map(r => (
    <tr key={r.id}>
      <td style={{ color: "var(--tx3)", fontSize: 10 }}>{records.indexOf(r) + 1}</td>
      <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <SyncDot status={r.syncStatus} error={r.syncError} />
          <span className="bc">{r.barcode}</span>
        </div>
      </td>
      {showCust && <td style={{ color: "var(--inf)", fontWeight: 600, fontSize: 12 }}>{r.customer || "—"}</td>}
      <td style={{ fontSize: 12, color: "var(--tx2)" }}>{r.aciklama || "—"}</td>
      <td><span className="sig-cell">{r.scanned_by}</span></td>
      <td style={{ fontSize: 10, color: "var(--tx2)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
        {new Date(r.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
      </td>
      {dynamicF.map(f => (
        <td key={f.id}>
          {f.type === "Onay Kutusu" ? <span className={`badge ${getDynamicFieldValue(r, f.id) ? "badge-ok" : ""}`} style={!getDynamicFieldValue(r, f.id) ? { color: "var(--tx3)" } : {}}>{getDynamicFieldValue(r, f.id) ? "✓" : "—"}</span>
           : getDynamicFieldValue(r, f.id) || <span style={{ color: "var(--tx3)" }}>—</span>}
        </td>
      ))}
      <td>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-info btn-sm" style={{ height: 32, padding: "0 8px" }} onClick={() => setEditRec(r)}><Ic d={I.edit} s={12} /></button>
          <button className="btn btn-danger btn-sm" style={{ height: 32, padding: "0 8px" }} onClick={() => onDelete(r.id)}><Ic d={I.del} s={12} /></button>
        </div>
      </td>
    </tr>
  ));

  const THead = ({ showCust, rows: scopeRows }) => {
    const scope = scopeRows || filtered;
    return (
      <thead><tr>
        <th>#</th>
        <th style={{ width: 34 }}><input type="checkbox" checked={scope.length>0 && scope.every(r=>sel.has(r.id))} onChange={e => { if (e.target.checked) setSel(p => new Set([...p, ...scope.map(r=>r.id)])); else setSel(p => { const n = new Set(p); scope.forEach(r => n.delete(r.id)); return n; }); }} /></th>
        <th>Barkod</th>
        {showCust && <th>Müşteri</th>}<th>Açıklama</th><th>Kaydeden</th><th>Saat</th>
        {dynamicF.map(f => <th key={f.id}>{f.label}</th>)}
        <th></th>
      </tr></thead>
    );
  };

  const CardRow = ({ r }) => {
    const time = new Date(r.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const infoMeta = [r.customer, r.aciklama, ...dynamicF.map(f => getDynamicFieldValue(r, f.id))].filter(Boolean).join(" · ");
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0",
                 borderBottom: "1px solid var(--brd)", cursor: selMode ? "pointer" : "default" }}
        onTouchStart={() => !selMode && startLongPress(r.id)}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onClick={() => selMode && toggleSel(r.id)}
      >
        {selMode && (
          <input type="checkbox" readOnly checked={sel.has(r.id)}
            style={{ flexShrink: 0, width: 18, height: 18, pointerEvents: "none" }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SyncDot status={r.syncStatus} error={r.syncError} />
            <span className="bc" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.barcode}
            </span>
            <span style={{ fontSize: 10, color: "var(--tx2)", fontFamily: "var(--mono)",
                           whiteSpace: "nowrap", flexShrink: 0 }}>
              {time}
            </span>
          </div>
          {(infoMeta || r.scanned_by) && (
            <div style={{ fontSize: 11, marginTop: 3, display: "flex", gap: 6, overflow: "hidden" }}>
              {infoMeta && (
                <span style={{ color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis",
                               whiteSpace: "nowrap", flex: 1 }}>
                  {infoMeta}
                </span>
              )}
              {r.scanned_by && (
                <span className="sig-cell" style={{ flexShrink: 0 }}>{r.scanned_by}</span>
              )}
            </div>
          )}
        </div>
        {!selMode && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button className="btn btn-info btn-sm" style={{ height: 32, padding: "0 8px" }}
              onClick={e => { e.stopPropagation(); setEditRec(r); }}>
              <Ic d={I.edit} s={12} />
            </button>
            <button className="btn btn-danger btn-sm" style={{ height: 32, padding: "0 8px" }}
              onClick={e => { e.stopPropagation(); onDelete(r.id); }}>
              <Ic d={I.del} s={12} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const CardList = ({ rows }) => (
    <div style={{ border: "1.5px solid var(--brd)", borderRadius: "var(--r)",
                  padding: "0 12px", background: "var(--s1)" }}>
      {rows.map(r => <CardRow key={r.id} r={r} />)}
    </div>
  );

  return (
    <div className="page">

      {/* Export/Import buttons in one row - all same size */}
      {(settings.allowExport || settings.allowImport) && (
        <div className="export-row">
          {settings.allowExport && (
            <>
              <button className="btn btn-ok btn-full" onClick={() => onExport("xlsx")}><Ic d={I.xlsx} s={15} /> Excel</button>
              <button className="btn btn-pur btn-full" onClick={() => onExport("csv")}><Ic d={I.csv} s={15} /> CSV</button>
            </>
          )}
          {settings.allowImport && (
            <>
              <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleImportFile} />
              <button className="btn btn-ghost btn-full" onClick={() => importRef.current?.click()}>
                <Ic d={I.upload} s={15} /> İçe Aktar
              </button>
            </>
          )}
        </div>
      )}
      {(selMode || sel.size > 0) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--tx2)", flex: 1 }}>
            {sel.size > 0 ? `${sel.size} seçildi` : "Seç"}
          </span>
          {sel.size > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => {
              if (!window.confirm(`Seçili ${sel.size} kayıt silinecek. Onaylıyor musunuz?`)) return;
              onDelete(Array.from(sel)); exitSelMode();
            }}><Ic d={I.trash} s={13} /> Sil ({sel.size})</button>
          )}
          {sel.size > 0 && settings.allowExport && (
            <button className="btn btn-ok btn-sm" onClick={() => { onExport("xlsx", Array.from(sel)); exitSelMode(); }}>
              <Ic d={I.xlsx} s={13} /> Excel
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={exitSelMode}>İptal</button>
        </div>
      )}


      <div style={{ marginBottom: 10 }}>
        {/* Search box */}
        <div className="srch" style={{ width: "100%", marginBottom: 8 }}>
          <span className="srch-ico"><Ic d={I.search} s={16} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Barkod ara..." />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className={`btn btn-sm ${grouped ? "btn-info" : "btn-ghost"}`} onClick={() => setGrouped(p => !p)}>
            <Ic d={I.group} s={15} /> {grouped ? "Gruplu" : "Liste"}
          </button>

          {/* Admin: Tarih filtresi */}
          {isAdmin && (
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="shift-date"
            />
          )}

          {/* Admin: Vardiya filtresi */}
          {isAdmin && (
            <div style={{ position: "relative" }}>
              <button
                className={`btn btn-sm ${selectedShift ? "btn-info" : "btn-ghost"}`}
                onClick={() => { setShiftOpen(p => !p); setUserOpen(false); }}
              >
                <Ic d={I.report} s={14} /> {selectedShift || "Vardiya"}
              </button>
              {shiftOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 99, background: "var(--s1)", border: "1.5px solid var(--brd)", borderRadius: "var(--r)", minWidth: 120, boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
                  {[null, ...FIXED_SHIFTS.map(s => s.label)].map(v => (
                    <button
                      key={v ?? "__all"}
                      type="button"
                      onClick={() => { setSelectedShift(v); setShiftOpen(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", fontWeight: v === selectedShift ? 700 : 400, color: v === selectedShift ? "var(--inf)" : "var(--tx1)", fontSize: 13, borderBottom: "1px solid var(--brd)", width: "100%", textAlign: "left", background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none", touchAction: "manipulation", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
                    >
                      {v ?? "Tümü"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin: Kullanıcı filtresi */}
          {isAdmin && (
            <div style={{ position: "relative" }}>
              <button
                className={`btn btn-sm ${selectedUser ? "btn-info" : "btn-ghost"}`}
                onClick={() => { setUserOpen(p => !p); setShiftOpen(false); }}
              >
                <Ic d={I.user} s={14} /> {selectedUser ? (users?.find(u => u.username === selectedUser)?.name || selectedUser) : "Kullanıcı"}
              </button>
              {userOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 99, background: "var(--s1)", border: "1.5px solid var(--brd)", borderRadius: "var(--r)", minWidth: 150, maxHeight: 260, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
                  {[null, ...(users ?? []).filter(u => u.active !== false)].map(v => {
                    const uname = v?.username ?? null;
                    const label = v ? (v.name || v.username) : "Tümü";
                    return (
                      <button
                        key={uname ?? "__all"}
                        type="button"
                        onClick={() => { setSelectedUser(uname); setUserOpen(false); }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontWeight: uname === selectedUser ? 700 : 400, color: uname === selectedUser ? "var(--inf)" : "var(--tx1)", fontSize: 13, borderBottom: "1px solid var(--brd)", width: "100%", textAlign: "left", background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none", touchAction: "manipulation", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0
        ? <div className="empty-state"><Ic d={I.data} s={36} /><p style={{ marginTop: 10, fontSize: 14 }}>Kayıt yok</p></div>
        : grouped
        ? Object.entries(groups).map(([k, rows]) => {
          const groupIds = rows.map(r => r.id);
          const allSel = groupIds.every(id => sel.has(id));
          const toggleGroup = () => setSel(p => {
            const n = new Set(p);
            if (allSel) groupIds.forEach(id => n.delete(id)); else groupIds.forEach(id => n.add(id));
            return n;
          });
          return (
            <div key={k}>
              <div className="group-hd"
                onTouchStart={() => !selMode && startLongPress(groupIds)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onClick={() => selMode && toggleGroup()}
                style={{ cursor: selMode ? "pointer" : "default" }}
              >
                {selMode && (
                  <input type="checkbox" readOnly checked={allSel}
                    style={{ flexShrink: 0, width: 16, height: 16, pointerEvents: "none" }} />
                )}
                <Ic d={I.user} s={13} />{k}<span className="group-count">{rows.length}</span>
              </div>
              {isMobile
                ? <CardList rows={rows} />
                : <div className="tbl-wrap" style={{ marginBottom: 6 }}>
                    <table className="tbl"><THead showCust={false} rows={rows} /><tbody><Rows rows={rows} showCust={false} /></tbody></table>
                  </div>
              }
            </div>
          );
        })
        : isMobile
          ? <CardList rows={filtered} />
          : <div className="tbl-wrap">
              <table className="tbl"><THead showCust={true} /><tbody><Rows rows={filtered} showCust={true} /></tbody></table>
            </div>
      }

      {editRec && <EditRecordModal record={editRec} fields={fields} customers={customers} aciklamalar={aciklamalar} canManageCustomers={true}
        onSave={r => { onEdit(r); setEditRec(null); }} onClose={() => setEditRec(null)} />}

      {pendingImport && (
        <Modal
          title="İçe Aktarma Analizi"
          icon={I.upload}
          onClose={handleCancelImport}
          footer={
            <>
              {settings.allowImport ? (
                <button className="btn btn-ok" style={{ flex: 1 }} onClick={handleApproveImport}>
                  <Ic d={I.check} s={16} /> İçe Aktar ({pendingImport.newCount} Yeni Kayıt)
                </button>
              ) : (
                <div style={{ flex: 1, padding: "10px", background: "var(--err2)", border: "1.5px solid var(--err3)", borderRadius: "var(--r)", fontSize: 12, color: "var(--err)", fontWeight: 600, textAlign: "center" }}>
                  İçe aktarma yetkisi yok
                </div>
              )}
              <button className="btn btn-ghost" style={{ width: 88 }} onClick={handleCancelImport}>İptal</button>
            </>
          }
        >
          <div style={{ marginBottom: 12 }}>
            {pendingImport.duplicateCount > 0 && (
              <div style={{ padding: "12px", background: "var(--acc2)", border: "1.5px solid var(--acc3)", borderRadius: "var(--r)", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Ic d={I.warning} s={16} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--acc)" }}>Tekrar Eden Kayıtlar Atlanacak</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--tx2)", margin: 0 }}>
                  {pendingImport.duplicateCount} kayıt sistemde zaten mevcut (aynı barkod).
                  Bu kayıtlar otomatik olarak atlanacak.
                </p>
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx2)" }}>Toplam kayıt:</span>{" "}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{pendingImport.total}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx2)" }}>Tekrar eden (atlanacak):</span>{" "}
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{pendingImport.duplicateCount}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx2)" }}>Yeni eklenecek:</span>{" "}
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)" }}>{pendingImport.newCount}</span>
            </div>
          </div>
          {pendingImport.duplicates.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--tx2)" }}>Tekrar Eden Kayıtlar (Atlanacak):</div>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1.5px solid var(--brd)", borderRadius: "var(--r)", padding: 8, background: "var(--s2)" }}>
                {pendingImport.duplicates.slice(0, 10).map((rec, idx) => (
                  <div key={idx} style={{ padding: "6px 8px", background: "var(--s1)", border: "1px solid var(--brd)", borderRadius: 6, marginBottom: 6, fontSize: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span><b>Barkod:</b> {rec.barcode}</span>
                      <span className="badge" style={{ background: "var(--acc2)", color: "var(--acc)" }}>
                        Sistemde var
                      </span>
                    </div>
                    {rec.shift && <div><b>Vardiya:</b> {rec.shift} • <b>Tarih:</b> {deriveShiftDate(rec)}</div>}
                  </div>
                ))}
                {pendingImport.duplicates.length > 10 && (
                  <div style={{ fontSize: 11, color: "var(--tx3)", textAlign: "center", marginTop: 8 }}>
                    ... ve {pendingImport.duplicates.length - 10} tane daha
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
