import { useMemo, useState } from "react";
import { Ic, I } from "./Icon";
import Modal from "./Modal";

const DEFAULT_ACIKLAMA = "-Boş-";

export default function AciklamaModal({ aciklamalar, onClose, onAdd, onRemove, canManage = false, selectedAciklama = "", onSelect }) {
  const [newName, setNewName] = useState("");
  const list = useMemo(
    () => [DEFAULT_ACIKLAMA, ...aciklamalar.filter(a => a && a !== DEFAULT_ACIKLAMA)],
    [aciklamalar]
  );
  const add = () => {
    if (!canManage || !onAdd) return;
    const name = newName.trim();
    if (!name || name === DEFAULT_ACIKLAMA) return;
    onAdd(name);
    onSelect?.(name);
    setNewName("");
  };
  const handleSelect = (name) => {
    onSelect?.(name === DEFAULT_ACIKLAMA ? "" : name);
    onClose?.();
  };
  return (
    <Modal title="Açıklama Paneli" icon={I.edit} onClose={onClose}>
      {canManage && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Yeni açıklama..." onKeyDown={e => e.key === "Enter" && add()} />
          <button className="btn btn-primary btn-sm" onClick={add}><Ic d={I.plus} s={15} /></button>
        </div>
      )}
      {list.length === 0 && <p style={{ color: "var(--tx3)", fontSize: 13, textAlign: "center" }}>Henüz açıklama eklenmedi</p>}
      {list.map(a => {
        const isDefault = a === DEFAULT_ACIKLAMA;
        const isSelected = (selectedAciklama || "") === (isDefault ? "" : a);
        return (
          <div key={a}
            onClick={() => handleSelect(a)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
              background: "var(--s2)",
              border: `1.5px solid ${isSelected ? "var(--inf)" : "var(--brd)"}`,
              borderRadius: "var(--r)", marginBottom: 8, cursor: "pointer" }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>{a}</span>
            <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className={`btn btn-sm ${isSelected ? "btn-info" : "btn-ghost"}`} style={{ height: 30, padding: "0 10px" }}
                onClick={(e) => { e.stopPropagation(); handleSelect(a); }}>
                <Ic d={I.check} s={12} /> Seç
              </button>
              {canManage && !isDefault && (
                <button className="btn btn-danger btn-sm" style={{ height: 30, padding: "0 8px" }}
                  onClick={(e) => { e.stopPropagation(); onRemove?.(a); }}>
                  <Ic d={I.del} s={13} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}
