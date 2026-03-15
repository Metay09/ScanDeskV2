import { useState } from "react";
import { Ic, I } from "../ui/Icon";
import PasswordInput from "../ui/PasswordInput";
import { hashPassword, verifyPassword } from "../../utils";

export default function Login({ users, onLogin, onMigratePassword, logoutReason }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const goAuth = async () => {
    const found = users.find(x => x.username === u && x.active !== false);
    if (!found) { setErr("Kullanıcı adı veya şifre hatalı."); return; }
    const ok = await verifyPassword(p, found.password);
    if (!ok) { setErr("Kullanıcı adı veya şifre hatalı."); return; }
    // migrate plaintext → hash if needed
    if (!found.password.startsWith("pbkdf2:")) {
      const hashed = await hashPassword(p);
      onMigratePassword?.(found.id, hashed);
    }
    onLogin(found);
  };

  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div className="logo-icon" style={{ width: 42, height: 42, borderRadius: 11 }}><Ic d={I.barcode} s={21} /></div>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.4px" }}>ScanDesk</span>
    </div>
  );

  return (
    <div className="login-wrap">
      <div className="login-box">
        <Logo />
        <p style={{ fontSize: 13, color: "var(--tx2)", marginBottom: 28 }}>Barkod yönetim sistemine giriş yapın</p>
        {logoutReason === "shift_expired" && (
          <div className="err-msg" style={{ marginBottom: 16, background: "var(--err-bg, rgba(239,68,68,.12))", borderColor: "var(--err)" }}>
            Vardiya süresi doldu. Lütfen tekrar giriş yapın.
          </div>
        )}
        {err && <div className="err-msg">{err}</div>}
        <div className="fg">
          <label className="lbl">Kullanıcı Adı</label>
          <input value={u} onChange={e => setU(e.target.value)} placeholder="kullanici_adi"
            autoCapitalize="none" autoCorrect="off" onKeyDown={e => e.key === "Enter" && goAuth()} />
        </div>
        <div className="fg">
          <label className="lbl">Şifre</label>
          <PasswordInput value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && goAuth()} />
        </div>
        <button className="btn btn-primary btn-full btn-lg" onClick={goAuth}>Giriş Yap</button>
      </div>
    </div>
  );
}
