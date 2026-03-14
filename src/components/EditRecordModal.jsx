import { Ic, I } from "./Icon";
import Modal from "./Modal";
import FieldInput from "./FieldInput";
import CustomerPicker from "./CustomerPicker";
import { useFormState } from "../hooks/useFormState";
import { getCustomerList } from "../utils";
import { getDynamicFieldValue, setDynamicFieldValue } from "../services/recordModel";

export default function EditRecordModal({ record, fields, customers, onSave, onClose, canManageCustomers = false }) {
  const [form, set] = useFormState({ ...record });
  const allF = [{ id: "barcode", label: "Barkod", type: "Metin", readonly: true }, ...fields.filter(f => f.id !== "barcode" && f.id !== "note")];
  const customerList = getCustomerList(customers);
  const normalizeCustomer = (val) => val === "-Boş-" ? "" : val;

  // Handler to set dynamic field values in customFields
  const setFieldValue = (fieldId, value) => {
    if (fieldId === "barcode" || fieldId === "customer" || fieldId === "aciklama") {
      // Fixed fields go to root
      set(fieldId, value);
    } else {
      // Dynamic fields go to customFields
      const updated = setDynamicFieldValue(form, fieldId, value);
      set("customFields", updated.customFields);
    }
  };

  // Helper to get field value (supports both customFields and root level)
  const getFieldValue = (fieldId) => {
    if (fieldId === "barcode" || fieldId === "customer" || fieldId === "aciklama") {
      return form[fieldId];
    }
    return getDynamicFieldValue(form, fieldId);
  };

  const footer = (
    <>
      <button className="btn btn-ok" style={{ flex: 1 }} onClick={() => { onSave(form); onClose(); }}>
        <Ic d={I.save} s={16} /> Güncelle
      </button>
      <button className="btn btn-ghost" style={{ width: 88 }} onClick={onClose}>İptal</button>
    </>
  );

  return (
    <Modal title="Kaydı Düzenle" icon={I.edit} onClose={onClose} footer={footer}>
      {allF.map(f => (
        <div key={f.id}>
          <label className="lbl">{f.label}</label>
          <FieldInput field={f} value={getFieldValue(f.id)} onChange={(v) => setFieldValue(f.id, v)} />
        </div>
      ))}
      <div>
        <CustomerPicker
          label="Müşteri"
          customers={customerList}
          value={form.customer || ""}
          onChange={name => set("customer", normalizeCustomer(name))}
          canManage={canManageCustomers}
          onAdd={canManageCustomers ? customers?.add : undefined}
          onRemove={canManageCustomers ? customers?.remove : undefined}
        />
      </div>
      {/* Açıklama field (styled like customer) */}
      <div style={{ width: "100%" }}>
        <label className="lbl" style={{ marginBottom: 4, fontSize: 12 }}>Açıklama</label>
        <input
          type="text"
          value={form.aciklama || ""}
          onChange={(e) => set("aciklama", e.target.value)}
          placeholder="Açıklama girin..."
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
          }}
        />
      </div>
      <div style={{ padding: "9px 12px", background: "var(--pur2)", border: "1.5px solid var(--pur3)", borderRadius: "var(--r)", fontSize: 12, color: "var(--pur)", display: "flex", alignItems: "center", gap: 7 }}>
        <Ic d={I.sig} s={13} /> Kaydeden: <b>{form.scanned_by}</b>
      </div>
      {form.source === "shift_takeover" && (
        <div style={{ padding: "9px 12px", background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: "var(--r)", fontSize: 12, color: "var(--tx2)", display: "flex", alignItems: "center", gap: 7 }}>
          <Ic d={I.upload} s={13} /> Bu kayıt devralındı
        </div>
      )}
    </Modal>
  );
}
