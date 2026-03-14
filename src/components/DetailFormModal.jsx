import { useEffect, useRef } from "react";
import { Ic, I } from "./Icon";
import Modal from "./Modal";
import FieldInput from "./FieldInput";
import CustomerPicker from "./CustomerPicker";
import AciklamaPicker from "./AciklamaPicker";

export default function DetailFormModal({ barcode, fields, extras, onExtrasChange, customer, onCustomerChange, aciklama, onAciklamaChange, customerList, onCustomerAdd, onCustomerRemove, canManageCustomers, aciklamaList, onAciklamaAdd, onAciklamaRemove, onSave, onClose, onError }) {
  const firstFieldRef = useRef(null);

  // Auto-focus first field when modal opens
  useEffect(() => {
    if (firstFieldRef.current) {
      setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 100);
    }
  }, []);

  const validateAndSave = () => {
    const missing = fields.filter(f => f.required && !extras[f.id] && extras[f.id] !== 0);
    if (missing.length > 0) {
      const msg = `Zorunlu alanları doldurun: ${missing.map(f => f.label).join(", ")}`;
      if (onError) onError(msg, "var(--err)");
      return;
    }
    onSave();
  };

  // Handle Enter key navigation between fields
  const handleFieldKeyDown = (e, fieldIndex) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (fieldIndex < fields.length - 1) {
        // Move to next field
        const nextInput = e.target.closest('.modal-bd')?.querySelectorAll('input, select, textarea')[fieldIndex + 1];
        nextInput?.focus();
      } else {
        // Last field - save
        validateAndSave();
      }
    }
  };

  const footer = (
    <>
      <button className="btn btn-ok" style={{ flex: 1 }} onClick={validateAndSave}>
        <Ic d={I.save} s={16} /> Kaydet
      </button>
      <button className="btn btn-ghost" style={{ width: 88 }} onClick={onClose}>İptal</button>
    </>
  );

  return (
    <Modal title="Detay Ekle" icon={I.edit} onClose={onClose} footer={footer}>
      <div>
        <label className="lbl">Taranan Barkod</label>
        <div style={{
          padding: "10px 12px",
          background: "var(--s2)",
          border: "1.5px solid var(--brd)",
          borderRadius: "var(--r)",
          fontFamily: "var(--mono)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--acc)"
        }}>
          {barcode}
        </div>
      </div>
      {fields.map((f, i) => (
        <div key={f.id}>
          <label className="lbl">{f.label}{f.required ? " *" : ""}</label>
          <FieldInput
            ref={i === 0 ? firstFieldRef : null}
            field={f}
            value={extras[f.id] || ""}
            onChange={(v) => onExtrasChange(f.id, v)}
            onKeyDown={(e) => handleFieldKeyDown(e, i)}
          />
        </div>
      ))}
      {customerList && (
        <div>
          <CustomerPicker
            label="Müşteri"
            customers={customerList}
            value={customer || ""}
            onChange={onCustomerChange}
            canManage={canManageCustomers}
            onAdd={canManageCustomers ? onCustomerAdd : undefined}
            onRemove={canManageCustomers ? onCustomerRemove : undefined}
          />
        </div>
      )}
      <div>
        <AciklamaPicker
          label="Açıklama"
          aciklamalar={aciklamaList || []}
          value={aciklama || ""}
          onChange={onAciklamaChange}
          canManage={true}
          onAdd={onAciklamaAdd}
          onRemove={onAciklamaRemove}
        />
      </div>
    </Modal>
  );
}
