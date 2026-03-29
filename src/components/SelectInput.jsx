export default function SelectInput({ value, onChange, options, placeholder = "Tüm Seçenekler", style = {} }) {
  const defaultStyle = {
    height: 40,
    borderRadius: 10,
    padding: "0 10px",
    background: "var(--s2)",
    color: "var(--tx)",
    border: "1.5px solid var(--brd)",
    fontSize: 12,
    fontWeight: 600,
    ...style
  };

  return (
    <select value={value} onChange={onChange} style={defaultStyle}>
      <option value="all">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value ?? opt} value={opt.value ?? opt}>
          {opt.label ?? opt}
        </option>
      ))}
    </select>
  );
}
