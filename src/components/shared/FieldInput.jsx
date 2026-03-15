import { forwardRef } from "react";

export default forwardRef(function FieldInput({ field, value, onChange, onKeyDown }, ref) {
  const handleChange = (e) => {
    const newValue = field.type === "Onay Kutusu" ? e.target.checked : e.target.value;
    onChange(newValue);
  };

  const isReadonly = field.readonly || false;

  if (field.type === "Onay Kutusu") {
    return (
      <label
        className="chk-row"
        style={{
          height: 48,
          border: "1.5px solid var(--brd)",
          borderRadius: "var(--r)",
          padding: "0 14px",
          background: "var(--s2)",
          opacity: isReadonly ? 0.6 : 1,
          cursor: isReadonly ? "not-allowed" : "pointer"
        }}
      >
        <input type="checkbox" checked={!!value} onChange={handleChange} onKeyDown={onKeyDown} ref={ref} disabled={isReadonly} />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.type === "Tarih") {
    return <input type="date" value={value || ""} onChange={handleChange} onKeyDown={onKeyDown} ref={ref} readOnly={isReadonly} style={isReadonly ? { opacity: 0.6, cursor: "not-allowed" } : {}} />;
  }

  if (field.type === "Sayı") {
    return <input type="number" inputMode="numeric" value={value || ""} onChange={handleChange} onKeyDown={onKeyDown} ref={ref} readOnly={isReadonly} style={isReadonly ? { opacity: 0.6, cursor: "not-allowed" } : {}} />;
  }

  return <input type="text" value={value || ""} onChange={handleChange} onKeyDown={onKeyDown} ref={ref} readOnly={isReadonly} style={isReadonly ? { opacity: 0.6, cursor: "not-allowed" } : {}} />;
});
