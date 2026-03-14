import { useState } from "react";
import CustomerModal from "./CustomerModal";
import { Ic, I } from "./Icon";

export default function CustomerPicker({
  label = "Müşteri",
  customers = [],
  value = "",
  onChange,
  onClose,
  canManage = false,
  onAdd,
  onRemove,
}) {
  const [open, setOpen] = useState(false);
  const display = value ? value : "(Boş)";

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleSelect = (name) => {
    onChange?.(name);
    handleClose();
  };

  return (
    <div style={{ width: "100%" }}>
      {label && <label className="lbl" style={{ marginBottom: 4, fontSize: 12 }}>{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          height: 40,
          borderRadius: 10,
          padding: "0 12px",
          background: "var(--s2)",
          color: "var(--tx)",
          border: "1.5px solid var(--brd)",
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer"
        }}
        title="Müşteri seç"
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Ic d={I.group} s={14} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: value ? "var(--tx)" : "var(--tx3)" }}>
            {value ? display : "Müşteri seç"}
          </span>
        </span>
        <Ic d={I.chevD} s={15} />
      </button>
      {open && (
        <CustomerModal
          customers={customers}
          selectedCustomer={value || ""}
          onSelect={handleSelect}
          onClose={handleClose}
          canManage={canManage}
          onAdd={canManage ? onAdd : undefined}
          onRemove={canManage ? onRemove : undefined}
        />
      )}
    </div>
  );
}
