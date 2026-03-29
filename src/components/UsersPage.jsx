import { useState } from "react";
import { Ic, I } from "./Icon";
import { genId } from "../constants";
import PasswordInput from "./PasswordInput";
import { hashPassword, verifyPassword } from "../utils";

export default function UsersPage({ users, setUsers, currentUser, toast }) {
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({ name: "", username: "", password: "", role: "user", active: true });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr]     = useState("");
  const set = (k, v)      => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setErr(""); setForm({ name: "", username: "", password: "", role: "user", active: true }); setModal({ mode: "add" }); };
  const openEdit = u => { setErr(""); setForm({ ...u }); setModal({ mode: "edit", user: u }); };
  const openPw   = u => { setErr(""); setPwForm({ current: "", next: "", confirm: "" }); setModal({ mode: "pw", user: u }); };

  const saveUser = async () => {
    if (!form.name.trim() || !form.username.trim()) { setErr("Ad ve kullanıcı adı zorunludur."); return; }
    if (modal.mode === "add" && !form.password.trim()) { setErr("Şifre zorunludur."); return; }
    if (modal.mode === "add" && form.password.length < 4) { setErr("Şifre en az 4 karakter olmalıdır."); return; }
    if (modal.mode === "add" && users.find(u => u.username === form.username.trim())) { setErr("Bu kullanıcı adı zaten kullanılıyor."); return; }
    if (modal.mode === "add") {
      const hashed = await hashPassword(form.password);
      setUsers(p => [...p, { ...form, id: genId(), username: form.username.trim(), password: hashed }]);
      toast("Kullanıcı oluşturuldu");
    } else {
      setUsers(p => p.map(u => u.id === modal.user.id ? { ...u, name: form.name, username: form.username.trim(), role: form.role, active: form.active } : u));
      toast("Kullanıcı güncellendi", "var(--inf)");
    }
    setModal(null);
  };

  const changePw = async () => {
    setErr("");
    const isOwn = modal.user.id === currentUser.id;
    if (isOwn) {
      const ok = await verifyPassword(pwForm.current, modal.user.password);
      if (!ok) { setErr("Mevcut şifre hatalı."); return; }
    }
    if (pwForm.next.length < 4) { setErr("Yeni şifre en az 4 karakter olmalıdır."); return; }
    if (pwForm.next !== pwForm.confirm) { setErr("Şifreler eşleşmiyor."); return; }
    const hashed = await hashPassword(pwForm.next);
    setUsers(p => p.map(u => u.id === modal.user.id ? { ...u, password: hashed } : u));
    toast("Şifre değiştirildi", "var(--ok)");
    setModal(null);
  };

  const deleteUser = u => {
    if (u.id === currentUser.id) { toast("Kendi hesabınızı silemezsiniz.", "var(--err)"); return; }
    if (window.confirm(`"${u.name}" kullanıcısını silmek istediğinizden emin misiniz?`)) {
      setUsers(p => p.filter(x => x.id !== u.id));
      toast("Kullanıcı silindi", "var(--err)");
    }
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={openAdd}><Ic d={I.plus} s={16} /> Kullanıcı Ekle</button>
      </div>

      {users.map(u => (
        <div className="user-card" key={u.id}>
          <div className="user-avatar-lg">{u.name[0].toUpperCase()}</div>
          <div className="user-info">
            <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: "var(--tx2)", fontFamily: "var(--mono)", marginTop: 2 }}>@{u.username}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span className={`badge ${u.role === "admin" ? "badge-acc" : "badge-inf"}`}>{u.role === "admin" ? "Admin" : "Kullanıcı"}</span>
              {!u.active && <span className="badge badge-err">Devre Dışı</span>}
              {u.id === currentUser.id && <span className="badge" style={{ background: "var(--pur2)", color: "var(--pur)" }}>Sen</span>}
            </div>
          </div>
          <div className="user-actions">
            <button className="btn btn-pur btn-sm" style={{ height: 36, padding: "0 10px" }} onClick={() => openPw(u)} title="Şifre Değiştir"><Ic d={I.key} s={14} /></button>
            <button className="btn btn-info btn-sm" style={{ height: 36, padding: "0 10px" }} onClick={() => openEdit(u)} title="Düzenle"><Ic d={I.edit} s={14} /></button>
            {u.id !== currentUser.id && (
              <button className="btn btn-danger btn-sm" style={{ height: 36, padding: "0 10px" }} onClick={() => deleteUser(u)} title="Sil"><Ic d={I.del} s={14} /></button>
            )}
          </div>
        </div>
      ))}

      {/* Add / Edit User Modal */}
      {modal && (modal.mode === "add" || modal.mode === "edit") && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <span className="modal-title"><Ic d={I.user} s={16} />{modal.mode === "add" ? "Kullanıcı Ekle" : "Kullanıcıyı Düzenle"}</span>
              <button className="x-btn" onClick={() => setModal(null)}><Ic d={I.x} s={15} /></button>
            </div>
            <div className="modal-bd">
              {err && <div className="err-msg">{err}</div>}
              <div><label className="lbl">Ad Soyad</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ad Soyad" /></div>
              <div><label className="lbl">Kullanıcı Adı</label><input value={form.username} onChange={e => set("username", e.target.value)} placeholder="kullanici_adi" autoCapitalize="none" autoCorrect="off" /></div>
              {modal.mode === "add" && (
                <div><label className="lbl">Şifre</label><PasswordInput value={form.password} onChange={e => set("password", e.target.value)} /></div>
              )}
              <div>
                <label className="lbl">Rol</label>
                <select value={form.role} onChange={e => set("role", e.target.value)}>
                  <option value="user">Kullanıcı</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {modal.mode === "edit" && (
                <label className="chk-row">
                  <input type="checkbox" checked={form.active !== false} onChange={e => set("active", e.target.checked)} />
                  <span>Hesap aktif</span>
                </label>
              )}
            </div>
            <div className="modal-ft">
              <button className="btn btn-ok" style={{ flex: 1 }} onClick={saveUser}><Ic d={I.save} s={16} /> {modal.mode === "add" ? "Oluştur" : "Güncelle"}</button>
              <button className="btn btn-ghost" style={{ width: 88 }} onClick={() => setModal(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {modal && modal.mode === "pw" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <span className="modal-title"><Ic d={I.key} s={16} />Şifre Değiştir — {modal.user.name}</span>
              <button className="x-btn" onClick={() => setModal(null)}><Ic d={I.x} s={15} /></button>
            </div>
            <div className="modal-bd">
              {err && <div className="err-msg">{err}</div>}
              {modal.user.id === currentUser.id && (
                <div><label className="lbl">Mevcut Şifre</label><PasswordInput value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="Mevcut şifre" /></div>
              )}
              <div><label className="lbl">Yeni Şifre</label><PasswordInput value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} placeholder="En az 4 karakter" /></div>
              <div><label className="lbl">Yeni Şifre (Tekrar)</label><PasswordInput value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Tekrar girin" /></div>
            </div>
            <div className="modal-ft">
              <button className="btn btn-ok" style={{ flex: 1 }} onClick={changePw}><Ic d={I.check} s={16} /> Değiştir</button>
              <button className="btn btn-ghost" style={{ width: 88 }} onClick={() => setModal(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
