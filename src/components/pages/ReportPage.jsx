import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Ic, I } from "../ui/Icon";
import { FIXED_SHIFTS, getShiftDate, deriveShiftDate } from "../../utils";
import { getDynamicFieldValue } from "../../services/recordModel";

// ── Renk paleti ──────────────────────────────────────────────────────────────
const PALETTE = [
  "#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
  "#8b5cf6", "#f43f5e", "#10b981", "#0ea5e9", "#d946ef",
];

// ── SVG Pasta Grafik ──────────────────────────────────────────────────────────
function PieChart({ data = [], size = 186 }) {
  const [hovered, setHovered] = useState(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 7;

  // Tek dilim → tam daire
  if (data.length === 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block", flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r}
          fill={data[0].color || PALETTE[0]}
          stroke="var(--s1)" strokeWidth={3} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fill="#000" fontSize={14} fontWeight={800} fontFamily="var(--font)">
          100%
        </text>
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const sweep    = (d.value / total) * 2 * Math.PI;
    const endAngle = angle + sweep;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const lg   = sweep > Math.PI ? 1 : 0;
    const path = `M${cx},${cy}L${x1.toFixed(3)},${y1.toFixed(3)}A${r},${r},0,${lg},1,${x2.toFixed(3)},${y2.toFixed(3)}Z`;
    const pct  = ((d.value / total) * 100).toFixed(1);
    angle = endAngle;
    return { ...d, path, pct, idx: i };
  });

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", flexShrink: 0 }}>
      {slices.map((s, i) => (
        <path key={i} d={s.path}
          fill={s.color || PALETTE[i % PALETTE.length]}
          opacity={hovered === null || hovered === i ? 1 : 0.42}
          stroke="var(--s1)" strokeWidth={2.5}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: "default", transition: "opacity .12s" }}
        />
      ))}
      {hov && (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
            fill="var(--tx)" fontSize={14} fontWeight={800} fontFamily="var(--font)">
            {hov.pct}%
          </text>
          <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle"
            fill="var(--tx2)" fontSize={10} fontFamily="var(--font)">
            {Number(hov.value).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
          </text>
        </>
      )}
    </svg>
  );
}

// ── Çoklu Seçim Açılır Menü ───────────────────────────────────────────────────
function MultiSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (v) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  const displayLabel =
    value.length === 0
      ? placeholder
      : value.map(v => options.find(o => o.value === v)?.label ?? v).join(", ");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height: 42,
          background: "var(--s2)",
          border: "1.5px solid " + (open ? "var(--acc)" : "var(--brd)"),
          boxShadow: open ? "0 0 0 3px var(--acc2)" : "none",
          borderRadius: "var(--r)",
          padding: "0 12px",
          color: value.length === 0 ? "var(--tx3)" : "var(--tx)",
          fontFamily: "var(--font)", fontSize: 14,
          textAlign: "left", cursor: "pointer",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8,
          transition: ".12s border-color, box-shadow",
        }}
      >
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", flex: 1,
        }}>
          {displayLabel}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {value.length > 0 && (
            <span style={{
              background: "var(--acc)", color: "#000",
              fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "1px 6px",
            }}>
              {value.length}
            </span>
          )}
          <Ic d={I.chevD} s={14} />
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--s1)", border: "1.5px solid var(--brd)",
          borderRadius: "var(--r)", zIndex: 150,
          maxHeight: 240, overflowY: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,.38)",
        }}>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{
                width: "100%", padding: "9px 12px",
                background: "none", border: "none",
                borderBottom: "1px solid var(--brd)",
                color: "var(--err)", fontSize: 12, fontWeight: 700,
                textAlign: "left", cursor: "pointer", fontFamily: "var(--font)",
              }}
            >
              × Seçimi Temizle
            </button>
          )}
          {options.map(opt => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => toggle(opt.value)}
                style={{
                  width: "100%", padding: "8px 12px",
                  background: checked ? "var(--acc2)" : "none",
                  border: "none", borderBottom: "1px solid var(--brd)",
                  color: checked ? "var(--acc)" : "var(--tx)",
                  fontSize: 13, fontWeight: checked ? 700 : 400,
                  textAlign: "left", cursor: "pointer",
                  fontFamily: "var(--font)",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{
                  width: 16, height: 16, flexShrink: 0,
                  border: "1.5px solid " + (checked ? "var(--acc)" : "var(--brd)"),
                  borderRadius: 4,
                  background: checked ? "var(--acc)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <Ic d={I.check} s={10} sw={3} />}
                </span>
                <span style={{
                  flex: 1, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {opt.label}
                </span>
                <span style={{
                  fontSize: 11, color: "var(--tx3)", flexShrink: 0,
                  fontFamily: "var(--mono)",
                }}>
                  {opt.count}
                </span>
              </button>
            );
          })}
          {options.length === 0 && (
            <div style={{
              padding: 14, fontSize: 13,
              color: "var(--tx3)", textAlign: "center",
            }}>
              Seçenek yok
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Yatay Bar Grafik (CSS) ────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value));
  if (max === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 3,
          }}>
            <span style={{
              fontSize: 12, color: "var(--tx2)", fontWeight: 600,
              flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {d.label || "— Boş —"}
            </span>
            <span style={{
              fontSize: 12, fontFamily: "var(--mono)", fontWeight: 700,
              color: d.color || PALETTE[i % PALETTE.length],
              flexShrink: 0, marginLeft: 10,
            }}>
              {Number(d.value).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{
            height: 8, background: "var(--s3)",
            borderRadius: 4, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${(d.value / max) * 100}%`,
              background: d.color || PALETTE[i % PALETTE.length],
              borderRadius: 4,
              transition: "width .35s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bölüm Başlığı ─────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "var(--tx2)",
      textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

// ── Panel Kartı ───────────────────────────────────────────────────────────────
function Panel({ children, style }) {
  return (
    <div style={{
      background: "var(--s1)", border: "1.5px solid var(--brd)",
      borderRadius: "var(--r2)", padding: 16, marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ═════════════════════════════════════════════════════════════════════════════
export default function ReportPage({ records, fields, isAdmin, currentShift, user }) {
  const currentShiftDate = getShiftDate(undefined, currentShift);

  // ── Filtre state ──
  const [dateFrom,           setDateFrom]           = useState("");
  const [dateTo,             setDateTo]             = useState("");
  const [selectedShifts,     setSelectedShifts]     = useState([]);
  const [selectedCustomers,  setSelectedCustomers]  = useState([]);
  const [selectedAciklamalar,setSelectedAciklamalar]= useState([]);
  const [dynFilters,         setDynFilters]         = useState({});
  // "count" veya bir sayısal alan id'si
  const [chartMode, setChartMode] = useState("count");

  // ── Alan sınıflandırması ──
  const dynamicFields  = useMemo(() => fields.filter(f => f.id !== "barcode"), [fields]);
  const numericFields  = useMemo(() => dynamicFields.filter(f => f.type === "Sayı"),        [dynamicFields]);
  const textFields     = useMemo(() => dynamicFields.filter(f => f.type === "Metin"),       [dynamicFields]);
  const checkboxFields = useMemo(() => dynamicFields.filter(f => f.type === "Onay Kutusu"),[dynamicFields]);
  const dateFieldsDyn  = useMemo(() => dynamicFields.filter(f => f.type === "Tarih"),       [dynamicFields]);

  // ── Temel kayıtlar (rol filtresi) ──
  const baseRecords = useMemo(() => {
    if (isAdmin) return records;
    return records.filter(r =>
      r.scanned_by_username === user?.username &&
      r.shift === currentShift &&
      deriveShiftDate(r) === currentShiftDate
    );
  }, [records, isAdmin, currentShift, currentShiftDate, user?.username]);

  // ── Filtre seçenekleri (temel kayıtlardan) ──
  const customerOptions = useMemo(() => {
    const counts = {};
    baseRecords.forEach(r => {
      const k = r.customer ?? "";
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, count]) => ({ value: v, label: v || "— Boş —", count }));
  }, [baseRecords]);

  const aciklamaOptions = useMemo(() => {
    const counts = {};
    baseRecords.forEach(r => {
      const k = r.aciklama ?? "";
      if (k !== "") counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, count]) => ({ value: v, label: v, count }));
  }, [baseRecords]);

  // ── Filtrelenmiş kayıtlar ──
  const filteredRecords = useMemo(() => {
    return baseRecords.filter(r => {
      // Tarih aralığı (yalnızca admin)
      if (isAdmin && (dateFrom || dateTo)) {
        const rd = deriveShiftDate(r);
        if (dateFrom && rd < dateFrom) return false;
        if (dateTo   && rd > dateTo)   return false;
      }
      // Vardiya filtresi (yalnızca admin, seçim yapıldıysa)
      if (isAdmin && selectedShifts.length > 0 && !selectedShifts.includes(r.shift))
        return false;
      // Müşteri filtresi
      if (selectedCustomers.length > 0 && !selectedCustomers.includes(r.customer ?? ""))
        return false;
      // Açıklama filtresi
      if (selectedAciklamalar.length > 0 && !selectedAciklamalar.includes(r.aciklama ?? ""))
        return false;
      // Dinamik alan filtreleri
      for (const f of dynamicFields) {
        const fv = dynFilters[f.id];
        if (!fv) continue;
        const rv = getDynamicFieldValue(r, f.id);

        if (f.type === "Metin") {
          if (fv && !String(rv ?? "").toLowerCase().includes(String(fv).toLowerCase()))
            return false;
        } else if (f.type === "Sayı") {
          if (!fv.min && !fv.max) continue;
          const num = Number(rv ?? 0);
          if (fv.min !== "" && fv.min != null && num < Number(fv.min)) return false;
          if (fv.max !== "" && fv.max != null && num > Number(fv.max)) return false;
        } else if (f.type === "Onay Kutusu") {
          if (!fv || fv === "all") continue;
          const bool = rv === true || rv === "true" || rv === 1;
          if (fv === "true"  && !bool) return false;
          if (fv === "false" &&  bool) return false;
        } else if (f.type === "Tarih") {
          if (!fv || (!fv.from && !fv.to)) continue;
          const dv = String(rv ?? "");
          if (fv.from && dv < fv.from) return false;
          if (fv.to   && dv > fv.to)   return false;
        }
      }
      return true;
    });
  }, [
    baseRecords, isAdmin, dateFrom, dateTo, selectedShifts,
    selectedCustomers, selectedAciklamalar, dynamicFields, dynFilters,
  ]);

  // ── Özet istatistikler ──
  const stats = useMemo(() => {
    const uCustomers = new Set(filteredRecords.map(r => r.customer ?? "")).size;
    const uShifts    = new Set(filteredRecords.map(r => r.shift)).size;
    const dates      = filteredRecords.map(r => deriveShiftDate(r)).filter(Boolean).sort();
    const minD       = dates[0] ?? null;
    const maxD       = dates[dates.length - 1] ?? null;
    const dateRange  = !minD ? "—" : minD === maxD ? minD : `${minD} – ${maxD}`;
    return { total: filteredRecords.length, uCustomers, uShifts, dateRange };
  }, [filteredRecords]);

  // ── Pasta grafik verisi ──
  const pieData = useMemo(() => {
    const field = numericFields.find(f => f.id === chartMode);
    const map = {};
    filteredRecords.forEach(r => {
      const k = r.customer ?? "";
      if (chartMode === "count") {
        map[k] = (map[k] || 0) + 1;
      } else if (field) {
        const v = Number(getDynamicFieldValue(r, chartMode) ?? 0);
        if (!isNaN(v)) map[k] = (map[k] || 0) + v;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label: label || "— Boş —",
        value,
        color: PALETTE[i % PALETTE.length],
      }));
  }, [filteredRecords, chartMode, numericFields]);

  // ── Sayısal alan toplamları ──
  const numericTotals = useMemo(() => {
    return numericFields.map(f => {
      const byCustomer = {};
      let total = 0;
      filteredRecords.forEach(r => {
        const v = Number(getDynamicFieldValue(r, f.id) ?? 0);
        if (!isNaN(v)) {
          total += v;
          const k = r.customer ?? "";
          byCustomer[k] = (byCustomer[k] || 0) + v;
        }
      });
      const arr = Object.entries(byCustomer)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({
          label: label || "— Boş —",
          value,
          color: PALETTE[i % PALETTE.length],
        }));
      return { field: f, total, byCustomer: arr };
    });
  }, [filteredRecords, numericFields]);

  // ── Yardımcı fonksiyonlar ──
  const updateDynFilter = useCallback((fid, val) => {
    setDynFilters(p => ({ ...p, [fid]: val }));
  }, []);

  const toggleShift = (s) =>
    setSelectedShifts(p =>
      p.includes(s) ? p.filter(x => x !== s) : [...p, s]
    );

  const hasActiveFilters = !!(
    dateFrom || dateTo ||
    selectedShifts.length ||
    selectedCustomers.length ||
    selectedAciklamalar.length ||
    Object.values(dynFilters).some(v => {
      if (!v) return false;
      if (typeof v === "object") return Object.values(v).some(x => x !== "" && x != null);
      return v !== "all" && v !== "";
    })
  );

  const resetFilters = () => {
    setDateFrom(""); setDateTo("");
    setSelectedShifts([]);
    setSelectedCustomers([]);
    setSelectedAciklamalar([]);
    setDynFilters({});
  };

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="page">

      {/* ── Sayfa başlığı ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
      }}>
        <div style={{
          width: 38, height: 38, flexShrink: 0,
          background: "var(--pur2)", border: "1.5px solid var(--pur3)",
          borderRadius: "var(--r)", color: "var(--pur)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Ic d={I.report} s={19} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Rapor</div>
          <div style={{ fontSize: 11, color: "var(--tx2)" }}>
            {filteredRecords.length} / {baseRecords.length} kayıt gösteriliyor
            {!isAdmin && (
              <span style={{ marginLeft: 6, color: "var(--inf)", fontWeight: 700 }}>
                · {currentShift} vardiyası
              </span>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <button
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: "auto" }}
            onClick={resetFilters}
          >
            <Ic d={I.x} s={13} /> Filtreleri Temizle
          </button>
        )}
      </div>

      {/* ── Filtre Paneli ───────────────────────────────────── */}
      <Panel>
        <SectionTitle>Filtreler</SectionTitle>

        {/* Tarih aralığı — yalnızca admin */}
        {isAdmin && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 10, marginBottom: 10,
          }}>
            <div>
              <label className="lbl">Başlangıç Tarihi</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ height: 42 }}
              />
            </div>
            <div>
              <label className="lbl">Bitiş Tarihi</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ height: 42 }}
              />
            </div>
          </div>
        )}

        {/* Vardiya seçimi — yalnızca admin */}
        {isAdmin && (
          <div style={{ marginBottom: 10 }}>
            <label className="lbl">Vardiya</label>
            <div style={{ display: "flex", gap: 6 }}>
              {FIXED_SHIFTS.map(s => {
                const active = selectedShifts.includes(s.label);
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => toggleShift(s.label)}
                    style={{
                      flex: 1, height: 38, borderRadius: "var(--r)",
                      border: "1.5px solid " + (active ? "var(--inf3)" : "var(--brd)"),
                      background: active ? "var(--inf2)" : "var(--s2)",
                      color: active ? "var(--inf)" : "var(--tx2)",
                      fontFamily: "var(--font)", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", transition: ".1s",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Müşteri + Açıklama */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: dynamicFields.length > 0 ? 10 : 0,
        }}>
          <div>
            <label className="lbl">Müşteri</label>
            <MultiSelect
              options={customerOptions}
              value={selectedCustomers}
              onChange={setSelectedCustomers}
              placeholder="Tümü"
            />
          </div>
          <div>
            <label className="lbl">Açıklama</label>
            <MultiSelect
              options={aciklamaOptions}
              value={selectedAciklamalar}
              onChange={setSelectedAciklamalar}
              placeholder="Tümü"
            />
          </div>
        </div>

        {/* Dinamik alan filtreleri */}
        {dynamicFields.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 10,
          }}>
            {/* Metin alanları → arama */}
            {textFields.map(f => (
              <div key={f.id}>
                <label className="lbl">{f.label}</label>
                <input
                  type="text"
                  placeholder="Ara..."
                  value={dynFilters[f.id] || ""}
                  onChange={e => updateDynFilter(f.id, e.target.value)}
                  style={{ height: 42 }}
                />
              </div>
            ))}

            {/* Sayı alanları → min/max */}
            {numericFields.map(f => (
              <div key={f.id}>
                <label className="lbl">{f.label} (Min / Max)</label>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={dynFilters[f.id]?.min ?? ""}
                    onChange={e =>
                      updateDynFilter(f.id, { ...(dynFilters[f.id] || {}), min: e.target.value })
                    }
                    style={{ height: 42 }}
                  />
                  <span style={{
                    color: "var(--tx3)", flexShrink: 0,
                    fontSize: 16, lineHeight: 1,
                  }}>–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={dynFilters[f.id]?.max ?? ""}
                    onChange={e =>
                      updateDynFilter(f.id, { ...(dynFilters[f.id] || {}), max: e.target.value })
                    }
                    style={{ height: 42 }}
                  />
                </div>
              </div>
            ))}

            {/* Onay kutusu alanları → Tümü / Evet / Hayır */}
            {checkboxFields.map(f => (
              <div key={f.id}>
                <label className="lbl">{f.label}</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["all", "Tümü"], ["true", "Evet"], ["false", "Hayır"]].map(([v, l]) => {
                    const active = (dynFilters[f.id] || "all") === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => updateDynFilter(f.id, v)}
                        style={{
                          flex: 1, height: 38, borderRadius: "var(--r)",
                          border: "1.5px solid " + (active ? "var(--acc3)" : "var(--brd)"),
                          background: active ? "var(--acc2)" : "var(--s2)",
                          color: active ? "var(--acc)" : "var(--tx2)",
                          fontFamily: "var(--font)", fontSize: 12, fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Tarih alanları → tarih aralığı */}
            {dateFieldsDyn.map(f => (
              <div key={f.id} style={{ gridColumn: "span 2" }}>
                <label className="lbl">{f.label} Aralığı</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <input
                    type="date"
                    value={dynFilters[f.id]?.from || ""}
                    onChange={e =>
                      updateDynFilter(f.id, { ...(dynFilters[f.id] || {}), from: e.target.value })
                    }
                    style={{ height: 42 }}
                  />
                  <input
                    type="date"
                    value={dynFilters[f.id]?.to || ""}
                    onChange={e =>
                      updateDynFilter(f.id, { ...(dynFilters[f.id] || {}), to: e.target.value })
                    }
                    style={{ height: 42 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Boş durum ──────────────────────────────────────── */}
      {filteredRecords.length === 0 ? (
        <div className="empty-state">
          <Ic d={I.report} s={38} />
          <p style={{ marginTop: 10, fontSize: 14 }}>
            {baseRecords.length === 0
              ? "Henüz kayıt bulunmuyor"
              : "Seçilen filtrelere uygun kayıt yok"}
          </p>
          {hasActiveFilters && (
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginTop: 12 }}
              onClick={resetFilters}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── İstatistik Kartları ─────────────────────────── */}
          <div
            className="stats-row"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
              marginBottom: 16,
            }}
          >
            <div className="stat">
              <div className="stat-val" style={{ color: "var(--acc)" }}>
                {stats.total}
              </div>
              <div className="stat-lbl">Toplam</div>
            </div>

            <div className="stat">
              <div className="stat-val" style={{ color: "var(--inf)" }}>
                {stats.uCustomers}
              </div>
              <div className="stat-lbl">Müşteri</div>
            </div>

            {isAdmin && (
              <div className="stat">
                <div className="stat-val" style={{ color: "var(--ok)" }}>
                  {stats.uShifts}
                </div>
                <div className="stat-lbl">Vardiya</div>
              </div>
            )}

            {/* Sayısal alan toplamları */}
            {numericTotals.map(nt => (
              <div key={nt.field.id} className="stat">
                <div
                  className="stat-val"
                  style={{
                    color: "var(--pur)",
                    fontSize: nt.total >= 100000 ? 12 : nt.total >= 10000 ? 14 : 18,
                  }}
                >
                  {nt.total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                </div>
                <div className="stat-lbl">{nt.field.label} ∑</div>
              </div>
            ))}

            {/* Tarih aralığı */}
            {stats.dateRange !== "—" && (
              <div className="stat" style={{ gridColumn: "span 2" }}>
                <div
                  className="stat-val"
                  style={{ fontSize: 11, color: "var(--tx2)", fontFamily: "var(--mono)" }}
                >
                  {stats.dateRange}
                </div>
                <div className="stat-lbl">Tarih Aralığı</div>
              </div>
            )}
          </div>

          {/* ── Grafik Modu Seçici ──────────────────────────── */}
          {numericFields.length > 0 && (
            <div style={{
              display: "flex", gap: 6, marginBottom: 14,
              flexWrap: "wrap", alignItems: "center",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--tx2)",
                textTransform: "uppercase", letterSpacing: ".07em",
                marginRight: 4, flexShrink: 0,
              }}>
                Pasta:
              </span>
              {[
                { id: "count", label: "Kayıt Sayısı" },
                ...numericFields.map(f => ({ id: f.id, label: f.label })),
              ].map(opt => {
                const active = chartMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChartMode(opt.id)}
                    style={{
                      height: 30, padding: "0 12px", borderRadius: "var(--r)",
                      border: "1.5px solid " + (active ? "var(--pur3)" : "var(--brd)"),
                      background: active ? "var(--pur2)" : "var(--s2)",
                      color: active ? "var(--pur)" : "var(--tx2)",
                      fontFamily: "var(--font)", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", transition: ".1s",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Pasta Grafik + Lejant ───────────────────────── */}
          {pieData.length > 0 && (
            <Panel>
              <SectionTitle>
                {chartMode === "count"
                  ? "Müşteri Bazında Kayıt Dağılımı"
                  : `${numericFields.find(f => f.id === chartMode)?.label ?? ""} — Müşteri Dağılımı`}
              </SectionTitle>

              <div style={{
                display: "flex", gap: 24,
                alignItems: "flex-start", flexWrap: "wrap",
              }}>
                <PieChart data={pieData} size={186} />

                {/* Lejant */}
                <div style={{
                  flex: 1, minWidth: 160, alignSelf: "center",
                  display: "flex", flexDirection: "column", gap: 9,
                }}>
                  {pieData.map((d, i) => {
                    const pct = pieTotal
                      ? ((d.value / pieTotal) * 100).toFixed(1)
                      : "0";
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: 3,
                          background: d.color, flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: 12, color: "var(--tx)", flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {d.label}
                        </span>
                        <span style={{
                          fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700,
                          color: "var(--tx2)", flexShrink: 0, whiteSpace: "nowrap",
                        }}>
                          {Number(d.value).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                          {" "}
                          <span style={{ color: "var(--tx3)", fontWeight: 500 }}>
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}

          {/* ── Sayısal Alan Toplamları (Bar Grafik) ────────── */}
          {numericTotals.length > 0 && (
            <Panel style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <SectionTitle>Sayısal Alan Toplamları — Müşteri Bazında</SectionTitle>

              {numericTotals.map(nt => (
                <div key={nt.field.id}>
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>
                      {nt.field.label}
                    </span>
                    <span style={{
                      fontSize: 13, fontFamily: "var(--mono)", fontWeight: 800,
                      color: "var(--pur)", background: "var(--pur2)",
                      border: "1px solid var(--pur3)",
                      borderRadius: 8, padding: "2px 10px",
                    }}>
                      ∑ {nt.total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {nt.byCustomer.length > 0
                    ? <BarChart data={nt.byCustomer} />
                    : (
                      <div style={{ fontSize: 12, color: "var(--tx3)" }}>
                        Veri yok
                      </div>
                    )}

                  {/* Separator (son eleman değilse) */}
                  {numericTotals[numericTotals.length - 1].field.id !== nt.field.id && (
                    <div style={{
                      marginTop: 20, borderTop: "1px solid var(--brd)",
                    }} />
                  )}
                </div>
              ))}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
