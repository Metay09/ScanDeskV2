import { useMemo, useState } from "react";
import { Ic, I } from "./Icon";
import Modal from "./Modal";

const DEFAULT_CUSTOMER = "-Boş-";

export default function CustomerModal({ customers, onClose, onAdd, onRemove, canManage = false, selectedCustomer = "", onSelect }) {
  const [newName, setNewName] = useState("");
  const list = useMemo(
    () => [DEFAULT_CUSTOMER, ...customers.filter(c => c && c !== DEFAULT_CUSTOMER)],
    [customers]
  );
  const add = () => {
    if (!canManage || !onAdd) return;
    const name = newName.trim();
    if (!name || name === DEFAULT_CUSTOMER) return;
    onAdd(name);
    onSelect?.(name);
    setNewName("");
  };
  const handleSelect = (name) => {
    onSelect?.(name === DEFAULT_CUSTOMER ? "" : name);
    onClose?.();
  };
  return (
    <Modal title="Müşteri Paneli" icon={I.group} onClose={onClose}>
      {canManage && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Yeni müşteri adı..." onKeyDown={e => e.key === "Enter" && add()} />
          <button className="btn btn-primary btn-sm" onClick={add}><Ic d={I.plus} s={15} /></button>
        </div>
      )}
      {list.length === 0 && <p style={{ color: "var(--tx3)", fontSize: 13, textAlign: "center" }}>Henüz müşteri eklenmedi</p>}
      {list.map(c => {
        const isDefault = c === DEFAULT_CUSTOMER;
        const isSelected = (selectedCustomer || "") === (isDefault ? "" : c);
        return (
        <div key={c}
          onClick={() => handleSelect(c)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            background: "var(--s2)",
            border: `1.5px solid ${isSelected ? "var(--inf)" : "var(--brd)"}`,
            borderRadius: "var(--r)", marginBottom: 8, cursor: "pointer" }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>{c}</span>
          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
            <button className={`btn btn-sm ${isSelected ? "btn-info" : "btn-ghost"}`} style={{ height: 30, padding: "0 10px" }}
              onClick={(e) => { e.stopPropagation(); handleSelect(c); }}>
              <Ic d={I.check} s={12} /> Seç
            </button>
            {canManage && !isDefault && (
              <button className="btn btn-danger btn-sm" style={{ height: 30, padding: "0 8px" }}
                onClick={(e) => { e.stopPropagation(); onRemove?.(c); }}>
                <Ic d={I.del} s={13} />
              </button>
            )}
          </div>
        </div>
      )})}
    </Modal>
  );
}
