import { Ic, I } from "./Icon";
import Modal from "./Modal";
import FieldInput from "./FieldInput";
import CustomerPicker from "./CustomerPicker";
import AciklamaPicker from "./AciklamaPicker";
import { useFormState } from "../hooks/useFormState";
import { getCustomerList, getAciklamaList } from "../utils";
import { getDynamicFieldValue, setDynamicFieldValue } from "../services/recordModel";

export default function EditRecordModal({ record, fields, customers, aciklamalar, onSave, onClose, canManageCustomers = false }) {
  const [form, set] = useFormState({ ...record });
  const allF = [{ id: "barcode", label: "Barkod", type: "Metin", readonly: true }, ...fields.filter(f => f.id !== "barcode" && f.id !== "note")];
  const customerList = getCustomerList(customers);
  const aciklamaList = getAciklamaList(aciklamalar);
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
      <div>
        <AciklamaPicker
          label="Açıklama"
          aciklamalar={aciklamaList}
          value={form.aciklama || ""}
          onChange={val => set("aciklama", val)}
          canManage={true}
          onAdd={aciklamalar?.add}
          onRemove={aciklamalar?.remove}
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
