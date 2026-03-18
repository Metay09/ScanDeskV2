import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  lookupPalet, guessColMap, buildTableFromRows,
  getReferenceTableMeta,
} from "../../services/referenceTable";
import { isNative } from "../../services/storage";
import { getDynamicFieldValue } from "../../services/recordModel";

// ── Temel sabit kolonlar ──────────────────────────────────────────────────────
const BASE_COLS = [
  { id: "paletKodu",  label: "Palet Kodu",       fixed: true  },
  { id: "stokAdi",    label: "Stok Adı",          fixed: false },
  { id: "miktar",     label: "Miktar",             fixed: false },
  { id: "koliAdet",   label: "Koli Adet",          fixed: false },
  { id: "tarihLT",    label: "Tarih (LT)",         fixed: false },
  { id: "tarih",      label: "Tarih",              fixed: false },
  { id: "skt",        label: "SKT",                fixed: false },
  { id: "aciklama",   label: "Ref. Açıklama",      fixed: false },
  { id: "musteri",    label: "Müşteri",            fixed: false },
  { id: "taramaNotu", label: "Tarama Açıklama",    fixed: false },
  { id: "kullanici",  label: "Kullanıcı",          fixed: false },
];

// Varsayılan gizli kolonlar
const HIDDEN_BY_DEFAULT = new Set(["skt", "aciklama"]);

const MAPPER_FIELDS = [
  { field: "paletKodu", label: "Palet Kodu", required: true },
  { field: "stokAdi",   label: "Stok Adı" },
  { field: "miktar",    label: "Miktar" },
  { field: "koliAdet",  label: "Koli Adet" },
  { field: "lotNo",     label: "Lot No" },
  { field: "tarih",     label: "Tarih" },
  { field: "skt",       label: "SKT" },
  { field: "aciklama",  label: "Ref. Açıklama" },
];

function fmtMetaDate(iso) {
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  } catch { return iso; }
}

export default function ReportPage({
  records,
  fields,
  isAdmin,
  currentShift,
  user,
  refTable,
  refColMap,
  onRefTableSave,
  onRefTableClear,
  toast,
}) {
  // ── Upload / Mapper state ───────────────────────────────────────────────────
  const [showMapper, setShowMapper]         = useState(false);
  const [pendingRows, setPendingRows]       = useState([]);
  const [pendingHeaders, setPendingHeaders] = useState([]);
  const [colMapDraft, setColMapDraft]       = useState({});
  const [extraSelected, setExtraSelected]   = useState(new Set()); // seçili ekstra header isimleri
  const [uploading, setUploading]           = useState(false);
  const [uploadErr, setUploadErr]           = useState("");
  const [dragOver, setDragOver]             = useState(false);

  // ── Tablo state ─────────────────────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState(
    () => Object.fromEntries(BASE_COLS.map(c => [c.id, !HIDDEN_BY_DEFAULT.has(c.id)]))
  );
  const [colFilters, setColFilters]   = useState({});
  const [openFilter, setOpenFilter]   = useState(null);
  const [showColPicker, setShowColPicker] = useState(false);

  const fileRef    = useRef(null);
  const filterRefs = useRef({});

  // ── Dinamik ekstra kolonlar (colMap'teki _extra_ alanlarından) ──────────────
  const extraCols = useMemo(() => {
    if (!refColMap) return [];
    return Object.entries(refColMap)
      .filter(([k]) => k.startsWith("_extra_"))
      .map(([k]) => ({ id: `ex_${k.slice(7)}`, label: k.slice(7), fixed: false }));
  }, [refColMap]);

  // Custom (dinamik) uygulama alanları — barcode hariç fields prop'tan
  const customFieldCols = useMemo(() => {
    if (!fields?.length) return [];
    return fields
      .filter(f => f.id !== "barcode")
      .map(f => ({ id: `cf_${f.id}`, label: f.label, fixed: false, fieldId: f.id }));
  }, [fields]);

  const allCols = useMemo(
    () => [...BASE_COLS, ...extraCols, ...customFieldCols],
    [extraCols, customFieldCols]
  );

  // ── Admin / non-admin filtresi — useEffect'lerden ÖNCE tanımlanmalı ─────────
  const baseRecords = useMemo(() => {
    if (isAdmin) return records;
    return records.filter(r => r.shift === currentShift);
  }, [records, isAdmin, currentShift]);

  // Ekstra Excel kolonları değişince visibleCols'a ekle (varsayılan: görünür)
  useEffect(() => {
    if (!extraCols.length) return;
    setVisibleCols(prev => {
      const next = { ...prev };
      let changed = false;
      for (const col of extraCols) {
        if (!(col.id in next)) { next[col.id] = true; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [extraCols]);

  // Custom uygulama alanları: veri varsa görünür, yoksa gizli
  useEffect(() => {
    if (!customFieldCols.length) return;
    setVisibleCols(prev => {
      const next = { ...prev };
      let changed = false;
      for (const col of customFieldCols) {
        if (col.id in next) continue;
        const hasData = baseRecords.some(r => {
          const v = getDynamicFieldValue(r, col.fieldId);
          return v !== undefined && v !== null && v !== "";
        });
        next[col.id] = hasData;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [customFieldCols, baseRecords]);

  // ── Dışarı tıklama: popup'ları kapat ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (openFilter) {
        const ref = filterRefs.current[openFilter];
        if (ref && !ref.contains(e.target)) setOpenFilter(null);
      }
      if (showColPicker) {
        const picker = document.getElementById("rp-col-picker");
        if (picker && !picker.contains(e.target)) setShowColPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilter, showColPicker]);

  // ── Referans tabloyla birleştir ─────────────────────────────────────────────
  const tableRows = useMemo(() => {
    return baseRecords.map(record => {
      const ref = lookupPalet(refTable, record.barcode) || {};
      const extras = ref._extras || {};
      const row = {
        paletKodu:   record.barcode             || "",
        musteri:     record.customer || ref.musteri || "",
        kullanici:   record.scanned_by_username || "",
        taramaNotu:  record.aciklama            || "",
        stokAdi:     ref.stokAdi   || "",
        miktar:      ref.miktar    || "",
        koliAdet:    ref.koliAdet  || "",
        tarihLT:     ref.tarihLT   || "",
        tarih:       ref.tarih     || "",
        skt:         ref.skt       || "",
        aciklama:    ref.aciklama  || "",
        matched:     !!ref.stokAdi,
      };
      for (const col of extraCols) {
        row[col.id] = extras[col.label] || "";
      }
      for (const col of customFieldCols) {
        const v = getDynamicFieldValue(record, col.fieldId);
        row[col.id] = v !== undefined && v !== null ? String(v) : "";
      }
      return row;
    });
  }, [baseRecords, refTable, extraCols, customFieldCols]);

  // ── Kolon filtresi uygula ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return tableRows.filter(row =>
      Object.entries(colFilters).every(([colId, vals]) =>
        !vals?.size || vals.has(String(row[colId] ?? ""))
      )
    );
  }, [tableRows, colFilters]);

  // ── Toplamlar ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    miktar:   filteredRows.reduce((s, r) => s + (parseFloat(r.miktar)  || 0), 0),
    koliAdet: filteredRows.reduce((s, r) => s + (parseInt(r.koliAdet)  || 0), 0),
  }), [filteredRows]);

  const activeCols = useMemo(() => allCols.filter(c => visibleCols[c.id]), [allCols, visibleCols]);

  const meta     = getReferenceTableMeta();
  const hasTable = refTable && Object.keys(refTable).length > 0;
  const anyFilter = Object.values(colFilters).some(s => s?.size > 0);

  // ── Dosya parse ─────────────────────────────────────────────────────────────
  const parseFile = useCallback(async (file) => {
    if (!file) return;
    setUploadErr("");
    setUploading(true);
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb   = XLSX.read(data);
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) { setUploadErr("Dosya boş veya okunamadı."); setUploading(false); return; }
      const headers = Object.keys(rows[0]);
      setPendingRows(rows);
      setPendingHeaders(headers);
      const guessed = guessColMap(headers);
      setColMapDraft(guessed);
      // Önceden seçilmiş ekstra kolonları yükle (aynı dosya tekrar yüklenince hatırlansın)
      if (refColMap) {
        const prev = new Set(
          Object.keys(refColMap)
            .filter(k => k.startsWith("_extra_"))
            .map(k => k.slice(7))
        );
        setExtraSelected(prev);
      } else {
        setExtraSelected(new Set());
      }
      setShowMapper(true);
    } catch {
      setUploadErr("Dosya okunurken hata oluştu.");
    } finally {
      setUploading(false);
    }
  }, [refColMap]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    parseFile(e.dataTransfer?.files?.[0]);
  }, [parseFile]);

  // ── Mapper onayla ───────────────────────────────────────────────────────────
  const handleMapperConfirm = useCallback(() => {
    if (!colMapDraft.paletKodu) {
      setUploadErr("Palet Kodu kolonunu seçmelisiniz.");
      return;
    }
    // Seçili ekstra kolonları colMap'e ekle (header adı = kolon adı)
    const finalColMap = { ...colMapDraft };
    for (const header of extraSelected) {
      finalColMap[`_extra_${header}`] = header;
    }
    const table = buildTableFromRows(pendingRows, finalColMap);
    onRefTableSave(table, finalColMap);
    setShowMapper(false);
    setUploadErr("");
    setPendingRows([]);
    setPendingHeaders([]);
    setExtraSelected(new Set());
  }, [colMapDraft, extraSelected, pendingRows, onRefTableSave]);

  // ── Filtre yardımcıları ─────────────────────────────────────────────────────
  const getColUniqueVals = useCallback((colId) => {
    const vals = new Set(tableRows.map(r => String(r[colId] ?? "")));
    return [...vals].sort();
  }, [tableRows]);

  const toggleFilterVal = (colId, val) => {
    setColFilters(prev => {
      const cur = new Set(prev[colId] || []);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...prev, [colId]: cur };
    });
  };

  const clearColFilter   = (colId) => setColFilters(prev => { const n = { ...prev }; delete n[colId]; return n; });
  const selectAllFilter  = (colId) => setColFilters(prev => ({ ...prev, [colId]: new Set(getColUniqueVals(colId)) }));
  const hasFilter        = (colId) => colFilters[colId]?.size > 0;

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async (type) => {
    if (!filteredRows.length) {
      toast?.("Dışa aktarılacak kayıt yok", "var(--acc)");
      return;
    }
    const hdr  = activeCols.map(c => c.label);
    const data = filteredRows.map(r => activeCols.map(c => String(r[c.id] ?? "")));
    const filename = `rapor_${new Date().toISOString().slice(0, 10)}`;

    try {
      if (type === "xlsx") {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.aoa_to_sheet([hdr, ...data]);
        ws["!cols"] = hdr.map(() => ({ wch: 18 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapor");
        if (isNative()) {
          const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
          const fn = filename + ".xlsx";
          await Filesystem.writeFile({ path: fn, data: b64, directory: Directory.Cache });
          const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: fn });
          await Share.share({ title: "ScanDesk Rapor", url: uri });
          toast?.("Excel hazır (Paylaş)", "var(--ok)");
        } else {
          XLSX.writeFile(wb, filename + ".xlsx");
          toast?.("Excel indirildi", "var(--ok)");
        }
      } else {
        const csv = [hdr, ...data]
          .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
          .join("\n");
        if (isNative()) {
          const fn = filename + ".csv";
          await Filesystem.writeFile({ path: fn, data: "\uFEFF" + csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
          const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: fn });
          await Share.share({ title: "ScanDesk Rapor", url: uri });
          toast?.("CSV hazır (Paylaş)", "var(--ok)");
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
          a.download = filename + ".csv";
          a.click();
          toast?.("CSV indirildi", "var(--ok)");
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      toast?.("Dışa aktarma hatası: " + (err?.message || err), "var(--err)");
    }
  };

  // ── Yükleme alanı ──────────────────────────────────────────────────────────
  const UploadZone = ({ compact = false }) => (
    <div
      className={`rp-upload-zone${dragOver ? " rp-upload-zone--over" : ""}${compact ? " rp-upload-zone--compact" : ""}`}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <div className="rp-upload-icon">{uploading ? "⏳" : "📂"}</div>
      <div className="rp-upload-text">
        {uploading ? "Dosya okunuyor…"
          : compact ? "Yeni Excel/CSV yükle"
          : "Excel veya CSV dosyasını buraya sürükleyin"}
      </div>
      {!compact && <div className="rp-upload-sub">.xlsx ve .csv desteklenir</div>}
      <button
        className="btn btn-ok btn-sm"
        style={{ marginTop: 10 }}
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        Dosya Seç
      </button>
      {uploadErr && !showMapper && <div className="rp-upload-err">{uploadErr}</div>}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={e => { parseFile(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="page rp-page">

      {/* ── Üst Bar ── */}
      <div className="rp-topbar">
        <div className="rp-topbar-left">
          <span className="rp-title">Rapor</span>
          {meta && (
            <span className="rp-meta badge">
              {meta.count} palet yüklü — {fmtMetaDate(meta.updatedAt)} tarihli
            </span>
          )}
        </div>
        <div className="rp-topbar-right">
          {anyFilter && (
            <button className="btn btn-sm" style={{ color: "var(--acc)" }} onClick={() => setColFilters({})}>
              Filtreyi Temizle
            </button>
          )}
          {hasTable && (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => handleExport("csv")}>CSV</button>
              <button className="btn btn-sm btn-ghost" onClick={() => handleExport("xlsx")}>XLSX</button>
              <div style={{ position: "relative" }} id="rp-col-picker">
                <button className="btn btn-sm btn-ghost" onClick={() => setShowColPicker(p => !p)}>
                  Kolonlar ☰
                </button>
                {showColPicker && (
                  <div className="rp-col-picker-menu">
                    {allCols.map(c => (
                      <label key={c.id} className="rp-col-picker-item">
                        <input
                          type="checkbox"
                          checked={!!visibleCols[c.id]}
                          disabled={c.fixed}
                          onChange={() => {
                            if (c.fixed) return;
                            setVisibleCols(p => ({ ...p, [c.id]: !p[c.id] }));
                          }}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="btn btn-sm"
                style={{ color: "var(--err)" }}
                onClick={onRefTableClear}
              >
                Temizle
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tablo yoksa büyük yükleme alanı ── */}
      {!hasTable && <UploadZone />}

      {/* ── Tablo varsa ── */}
      {hasTable && (
        <>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  {activeCols.map(col => {
                    const active = hasFilter(col.id);
                    return (
                      <th
                        key={col.id}
                        ref={el => { filterRefs.current[col.id] = el; }}
                        className={`rp-th${active ? " rp-th--filtered" : ""}`}
                      >
                        <button
                          className="rp-th-btn"
                          onClick={e => {
                            e.stopPropagation();
                            setOpenFilter(p => p === col.id ? null : col.id);
                          }}
                        >
                          {col.label}
                          <span className="rp-th-arrow">{active ? "▲" : "▼"}</span>
                        </button>

                        {openFilter === col.id && (
                          <div className="rp-filter-popup" onClick={e => e.stopPropagation()}>
                            <div className="rp-filter-actions">
                              <button className="btn btn-sm btn-ghost" onClick={() => selectAllFilter(col.id)}>Tümü</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => clearColFilter(col.id)}>Temizle</button>
                            </div>
                            <div className="rp-filter-list">
                              {getColUniqueVals(col.id).map(val => (
                                <label key={val} className="rp-filter-item">
                                  <input
                                    type="checkbox"
                                    checked={colFilters[col.id]?.has(val) ?? false}
                                    onChange={() => toggleFilterVal(col.id, val)}
                                  />
                                  <span>{val === "" ? <em style={{ color: "var(--tx2)" }}>(boş)</em> : val}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeCols.length} style={{ textAlign: "center", padding: "24px", color: "var(--tx2)" }}>
                      Kayıt bulunamadı
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, i) => (
                    <tr key={i} className={row.matched ? "" : "rp-row--unmatched"}>
                      {activeCols.map(col => (
                        <td key={col.id} className="rp-td">{row[col.id]}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="rp-totals-row">
                    {activeCols.map(col => (
                      <td key={col.id} className="rp-td rp-td--total">
                        {col.id === "paletKodu"
                          ? `${filteredRows.length} kayıt`
                          : col.id === "miktar"
                            ? totals.miktar.toLocaleString("tr-TR", { maximumFractionDigits: 2 })
                            : col.id === "koliAdet"
                              ? totals.koliAdet
                              : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <UploadZone compact />
        </>
      )}

      {/* ── Kolon Eşleştirme Modal ── */}
      {showMapper && (
        <div className="rp-modal-overlay" onClick={() => setShowMapper(false)}>
          <div className="rp-modal" onClick={e => e.stopPropagation()}>
            <div className="rp-modal-title">Kolon Eşleştirme</div>
            <div className="rp-modal-sub">
              {pendingRows.length} satır okundu. Her alana karşılık gelen Excel kolonunu seçin.
            </div>

            {/* Standart alanlar */}
            <div className="rp-mapper-grid">
              {MAPPER_FIELDS.map(({ field, label, required }) => (
                <div key={field} className="rp-mapper-row">
                  <label className="rp-mapper-label">
                    {label}
                    {required && <span style={{ color: "var(--err)" }}> *</span>}
                  </label>
                  <select
                    className="rp-mapper-select"
                    value={colMapDraft[field] || ""}
                    onChange={e => setColMapDraft(p => ({ ...p, [field]: e.target.value || undefined }))}
                  >
                    <option value="">— Seçilmedi —</option>
                    {pendingHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Ekstra kolonlar — standart alanlara atanmamış tüm Excel sütunları */}
            {(() => {
              const usedHeaders = new Set(Object.values(colMapDraft).filter(Boolean));
              const freeHeaders = pendingHeaders.filter(h => !usedHeaders.has(h));
              if (!freeHeaders.length) return null;
              return (
                <>
                  <div className="rp-mapper-extras-hd">
                    Diğer Excel Sütunları
                    <span className="rp-mapper-extras-hint">tabloya eklemek istediklerinizi seçin</span>
                  </div>
                  <div className="rp-mapper-extras-list">
                    {freeHeaders.map(h => (
                      <label key={h} className="rp-mapper-extra-check">
                        <input
                          type="checkbox"
                          checked={extraSelected.has(h)}
                          onChange={() => {
                            setExtraSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(h)) next.delete(h); else next.add(h);
                              return next;
                            });
                          }}
                        />
                        <span>{h}</span>
                      </label>
                    ))}
                  </div>
                </>
              );
            })()}

            {uploadErr && <div className="rp-upload-err" style={{ marginTop: 8 }}>{uploadErr}</div>}
            <div className="rp-modal-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowMapper(false); setUploadErr(""); }}
              >
                İptal
              </button>
              <button className="btn btn-ok" onClick={handleMapperConfirm}>
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
