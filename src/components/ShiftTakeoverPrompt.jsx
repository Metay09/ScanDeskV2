import { Ic, I } from "./Icon";

export default function ShiftTakeoverPrompt({ shift, onTakeover, onCancel }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <div className="modal-hd">
          <span className="modal-title"><Ic d={I.fields} s={16} />Yeni Vardiya</span>
        </div>
        <div className="modal-bd" style={{ textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Yeni vardiya başladı.</div>
          <div style={{ fontSize: 13, color: "var(--tx2)" }}>
            <b style={{ color: "var(--acc)" }}>{shift}</b> vardiyasını devralmak istiyor musunuz?
          </div>
        </div>
        <div className="modal-ft">
          <button
            className="btn btn-ok"
            style={{ flex: 1 }}
            onClick={onTakeover}
          >
            <Ic d={I.check} s={15} /> Devral
          </button>
          <button className="btn btn-ghost" style={{ width: 88 }} onClick={onCancel}>
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
