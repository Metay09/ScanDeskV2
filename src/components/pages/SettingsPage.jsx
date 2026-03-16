import { useState } from "react";
import { Ic, I } from "../ui/Icon";
import Toggle from "../ui/Toggle";
import PasswordInput from "../ui/PasswordInput";

export default function SettingsPage({
  settings, setSettings,
  userSettings, onUpdateUserSettings,
  integration, setIntegration,
  isAdmin, onClearData, onDeleteRange,
  records, toast, user, onLogout, theme, onToggleTheme,
}) {
  // Admin (global) ayarlar kısayolu
  const setGlobal = (k, v) => setSettings(p => ({ ...p, [k]: v }));
  // Kişisel ayar kısayolu
  const setPersonal = (k, v) => onUpdateUserSettings({ [k]: v });

  const [pgOpen, setPgOpen] = useState(false);
  const [gsOpen, setGsOpen] = useState(false);
  const [pg, setPg] = useState({ ...integration.postgresApi });
  const [gs, setGs] = useState({ ...integration.gsheets });
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // Kişisel ayarların güncel değerlerini okumak için yardımcı
  // userSettings override eder, yoksa settings'ten, yoksa varsayılan
  const personal = (k, def) => userSettings?.[k] !== undefined ? userSettings[k] : (settings?.[k] !== undefined ? settings[k] : def);

  const Row = ({ icon, label, sub, children, onClick }) => (
    <div className={`s-row ${onClick ? "clickable" : ""}`} onClick={onClick}>
      {icon && <div style={{ color: "var(--tx2)", flexShrink: 0 }}><Ic d={icon} s={17} /></div>}
      <div style={{ flex: 1 }}>
        <div className="s-label">{label}</div>
        {sub && <div className="s-sub">{sub}</div>}
      </div>
      <div className="s-val">{children}</div>
    </div>
  );

  return (
    <div className="page" style={{ paddingLeft: 0, paddingRight: 0 }}>

      {/* ── Kişisel Tercihler (herkes görür) ─────────────────────────── */}
      <div className="section-hd">Kişisel Tercihler</div>
      <div className="s-card">
        <Row icon={I.save} label="Hızlı Okutma Modu" sub="Barkod gelir, direkt kaydolur, tekrar okutmaya hazır olur.">
          <Toggle value={personal("autoSave", true)} onChange={v => {
            setPersonal("autoSave", v);
            if (v && personal("addDetailAfterScan", false)) setPersonal("addDetailAfterScan", false);
          }} />
        </Row>
        {personal("autoSave", true) && (
          <Row icon={I.edit} label="Detaylı Giriş Modu" sub="Barkod okutulur, detay ekranı açılır, müşteri/not girilir, kaydedilir.">
            <Toggle value={personal("addDetailAfterScan", false)} onChange={v => setPersonal("addDetailAfterScan", v)} />
          </Row>
        )}
        <Row icon={I.vib} label="Titreşim"><Toggle value={personal("vibration", true)} onChange={v => setPersonal("vibration", v)} /></Row>
        <Row icon={I.bell} label="Bip Sesi"><Toggle value={personal("beep", true)} onChange={v => setPersonal("beep", v)} /></Row>
        <Row icon={I.data} label="Son Okutmalar" sub="Aktif vardiyada gösterilecek son kayıt sayısı">
          <select
            value={String(personal("recentLimit", 10))}
            onChange={e => setPersonal("recentLimit", parseInt(e.target.value, 10))}
            style={{ height: 34, borderRadius: 10, padding: "0 10px", background: "var(--s2)", color: "var(--tx)", border: "1.5px solid var(--brd)" }}
          >
            {[5, 10, 20, 50, 100, 200].map(n => <option key={n} value={String(n)}>{n}</option>)}
            <option value="0">Full</option>
          </select>
        </Row>
      </div>

      {/* ── Genel Ayarlar (sadece admin) ─────────────────────────────── */}
      {isAdmin && <>
        <div className="section-hd">Genel Ayarlar</div>
        <div className="s-card">
          <Row icon={I.barcode} label="Barkod Uzunluk Kontrolü" sub="İlk okutulan barkod uzunluğu ile devam eder, yanlış okumayı önler">
            <Toggle value={settings.enforceBarcodeLengthMatch ?? true} onChange={v => setGlobal("enforceBarcodeLengthMatch", v)} />
          </Row>
        </div>

        <div className="section-hd">Güvenlik & İzinler</div>
        <div className="s-card">
          <Row icon={I.xlsx}   label="Dışa Aktarmaya İzin Ver"><Toggle value={settings.allowExport ?? true}       onChange={v => setGlobal("allowExport", v)} /></Row>
          <Row icon={I.upload} label="İçe Aktarmaya İzin Ver"><Toggle value={settings.allowImport ?? true}        onChange={v => setGlobal("allowImport", v)} /></Row>
          <Row icon={I.trash}  label="Verileri Temizlemeye İzin Ver"><Toggle value={settings.allowClearData ?? true}  onChange={v => setGlobal("allowClearData", v)} /></Row>
          <Row icon={I.plus}   label="Alan Eklemeye İzin Ver"><Toggle value={settings.allowAddField ?? true}      onChange={v => setGlobal("allowAddField", v)} /></Row>
          <Row icon={I.edit}   label="Alan Düzenlemeye İzin Ver"><Toggle value={settings.allowEditField ?? true}    onChange={v => setGlobal("allowEditField", v)} /></Row>
          <Row icon={I.del}    label="Alan Silmeye İzin Ver"><Toggle value={settings.allowDeleteField ?? true}   onChange={v => setGlobal("allowDeleteField", v)} /></Row>
        </div>

        <div className="section-hd">Veri Temizleme (Aralık)</div>
        <div className="s-card">
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <input
                  type="datetime-local"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 10px", background: "var(--s2)", color: rangeStart ? "var(--tx)" : "var(--tx2)", border: "1.5px solid var(--brd)", fontSize: 12 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="datetime-local"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 10px", background: "var(--s2)", color: rangeEnd ? "var(--tx)" : "var(--tx2)", border: "1.5px solid var(--brd)", fontSize: 12 }}
                />
              </div>
            </div>
            <button className="btn btn-danger" disabled={!rangeStart || !rangeEnd} onClick={() => {
              const toISO = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };
              const a = toISO(rangeStart);
              const b = toISO(rangeEnd);
              if (!a || !b) { toast("Geçerli tarih seçin", "var(--acc)"); return; }
              const n = records.filter(r => r.timestamp >= a && r.timestamp <= b).length;
              if (!n) { toast("Bu aralıkta kayıt yok", "var(--acc)"); return; }
              if (!window.confirm(`${n} kayıt silinecek (seçilen aralık). Onaylıyor musunuz?`)) return;
              onDeleteRange(a, b);
              toast(`${n} kayıt silindi`, "var(--err)");
              setRangeStart(""); setRangeEnd("");
            }}><Ic d={I.trash} s={16} /> Seçilen Aralığı Sil</button>
          </div>
        </div>

        <div className="section-hd">Entegrasyon</div>

        {integration.postgresApi?.active && (
          <div style={{ margin: "0 0 6px", padding: "10px 12px", background: "var(--ok2)", border: "1.5px solid var(--ok3)", borderRadius: "var(--r)", fontSize: 12, color: "var(--ok)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ok)" }} />
            Aktif: PostgreSQL API
            <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto", height: 30 }} onClick={() => setIntegration(p => ({ ...p, postgresApi: { ...p.postgresApi, active: false } }))}>Durdur</button>
          </div>
        )}
        {integration.gsheets?.active && (
          <div style={{ margin: "0 0 10px", padding: "10px 12px", background: "var(--ok2)", border: "1.5px solid var(--ok3)", borderRadius: "var(--r)", fontSize: 12, color: "var(--ok)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ok)" }} />
            Aktif: Google Sheets
            <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto", height: 30 }} onClick={() => setIntegration(p => ({ ...p, gsheets: { ...p.gsheets, active: false } }))}>Durdur</button>
          </div>
        )}
        {/* PostgreSQL API */}
        <div className="int-card">
          <div className={`int-hd ${pgOpen ? "open" : ""}`} onClick={() => setPgOpen(p => !p)}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(62,207,142,.15)", border: "1.5px solid rgba(62,207,142,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic d={I.cloud} s={17} /></div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>PostgreSQL API</div><div style={{ fontSize: 12, color: "var(--tx2)" }}>Sunucundaki API üzerinden PostgreSQL senkronizasyonu</div></div>
            {integration.postgresApi?.active && <span className="badge badge-ok">AKTİF</span>}
            <Ic d={I.chevD} s={14} />
          </div>
          {pgOpen && (
            <div className="int-bd">
              <div className="info-box inf" style={{ fontSize: 12 }}>
                <b>Nasıl kullanılır:</b><br />
                • Sunucu URL'nizi ve API anahtarınızı girin<br />
                • Kayıtlar otomatik olarak sunucuya senkronize edilir<br />
                • Bağlantı başarısız olursa kayıtlar kuyruğa alınır ve tekrar denenir
              </div>
              <div><label className="lbl">Server URL</label><input placeholder="https://scandesk-api.simsekhome.site" value={pg.serverUrl} onChange={e => setPg(p => ({ ...p, serverUrl: e.target.value }))} /></div>
              <div><label className="lbl">API Key</label><PasswordInput value={pg.apiKey} onChange={e => setPg(p => ({ ...p, apiKey: e.target.value }))} placeholder="scandesk_live_xxxxxxxxx" /></div>
              <button className="btn btn-ok btn-full" onClick={() => { if (!pg.serverUrl || !pg.apiKey) { toast("Tüm alanları doldurun", "var(--err)"); return; } setIntegration(p => ({ ...p, postgresApi: { ...pg, active: true } })); toast("PostgreSQL API aktif edildi"); setPgOpen(false); }}><Ic d={I.check} s={15} /> Aktif Et</button>
            </div>
          )}
        </div>
        {/* Google Sheets */}
        <div className="int-card">
          <div className={`int-hd ${gsOpen ? "open" : ""}`} onClick={() => setGsOpen(p => !p)}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(34,197,94,.15)", border: "1.5px solid rgba(34,197,94,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic d={I.sheets} s={17} /></div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>Google Sheets</div><div style={{ fontSize: 12, color: "var(--tx2)" }}>Kayıtları Google Sheets'e senkronize et (oluştur, güncelle, sil)</div></div>
            {integration.gsheets?.active && <span className="badge badge-ok">AKTİF</span>}
            <Ic d={I.chevD} s={14} />
          </div>
          {gsOpen && (
            <div className="int-bd">
              <div className="info-box inf" style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ marginBottom: 8, padding: 8, background: "rgba(34,197,94,.1)", borderRadius: 4, border: "1px solid rgba(34,197,94,.2)" }}>
                  <b>✓ Tam senkronizasyon:</b> Kayıt oluşturma, güncelleme ve silme işlemleri otomatik olarak Google Sheets'e yansır.<br />
                  <b>✓ ID bazlı eşleşme:</b> Her kayıt benzersiz ID ile tanımlanır; aynı ID tekrar gelirse mevcut satır güncellenir.<br />
                  <b>✓ Dinamik alanlar:</b> Yeni alan eklendiğinde Apps Script otomatik olarak yeni kolon oluşturur.<br />
                  <b>⚠ No-CORS limiti:</b> Sunucu yanıtı doğrulanamaz; istek gönderildiğinde başarılı kabul edilir.
                </div>
                <b>1.</b> Google E-Tablolar'da yeni tablo aç<br />
                <b>2.</b> Uzantılar → Apps Script → şu kodu yapıştır:
                <textarea readOnly rows={20} style={{ marginTop: 8, fontSize: 10, fontFamily: "var(--mono)", background: "rgba(0,0,0,.3)", border: "1px solid var(--brd)", borderRadius: "var(--r)", padding: 8, color: "var(--tx)" }}
                  value={`const SHEET_ID = "BURAYA_SHEET_ID_YAPI\u015ATIR";\n\nfunction doPost(e) {\n  const d = JSON.parse(e.postData.contents);\n  const ss = SpreadsheetApp.openById(SHEET_ID);\n  const sh = ss.getSheetByName("Taramalar") || ss.insertSheet("Taramalar");\n\n  // DELETE işlemi\n  if (d.action === "delete" && d.id) {\n    const lastRow = sh.getLastRow();\n    if (lastRow > 1) {\n      const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();\n      const rowIndex = ids.indexOf(d.id);\n      if (rowIndex !== -1) {\n        sh.deleteRow(rowIndex + 2); // +2: header + 0-indexed\n        return ContentService.createTextOutput("DELETED");\n      }\n    }\n    return ContentService.createTextOutput("NOT_FOUND");\n  }\n\n  // CREATE / UPDATE (upsert) işlemi\n  if (sh.getLastRow() === 0) {\n    sh.appendRow(["id", ...d.headers]);\n  } else {\n    const currentHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];\n    const newHeaders = ["id", ...d.headers];\n    if (newHeaders.length > currentHeaders.length) {\n      for (let i = currentHeaders.length; i < newHeaders.length; i++) {\n        sh.getRange(1, i + 1).setValue(newHeaders[i]);\n      }\n    }\n  }\n\n  const lastRow = sh.getLastRow();\n  if (lastRow > 1) {\n    const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();\n    const rowIndex = ids.indexOf(d.row[0]);\n    if (rowIndex !== -1) {\n      const targetRow = rowIndex + 2;\n      for (let i = 0; i < d.row.length; i++) {\n        sh.getRange(targetRow, i + 1).setValue(d.row[i]);\n      }\n      return ContentService.createTextOutput("UPDATED");\n    }\n  }\n\n  sh.appendRow(d.row);\n  return ContentService.createTextOutput("CREATED");\n}`} />
                <b>3.</b> Dağıt → Web uygulaması → Erişim: <b>Herkes</b><br />
                <b>4.</b> Oluşan URL'yi aşağıya yapıştır
              </div>
              <div><label className="lbl">Web App URL</label><input placeholder="https://script.google.com/macros/s/..." value={gs.scriptUrl} onChange={e => setGs(p => ({ ...p, scriptUrl: e.target.value }))} /></div>
              <button className="btn btn-ok btn-full" onClick={() => { if (!gs.scriptUrl) { toast("URL gerekli", "var(--err)"); return; } setIntegration(p => ({ ...p, gsheets: { ...gs, active: true } })); toast("Google Sheets aktif edildi"); setGsOpen(false); }}><Ic d={I.check} s={15} /> Aktif Et</button>
            </div>
          )}
        </div>

        {(settings.allowClearData ?? true) && (
          <>
            <div className="section-hd">Veri</div>
            <div className="s-card">
              <Row icon={I.trash} label="Tüm Kayıtları Temizle" sub="Bu işlem geri alınamaz" onClick={onClearData}>
                <span style={{ color: "var(--err)", fontWeight: 700 }}>Temizle</span><Ic d={I.chevR} s={14} />
              </Row>
            </div>
          </>
        )}
      </>}

      <div className="section-hd">Hesap</div>
      <div className="s-card">
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--brd)" }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 14, flexShrink: 0 }}>{(user.name || user.username || "?")[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--tx2)" }}>@{user.username} · {user.role === "admin" ? "Admin" : "Kullanıcı"}</div>
            </div>
          </div>
        )}
        <Row icon={theme === "dark" ? I.sun : I.moon} label={theme === "dark" ? "Açık Temaya Geç" : "Koyu Temaya Geç"} sub="Uygulama görünümünü değiştir" onClick={onToggleTheme}>
          <Ic d={I.chevR} s={14} />
        </Row>
        <Row icon={I.logout} label="Çıkış Yap" sub="Oturumu kapat" onClick={onLogout}>
          <Ic d={I.chevR} s={14} />
        </Row>
      </div>
    </div>
  );
}
