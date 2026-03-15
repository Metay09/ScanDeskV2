import { useState } from "react";
import { Ic, I } from "./Icon";

export default function PasswordInput({ value, onChange, placeholder, onKeyDown }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder || "Şifre"} style={{ paddingRight: 48 }} />
      <button type="button" onClick={() => setShow(p => !p)}
        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: "var(--tx2)" }}>
        <Ic d={show ? I.eyeOff : I.eye} s={18} />
      </button>
    </div>
  );
}
