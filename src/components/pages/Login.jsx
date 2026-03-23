import { useState } from "react";
import { Ic, I } from "../ui/Icon";
import PasswordInput from "../ui/PasswordInput";
import { hashPassword, verifyPassword } from "../../utils";
import { fetchServerUsers } from "../../services/integrations";
import { logger } from "../../logger";

export default function Login({ users, onLogin, onMigratePassword, logoutReason, integration }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const goAuth = async () => {
    if (loading) return;
    setErr("");

    const username = u.trim();

    // 1. Önce yerel önbellekte ara (internet gerektirmez)
    const localFound = users.find(x => x.username === username && x.active !== false);
    if (localFound) {
      const ok = await verifyPassword(p, localFound.password);
      if (!ok) { setErr("Kullanıcı adı veya şifre hatalı."); return; }
      if (!localFound.password.startsWith("pbkdf2:")) {
        const hashed = await hashPassword(p);
        onMigratePassword?.(localFound.id, hashed);
      }
      onLogin(localFound, null);
      return;
    }

    // 2. Yerel'de yok — sunucu aktifse sunucudan dene
    const useServer = username !== "admin" && integration?.postgresApi?.active;
    if (useServer) {
      setLoading(true);
      try {
        const serverUsers = await fetchServerUsers(integration.postgresApi);
        const found = serverUsers.find(x => x.username === username && x.active !== false);
        if (!found) { setErr("Kullanıcı adı veya şifre hatalı."); return; }
        const ok = await verifyPassword(p, found.password);
        if (!ok) { setErr("Kullanıcı adı veya şifre hatalı."); return; }
        if (!found.password.startsWith("pbkdf2:")) {
          const hashed = await hashPassword(p);
          onMigratePassword?.(found.id, hashed);
        }
        onLogin(found, serverUsers);
      } catch (err) {
        logger.warn("[login:server]", err?.message ?? err);
        const url = integration?.postgresApi?.serverUrl || "";
        setErr(`Sunucuya bağlanılamadı${url ? ` (${url})` : ""}. Ağ bağlantısı ve sunucu ayarlarını kontrol edin.`);
      } finally {
        setLoading(false);
      }
    } else {
      setErr("Kullanıcı adı veya şifre hatalı.");
    }
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
        {logoutReason === "account_removed" && (
          <div className="err-msg" style={{ marginBottom: 16, background: "var(--err-bg, rgba(239,68,68,.12))", borderColor: "var(--err)" }}>
            Hesabınız güncellendi veya kaldırıldı. Lütfen tekrar giriş yapın.
          </div>
        )}
        {err && <div className="err-msg">{err}</div>}
        <div className="fg">
          <label className="lbl">Kullanıcı Adı</label>
          <input value={u} onChange={e => setU(e.target.value)} placeholder="kullanici_adi"
            autoCapitalize="none" autoCorrect="off" onKeyDown={e => e.key === "Enter" && goAuth()} disabled={loading} />
        </div>
        <div className="fg">
          <label className="lbl">Şifre</label>
          <PasswordInput value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && goAuth()} disabled={loading} />
        </div>
        <button className="btn btn-primary btn-full btn-lg" onClick={goAuth} disabled={loading}>
          {loading ? "Bağlanıyor..." : "Giriş Yap"}
        </button>
        {integration?.postgresApi?.active && (
          <p style={{ marginTop: 14, fontSize: 11, color: "var(--tx2)", textAlign: "center", lineHeight: 1.5 }}>
            {`Sunucu: ${integration.postgresApi.serverUrl} — admin dışı kullanıcılar sunucu bağlantısı gerektirir.`}
          </p>
        )}
      </div>
    </div>
  );
}
