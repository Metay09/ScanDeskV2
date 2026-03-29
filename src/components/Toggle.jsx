export default function Toggle({ value, onChange, disabled }) {
  return (
    <button type="button" className="tog" onClick={() => !disabled && onChange(!value)}
      style={{ background: value ? "var(--acc)" : "var(--s3)", border: "1.5px solid var(--brd2)", opacity: disabled ? .4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <div className="tog-k" style={{ left: value ? 27 : 3 }} />
    </button>
  );
}
