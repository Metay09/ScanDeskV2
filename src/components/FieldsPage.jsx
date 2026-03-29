import { Ic, I } from "./Icon";
import { genId, FIELD_TYPES } from "../constants";

export default function FieldsPage({ fields, setFields, isAdmin, settings }) {
  if (!isAdmin) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 60, color: "var(--tx3)" }}>
      <Ic d={I.lock} s={44} />
      <p style={{ marginTop: 14, fontWeight: 700, color: "var(--tx2)" }}>Erişim Kısıtlandı</p>
      <p style={{ marginTop: 6, fontSize: 13 }}>Yalnızca admin kullanıcılar bu sayfaya erişebilir.</p>
    </div>
  );
  const add    = () => setFields(p => [...p, { id: genId(), label: "Yeni Alan", type: "Metin", required: false, locked: false }]);
  const remove = id => setFields(p => p.filter(f => f.id !== id));
  const upd    = (id, k, v) => setFields(p => p.map(f => f.id === id ? { ...f, [k]: v } : f));
  return (
    <div className="page">
      {settings.allowAddField && <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={add}><Ic d={I.plus} s={16} /> Alan Ekle</button>}
      {fields.map(f => (
        <div className="field-card" key={f.id}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 10 }}>
            <input value={f.label} disabled={f.locked || !settings.allowEditField} onChange={e => upd(f.id, "label", e.target.value)} style={{ height: 46, fontSize: 14, fontWeight: 600 }} />
            {!f.locked && settings.allowDeleteField && (
              <button className="btn btn-danger" style={{ height: 46, width: 46, padding: 0 }} onClick={() => remove(f.id)}><Ic d={I.del} s={15} /></button>
            )}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="tag">{f.id}</span>
            {f.locked && <span className="badge badge-acc">Kilitli</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="lbl">Tip</label>
              <select value={f.type} disabled={f.locked || !settings.allowEditField} onChange={e => upd(f.id, "type", e.target.value)} style={{ height: 46 }}>
                {FIELD_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label className="chk-row" style={{ height: 46 }}>
                <input type="checkbox" checked={f.required} disabled={f.locked} onChange={e => upd(f.id, "required", e.target.checked)} />
                <span>Zorunlu</span>
              </label>
            </div>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: "var(--tx3)", textAlign: "center", marginTop: 8 }}>Müşteri ve Kaydeden alanları her kayda otomatik eklenir.</p>
    </div>
  );
}
