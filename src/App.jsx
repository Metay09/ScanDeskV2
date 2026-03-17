import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import "./index.css";
import { INITIAL_USERS, INITIAL_SETTINGS, INITIAL_FIELDS, DEFAULT_CUSTS, DEFAULT_ACIKLAMAS, DEFAULT_POSTGRES_URL, DEFAULT_POSTGRES_KEY, DEFAULT_GSHEETS_URL, DEFAULT_GSHEETS_ACTIVE, DEFAULT_USER_SETTINGS, DEFAULT_POSTGRES_ACTIVE } from "./constants";
import { isNative, loadState, saveState } from "./services/storage";
import { getCurrentShift, pad2, deriveShiftDate, getShiftDate, getShiftEndTime } from "./utils";
import { normalizeRecord, migrateRecords } from "./services/recordModel";
import { sheetsDelete, postgresApiInsert, postgresApiUpdate, postgresApiDelete, syncRecordToSheets, fetchServerUsers, pushServerUsers, fetchServerConfig, pushServerConfig, fetchServerRecords, fetchServerRecord } from "./services/integrations";
import { toDbPayload, fromDbPayload } from "./services/recordModel";
import { useToast } from "./hooks/useToast";
import { useBackButton } from "./hooks/useBackButton";
import { useShiftTimer } from "./hooks/useShiftTimer";
import { useSyncQueue } from "./hooks/useSyncQueue";
import { useServerSync } from "./hooks/useServerSync";
import { Ic, I } from "./components/ui/Icon";
import Login from "./components/pages/Login";
import ScanPage from "./components/pages/ScanPage";
import DataPage from "./components/pages/DataPage";
import ReportPage from "./components/pages/ReportPage";
import FieldsPage from "./components/pages/FieldsPage";
import UsersPage from "./components/pages/UsersPage";
import SettingsPage from "./components/pages/SettingsPage";

export default function App() {
  const [users, setUsers]         = useState(INITIAL_USERS);
  const [user, setUser]           = useState(null);
  const [page, setPage]           = useState("scan");
  const [fields, setFields]       = useState(INITIAL_FIELDS);
  const [records, setRecords]     = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [custList, setCustList]         = useState(DEFAULT_CUSTS);
  const [aciklamaList, setAciklamaList] = useState(DEFAULT_ACIKLAMAS);
  const [settings, setSettings]   = useState(INITIAL_SETTINGS);
  const [integration, setIntegration] = useState({
    postgresApi: { active: DEFAULT_POSTGRES_ACTIVE, serverUrl: DEFAULT_POSTGRES_URL, apiKey: DEFAULT_POSTGRES_KEY },
    gsheets:     { active: DEFAULT_GSHEETS_ACTIVE, scriptUrl: DEFAULT_GSHEETS_URL },
  });
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [userLoginShift, setUserLoginShift] = useState(null);
  const [shiftTakeovers, setShiftTakeovers] = useState({});
  const [logoutReason, setLogoutReason] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Kişisel kullanıcı ayarları (user.userSettings'ten yüklenir)
  const [userSettings, setUserSettings] = useState({});
  // Startup sonrası gösterilecek bildirimler
  const [pendingNotification, setPendingNotification] = useState(null); // { msg, color }
  const [adminSyncWarning, setAdminSyncWarning] = useState(false);

  // Refs for current config values — sunucu push'unda her zaman güncel değeri yakalar
  const fieldsRef       = useRef(fields);
  const custListRef     = useRef(custList);
  const aciklamaListRef = useRef(aciklamaList);
  const settingsRef     = useRef(settings);
  const usersRef        = useRef(users);
  const integrationRef  = useRef(integration);
  useEffect(() => { fieldsRef.current       = fields;      }, [fields]);
  useEffect(() => { custListRef.current     = custList;    }, [custList]);
  useEffect(() => { aciklamaListRef.current = aciklamaList;}, [aciklamaList]);
  useEffect(() => { settingsRef.current     = settings;    }, [settings]);
  useEffect(() => { usersRef.current        = users;       }, [users]);
  useEffect(() => { integrationRef.current  = integration; }, [integration]);

  /** Uygulama yapılandırmasını (alanlar, müşteriler, açıklamalar, ayarlar) sunucuya iter.
   *  patch ile sadece değişen alanı override et; geri kalanlar ref'ten alınır. */
  const syncConfigToServer = useCallback((patch = {}) => {
    const int = integrationRef.current;
    if (!int.postgresApi?.active) return;
    pushServerConfig(int.postgresApi, {
      fields:       fieldsRef.current,
      custList:     custListRef.current,
      aciklamaList: aciklamaListRef.current,
      settings:     settingsRef.current,
      ...patch,
    }).catch(() => {});
  }, []);

  /** Kullanıcı listesini sunucuya iter. */
  const syncUsersToServer = useCallback((updatedUsers) => {
    const int = integrationRef.current;
    if (!int.postgresApi?.active) return;
    pushServerUsers(int.postgresApi, updatedUsers).catch(() => {});
  }, []);

  // İnternet gelince: sunucudan çek → merge → eksik local kullanıcıları push et
  useEffect(() => {
    const handleOnline = async () => {
      const int = integrationRef.current;
      if (!int.postgresApi?.active) return;
      try {
        const su = await fetchServerUsers(int.postgresApi);
        if (Array.isArray(su) && su.length) {
          const serverById = Object.fromEntries(su.map(u => [u.id, u]));
          const serverByUsername = Object.fromEntries(su.map(u => [u.username, u]));
          const localOnly = usersRef.current.filter(
            u => !serverById[u.id] && !serverByUsername[u.username]
          );
          if (localOnly.length > 0) {
            const merged = [...su, ...localOnly];
            setUsers(merged);
            await pushServerUsers(int.postgresApi, merged);
          }
        } else {
          await pushServerUsers(int.postgresApi, usersRef.current);
        }
      } catch { /* sessizce devam */ }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const addShiftDate = useCallback((rec) => {
    if (!rec) return rec;
    const shiftDate = deriveShiftDate(rec);
    return shiftDate ? { ...rec, shiftDate } : { ...rec };
  }, []);

  const normalizeRecordsWithModel = useCallback((list, fieldDefs = fields) => {
    if (!Array.isArray(list)) return [];
    return migrateRecords(list, fieldDefs).map(addShiftDate);
  }, [addShiftDate, fields]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // Load persisted state on start
  useEffect(() => {
    let alive = true;

    const normalizeLoadedRecords = (list, fieldDefs) => {
      if (!Array.isArray(list)) return [];
      return migrateRecords(list, fieldDefs).map(addShiftDate);
    };

    (async () => {
      const st = await loadState();
      if (!alive) return;

      const loadedFields =
        Array.isArray(st?.fields) && st.fields.length
          ? st.fields
          : INITIAL_FIELDS;

      const loadedUsers =
        Array.isArray(st?.users) && st.users.length
          ? st.users
          : [];

      const hasAdmin = loadedUsers.some(u => u.username === "admin");
      setUsers(hasAdmin ? loadedUsers : [INITIAL_USERS[0], ...loadedUsers]);

      if (Array.isArray(st?.fields) && st.fields.length) {
        setFields(st.fields);
      }

      if (Array.isArray(st?.records)) {
        setRecords(normalizeLoadedRecords(st.records, loadedFields));
      }

      if (st?.lastSaved) {
        const normalized = normalizeRecord(st.lastSaved, loadedFields);
        setLastSaved(addShiftDate(normalized));
      }

      if (Array.isArray(st?.custList) && st.custList.length) {
        setCustList(st.custList);
      }

      if (Array.isArray(st?.aciklamaList)) {
        setAciklamaList(st.aciklamaList);
      }

      if (st?.settings) {
        setSettings(st.settings);
      }

      let finalIntegration = null;
      if (st?.integration) {
        const old = st.integration;
        let migratedIntegration;

        // Eski format: { active, type, postgresApi, gsheets } → yeni: { postgresApi: { active, ... }, gsheets: { active, ... } }
        if ("active" in old || "type" in old) {
          const pgActive = (old.active && (old.type === "postgres_api" || old.type === "supabase")) ? true : (old.postgresApi?.active ?? false);
          const gsActive = (old.active && old.type === "gsheets") ? true : (old.gsheets?.active ?? false);
          const pgUrl    = old.postgresApi?.serverUrl || old.supabase?.url || DEFAULT_POSTGRES_URL;
          const pgKey    = old.postgresApi?.apiKey    || old.supabase?.key || DEFAULT_POSTGRES_KEY;
          const gsUrl = old.gsheets?.scriptUrl || DEFAULT_GSHEETS_URL;
          migratedIntegration = {
            postgresApi: { active: pgActive, serverUrl: pgUrl, apiKey: pgKey },
            gsheets:     { active: DEFAULT_GSHEETS_ACTIVE ? true : gsActive, scriptUrl: gsUrl },
          };
        } else {
          // Yeni format — eksik alanları tamamla
          const gsUrl = old.gsheets?.scriptUrl || DEFAULT_GSHEETS_URL;
          migratedIntegration = {
            postgresApi: {
              active:    DEFAULT_POSTGRES_ACTIVE ? true : (old.postgresApi?.active ?? false),
              serverUrl: old.postgresApi?.serverUrl || DEFAULT_POSTGRES_URL,
              apiKey:    old.postgresApi?.apiKey    || DEFAULT_POSTGRES_KEY,
            },
            gsheets: {
              active:    DEFAULT_GSHEETS_ACTIVE ? true : (old.gsheets?.active ?? false),
              scriptUrl: gsUrl,
            },
          };
        }
        finalIntegration = migratedIntegration;
        setIntegration(migratedIntegration);
      }

      if (st?.shiftTakeovers && typeof st.shiftTakeovers === "object") {
        setShiftTakeovers(st.shiftTakeovers);
      }

      if (Array.isArray(st?.syncQueue)) {
        setSyncQueue(st.syncQueue);
      }

      // Restore active session if it exists and is still valid
      if (st?.activeSession) {
        const { username, loginShift } = st.activeSession;
        const foundUser = loadedUsers.find(u => u.username === username);

        if (foundUser) {
          let sessionValid = true;
          let restoredGraceEndTime = null;

          if (foundUser.role !== "admin" && loginShift) {
            const currentShift = getCurrentShift();

            if (currentShift !== loginShift) {
              const shiftEnd = getShiftEndTime(loginShift);
              if (shiftEnd) {
                const graceEnd = shiftEnd + (300 * 1000);
                const now = Date.now();
                sessionValid = now < graceEnd;
                if (sessionValid) restoredGraceEndTime = graceEnd;
              }
            }
          }

          if (sessionValid) {
            setUser(foundUser);
            setUserLoginShift(loginShift);
            setPage("scan");
            // Grace period'daysa kaldığı yerden devam ettir
            if (restoredGraceEndTime) {
              startGrace(restoredGraceEndTime);
            }
          } else {
            setLogoutReason("shift_expired");
          }
        }
      }

      if (st?.theme) setTheme(st.theme);

      // ── Sunucu senkronizasyonu ────────────────────────────────────────────
      // postgres_api aktifse kullanıcılar ve uygulama yapılandırması
      // sunucudan çekilir; sunucu "source of truth" olarak kullanılır.
      // Sunucu ulaşılamaz ya da endpoint henüz yoksa sessizce local data ile devam edilir.
      if (finalIntegration?.postgresApi?.active && finalIntegration.postgresApi.serverUrl) {
        try {
          const [serverUsers, serverConfig, serverRecords] = await Promise.allSettled([
            fetchServerUsers(finalIntegration.postgresApi),
            fetchServerConfig(finalIntegration.postgresApi),
            fetchServerRecords(finalIntegration.postgresApi),
          ]);

          if (serverUsers.status === "fulfilled" && Array.isArray(serverUsers.value) && serverUsers.value.length) {
            const su = serverUsers.value;
            const serverById = Object.fromEntries(su.map(u => [u.id, u]));
            const serverByUsername = Object.fromEntries(su.map(u => [u.username, u]));
            const localOnly = loadedUsers.filter(u => !serverById[u.id] && !serverByUsername[u.username]);
            const merged = [...su, ...localOnly];
            const hasAdmin = merged.some(u => u.username === "admin");
            const finalMerged = hasAdmin ? merged : [INITIAL_USERS[0], ...merged];
            setUsers(finalMerged);
            if (localOnly.length > 0) {
              pushServerUsers(finalIntegration.postgresApi, finalMerged).catch(() => {});
            }

            // ── Aktif oturum yenileme (Madde 2) ──────────────────────────
            if (st?.activeSession?.username) {
              const activeName = st.activeSession.username;
              const localUser  = loadedUsers.find(u => u.username === activeName);
              const serverUser = serverByUsername[activeName];

              if (serverUser) {
                if (serverUser.active === false && localUser?.role !== "admin") {
                  // Pasif edilmiş normal kullanıcı → oturumu sonlandır
                  setUser(null);
                  setLogoutReason("account_removed");
                } else {
                  // Güncel user objesiyle bellekteki oturumu güncelle
                  setUser(serverUser);
                  const nameOrPassChanged =
                    localUser?.name !== serverUser.name ||
                    localUser?.password !== serverUser.password;
                  if (nameOrPassChanged) {
                    setPendingNotification({ msg: "Hesap bilgileriniz sunucudan güncellendi.", color: "var(--inf)" });
                  }
                  // Kişisel ayarları güncelle
                  if (serverUser.userSettings) setUserSettings(serverUser.userSettings);
                }
              } else if (localUser?.role === "admin") {
                // Admin sunucuda yok → kapatma, sadece uyarı
                setAdminSyncWarning(true);
              } else if (localUser) {
                // Normal kullanıcı sunucuda yok → oturumu sonlandır
                setUser(null);
                setLogoutReason("account_removed");
              }
            }
          }

          if (serverConfig.status === "fulfilled" && serverConfig.value) {
            const sc = serverConfig.value;
            if (Array.isArray(sc.fields) && sc.fields.length)      setFields(sc.fields);
            if (Array.isArray(sc.custList) && sc.custList.length)   setCustList(sc.custList);
            if (Array.isArray(sc.aciklamaList))                     setAciklamaList(sc.aciklamaList);
            if (sc.settings)                                        setSettings(sc.settings);
          }

          if (serverRecords.status === "fulfilled" && Array.isArray(serverRecords.value)) {
            const appRecords = serverRecords.value.map(r => fromDbPayload(r));
            setRecords(normalizeLoadedRecords(appRecords, loadedFields));
          }
        } catch {
          // Sunucuya ulaşılamadı — local data ile devam
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      setHydrated(true);
    })();

    return () => {
      alive = false;
    };
  }, [addShiftDate]);

  const { toasts, add: toast } = useToast();

  // Startup'tan gelen bildirimler oturum açık olunca gösterilir
  useEffect(() => {
    if (pendingNotification && user) {
      toast(pendingNotification.msg, pendingNotification.color);
      setPendingNotification(null);
    }
  }, [pendingNotification, user]);

  const isAdmin = user?.role === "admin";

  // Kişisel + global ayarları birleştir (kişisel override eder)
  const effectiveSettings = useMemo(
    () => ({ ...DEFAULT_USER_SETTINGS, ...settings, ...userSettings }),
    [settings, userSettings]
  );

  // Scroll pozisyonunu düzenleme sonrası korumak için
  const scrollAreaRef = useRef(null);
  const scrollPosRef  = useRef(null);
  useLayoutEffect(() => {
    if (scrollPosRef.current !== null && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollPosRef.current;
      scrollPosRef.current = null;
    }
  }, [records]);

  // Android geri tuşu
  const { syncRefs: syncBackButtonRefs, backPressCountRef } = useBackButton(setPage, setShowExitConfirm);
  useEffect(() => { syncBackButtonRefs(page, showExitConfirm); }, [page, showExitConfirm]);

  const visibleRecordsCount = useMemo(() => {
    if (isAdmin) return records.length;
    const currentShift = userLoginShift || getCurrentShift();
    const currentShiftDate = getShiftDate(undefined, currentShift);
    return records.filter(r =>
      r.scanned_by_username === user?.username &&
      r.shift === currentShift &&
      deriveShiftDate(r) === currentShiftDate
    ).length;
  }, [isAdmin, records, userLoginShift, user]);

  // Vardiya timer — döngüsel bağımlılık ref ile kırılır
  const handleLogoutRef = useRef(null);
  const { graceSecsLeft, graceEndTime, resetGrace, startGrace } = useShiftTimer(
    user, isAdmin, userLoginShift, handleLogoutRef
  );

  const handleLogout = useCallback((reason = null) => {
    resetGrace();
    setUser(null);
    setPage("scan");
    setUserLoginShift(null);
    setLogoutReason(reason);
    setUserSettings({});
    setAdminSyncWarning(false);
    setPendingNotification(null);
    setCustList(DEFAULT_CUSTS);
    setAciklamaList(DEFAULT_ACIKLAMAS);
  }, [resetGrace]);

  useEffect(() => { handleLogoutRef.current = handleLogout; }, [handleLogout]);

  const handleLogin = useCallback(async (u, serverUsers = null) => {
    resetGrace();
    setUser(u);
    setPage("scan");
    setLogoutReason(null);
    setAdminSyncWarning(false);
    setPendingNotification(null);
    setUserLoginShift(u.role !== "admin" ? getCurrentShift() : null);

    // Kişisel ayarları ve listeleri kullanıcı objesinden yükle
    setUserSettings(u.userSettings || {});
    setCustList(Array.isArray(u.custList) && u.custList.length ? u.custList : DEFAULT_CUSTS);
    setAciklamaList(Array.isArray(u.aciklamaList) ? u.aciklamaList : DEFAULT_ACIKLAMAS);

    // Login sayfasından serverUsers geldiyse kullanıcı listesini güncelle
    if (serverUsers) {
      setUsers(prev => {
        const serverById = Object.fromEntries(serverUsers.map(x => [x.id, x]));
        const serverByUsername = Object.fromEntries(serverUsers.map(x => [x.username, x]));
        const localOnly = prev.filter(x => !serverById[x.id] && !serverByUsername[x.username]);
        const merged = [...serverUsers, ...localOnly];
        const hasAdmin = merged.some(x => x.username === "admin");
        return hasAdmin ? merged : [INITIAL_USERS[0], ...merged];
      });
    }

    // Giriş yapınca sunucudan en güncel kayıtları çek
    const int = integrationRef.current;
    if (int.postgresApi?.active) {
      try {
        const serverRecs = await fetchServerRecords(int.postgresApi);
        if (Array.isArray(serverRecs)) {
          const appRecords = serverRecs.map(r => fromDbPayload(r));
          setRecords(() => {
            return appRecords.map(r => {
              const n = normalizeRecord(r, fieldsRef.current);
              const sd = deriveShiftDate(n);
              return sd ? { ...n, shiftDate: sd } : n;
            });
          });
        }
      } catch {
        // Sunucuya ulaşılamadı — mevcut local data ile devam
      }
    }
  }, [resetGrace]);

  // Sync queue
  const handleSyncUpdate = useCallback((id, success = true, error = null) => {
    setRecords(p => p.map(r => {
      if (r.id !== id) return r;
      return { ...r, syncStatus: success ? "synced" : "failed", syncError: error || "" };
    }));
  }, []);

  const { syncQueue, setSyncQueue, isSyncing, retryableCount, addToSyncQueue, processSyncQueue } =
    useSyncQueue(integration, toast, handleSyncUpdate);

  // Persist on changes — syncQueue'dan SONRA tanımlanmalı (minifier TDZ önleme)
  useEffect(() => {
    if (!hydrated) return;
    const activeSession = user ? {
      username: user.username,
      loginShift: userLoginShift,
      loginAt: new Date().toISOString()
    } : null;
    saveState({ users, fields, records, lastSaved, custList, aciklamaList, settings, integration, shiftTakeovers, activeSession, syncQueue, theme });
  }, [hydrated, users, fields, records, lastSaved, custList, aciklamaList, settings, integration, shiftTakeovers, user, userLoginShift, syncQueue, theme]);

  // SSE: sunucudan gelince kullanıcıları ve config'i güncelle
  const handleSSEUsersUpdate = useCallback(async () => {
    const int = integrationRef.current;
    if (!int.postgresApi?.active) return;
    try {
      const su = await fetchServerUsers(int.postgresApi);
      if (!Array.isArray(su) || !su.length) return;
      const serverByUsername = Object.fromEntries(su.map(u => [u.username, u]));
      setUsers(prev => {
        const serverById = Object.fromEntries(su.map(u => [u.id, u]));
        const localOnly = prev.filter(u => !serverById[u.id] && !serverByUsername[u.username]);
        const merged = [...su, ...localOnly];
        const hasAdmin = merged.some(u => u.username === "admin");
        return hasAdmin ? merged : [INITIAL_USERS[0], ...merged];
      });
      // Aktif kullanıcıyı güncelle (Madde 2 mantığı)
      setUser(prev => {
        if (!prev) return prev;
        const serverUser = serverByUsername[prev.username];
        if (!serverUser) return prev;
        if (serverUser.active === false && prev.role !== "admin") {
          handleLogoutRef.current?.("account_removed");
          return prev;
        }
        const changed = prev.name !== serverUser.name || prev.password !== serverUser.password;
        if (changed) setPendingNotification({ msg: "Hesap bilgileriniz sunucudan güncellendi.", color: "var(--inf)" });
        return serverUser;
      });
    } catch { /* sessiz */ }
  }, []);

  const handleSSEConfigUpdate = useCallback(async () => {
    const int = integrationRef.current;
    if (!int.postgresApi?.active) return;
    try {
      const sc = await fetchServerConfig(int.postgresApi);
      if (!sc) return;
      if (Array.isArray(sc.fields) && sc.fields.length) setFields(sc.fields);
      if (Array.isArray(sc.custList) && sc.custList.length) setCustList(sc.custList);
      if (Array.isArray(sc.aciklamaList)) setAciklamaList(sc.aciklamaList);
      if (sc.settings) setSettings(sc.settings);
    } catch { /* sessiz */ }
  }, []);

  const handleSSETaramaEvent = useCallback(async (type, { id }) => {
    const int = integrationRef.current;
    if (!int?.postgresApi?.active) return;
    try {
      if (type === "deleted") {
        setRecords(prev => prev.filter(r => r.id !== id));
        return;
      }
      // added veya updated: sunucudan tek kaydı çek
      const dbRow = await fetchServerRecord(int.postgresApi, id);
      const normalized = normalizeRecord(fromDbPayload(dbRow), fieldsRef.current);
      const sd = deriveShiftDate(normalized);
      const rec = sd ? { ...normalized, shiftDate: sd } : normalized;
      if (type === "added") {
        setRecords(prev => prev.some(r => r.id === id) ? prev : [rec, ...prev]);
      } else {
        setRecords(prev => prev.map(r => r.id === id ? rec : r));
      }
    } catch { /* sessiz */ }
  }, []);

  useServerSync({
    integration,
    onUsersUpdate: handleSSEUsersUpdate,
    onConfigUpdate: handleSSEConfigUpdate,
    onTaramaEvent: handleSSETaramaEvent,
  });

  const handleSave   = useCallback(r => {
    const normalized = normalizeRecord(r, fields);
    const rec = addShiftDate(normalized);
    setRecords(p => [rec, ...p]);
    setLastSaved(rec);
  }, [addShiftDate, fields]);

  const handleDelete = useCallback((idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const idSet = new Set(ids);
    const deletedRecords = records.filter(r => idSet.has(r.id));
    setRecords(p => p.filter(r => !idSet.has(r.id)));
    setLastSaved(p => (p && idSet.has(p.id) ? null : p));
    toast(ids.length === 1 ? "Kayıt silindi" : `${ids.length} kayıt silindi`, "var(--err)");

    if (integration.postgresApi?.active) {
      ids.forEach(id => {
        const record = deletedRecords.find(r => r.id === id);
        postgresApiDelete(integration.postgresApi, id)
          .catch(() => { if (record) addToSyncQueue("delete", id, record); });
      });
    }

    if (integration.gsheets?.active) {
      ids.forEach(id => {
        sheetsDelete(integration.gsheets, id)
          .catch(() => addToSyncQueue("delete", id, { id }, "gsheets"));
      });
    }
  }, [records, integration, toast, addToSyncQueue]);
  const handleEdit = useCallback((r) => {
    scrollPosRef.current = scrollAreaRef.current?.scrollTop ?? null;
    const normalized = normalizeRecord(r, fields);
    const rec = addShiftDate(normalized);
    rec.updatedAt = new Date().toISOString();
    setRecords(p => p.map(x => x.id === rec.id ? rec : x));
    toast("Güncellendi", "var(--inf)");

    if (integration.postgresApi?.active) {
      const dbPayload = toDbPayload(rec);
      postgresApiUpdate(integration.postgresApi, rec.id, dbPayload)
        .then(() => handleSyncUpdate?.(rec.id, true, null))
        .catch(err => {
          handleSyncUpdate?.(rec.id, false, err.message);
          addToSyncQueue("update", rec.id, rec);
          toast("PostgreSQL güncelleme başarısız, kuyruğa eklendi", "var(--acc)");
        });
    }

    if (integration.gsheets?.active) {
      syncRecordToSheets(integration.gsheets, rec, fields)
        .catch(() => addToSyncQueue("update", rec.id, { record: rec, fields }, "gsheets"));
    }
  }, [fields, addShiftDate, integration, toast, handleSyncUpdate, addToSyncQueue]);

  const handleClear  = () => {
    if (window.confirm("Tüm kayıtlar silinecek. Onaylıyor musunuz?")) {
      const recordsToDelete = [...records]; // Copy current records before clearing
      setRecords([]);
      setLastSaved(null);
      toast("Tüm veriler temizlendi", "var(--err)");

      // Sync each deletion to PostgreSQL if integration is active
      if (integration.postgresApi?.active) {
        recordsToDelete.forEach(record => {
          postgresApiDelete(integration.postgresApi, record.id)
            .catch(err => {
              // Failed - add to queue for retry
              addToSyncQueue("delete", record.id, record);
            });
        });
        if (recordsToDelete.length > 0) {
          toast(`PostgreSQL'den ${recordsToDelete.length} kayıt siliniyor...`, "var(--acc)");
        }
      }

      // Sync each deletion to Google Sheets if integration is active
      if (integration.gsheets?.active) {
        recordsToDelete.forEach(record => {
          sheetsDelete(integration.gsheets, record.id)
            .catch(e => {
              // Network error - just log it
              console.error("Sheets silme hatası:", e);
            });
        });
        if (recordsToDelete.length > 0) {
          toast(`Google Sheets'den ${recordsToDelete.length} kayıt siliniyor...`, "var(--acc)");
        }
      }
    }
  };

  const handleDeleteRange = (startLocal, endLocal) => {
    const startDate = new Date(startLocal);
    const endDate   = new Date(endLocal);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast("Geçersiz tarih aralığı", "var(--err)");
      return;
    }
    if (startDate > endDate) {
      toast("Başlangıç tarihi, bitiş tarihinden sonra olamaz", "var(--err)");
      return;
    }
    const a = startDate.toISOString();
    const b = endDate.toISOString();

    // Find records to delete before filtering
    const recordsToDelete = records.filter(r => r.timestamp >= a && r.timestamp <= b);

    // Update local state
    setRecords(p => p.filter(r => !(r.timestamp >= a && r.timestamp <= b)));
    setLastSaved(p => (p && (p.timestamp >= a && p.timestamp <= b) ? null : p));

    // Sync each deletion to PostgreSQL if integration is active
    if (integration.postgresApi?.active) {
      recordsToDelete.forEach(record => {
        postgresApiDelete(integration.postgresApi, record.id)
          .catch(err => {
            // Failed - add to queue for retry
            addToSyncQueue("delete", record.id, record);
          });
      });
      if (recordsToDelete.length > 0) {
        toast(`PostgreSQL'den ${recordsToDelete.length} kayıt siliniyor...`, "var(--acc)");
      }
    }

    // Sync each deletion to Google Sheets if integration is active
    if (integration.gsheets?.active) {
      recordsToDelete.forEach(record => {
        sheetsDelete(integration.gsheets, record.id)
          .catch(e => {
            // Network error - just log it
            console.error("Sheets silme hatası:", e);
          });
      });
      if (recordsToDelete.length > 0) {
        toast(`Google Sheets'den ${recordsToDelete.length} kayıt siliniyor...`, "var(--acc)");
      }
    }
  };

  const handleExport = async (type, ids) => {
    const recs = Array.isArray(ids) && ids.length ? records.filter(r => ids.includes(r.id)) : records;
    if (!recs.length) { toast("Dışa aktarılacak kayıt yok", "var(--acc)"); return; }
    const ef = fields.filter(f => f.id !== "barcode");

    // Export includes system fields for full data preservation
    const hdr = [
      "ID", "Barkod", "Müşteri", "Açıklama", "Kaydeden", "Kullanıcı Adı",
      "Tarih", "Saat", "Vardiya",
      "Kaynak", "Kaynak Kayıt ID", "Güncellenme", "Senkronizasyon Durumu", "Senkronizasyon Hatası",
      ...ef.map(f => f.label)
    ];

    // Helper to safely get field value while preserving data types
    const safeValue = (val) => {
      if (val == null) return "";
      // Preserve primitives (string, number, boolean) as-is for Excel
      if (typeof val !== "object") return val;
      // Convert objects/arrays to JSON string as fallback
      return JSON.stringify(val);
    };

    // Helper to get field value from record (supports both customFields and root level)
    const getFieldValue = (record, fieldId) => {
      // Check customFields first
      if (record.customFields && fieldId in record.customFields) {
        return record.customFields[fieldId];
      }
      // Fallback to root level
      return record[fieldId];
    };

    const data = recs.map(r => {
      try {
        const d = new Date(r.timestamp);
        const isValidDate = !Number.isNaN(d.getTime());

        // Use local time for date/time display
        // date: YYYY-MM-DD (local)
        // time: HH:MM:SS (local)
        const pad = (n) => String(n).padStart(2, '0');
        const dateOut = isValidDate ? `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` : "";
        const timeOut = isValidDate ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : "";

        return [
          safeValue(r.id),
          safeValue(r.barcode),
          safeValue(r.customer),
          safeValue(r.aciklama),
          safeValue(r.scanned_by),
          safeValue(r.scanned_by_username),
          dateOut,
          timeOut,
          safeValue(r.shift),
          safeValue(r.source),
          safeValue(r.sourceRecordId),
          safeValue(r.updatedAt),
          safeValue(r.syncStatus),
          safeValue(r.syncError),
          ...ef.map(f => safeValue(getFieldValue(r, f.id)))
        ];
      } catch (err) {
        console.error("Error processing record:", r, err);
        // Return a row with error indicator
        return [
          safeValue(r.barcode),
          ...ef.map(() => ""),
          "",
          "",
          "",
          "",
          ""
        ];
      }
    });
    if (type === "xlsx") {
      try {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.aoa_to_sheet([hdr, ...data]);
        ws["!cols"] = hdr.map(() => ({ wch: 20 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Taramalar");
        const filename = `scandesk_${new Date().toISOString().slice(0, 10)}.xlsx`;

        if (isNative()) {
          const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
          await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
          await Share.share({ title: "ScanDesk Excel", text: "Excel dosyası hazır", url: (await Filesystem.getUri({ directory: Directory.Cache, path: filename })).uri });
          toast("Excel hazır (Paylaş)", "var(--ok)");
        } else {
          XLSX.writeFile(wb, filename);
          toast("Excel indirildi", "var(--ok)");
        }
      } catch (err) {
        console.error("Excel export error:", err);
        toast("Excel dışa aktarma hatası: " + (err?.message || err), "var(--err)");
      }
    } else {
      try {
        const csv = [hdr, ...data].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const filename = `scandesk_${Date.now()}.csv`;
        if (isNative()) {
          await Filesystem.writeFile({ path: filename, data: "\uFEFF" + csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
          await Share.share({ title: "ScanDesk CSV", text: "CSV dosyası hazır", url: (await Filesystem.getUri({ directory: Directory.Cache, path: filename })).uri });
          toast("CSV hazır (Paylaş)", "var(--ok)");
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
          a.download = filename;
          a.click();
          toast("CSV indirildi", "var(--ok)");
        }
      } catch (err) {
        console.error("CSV export error:", err);
        toast("CSV dışa aktarma hatası: " + (err?.message || err), "var(--err)");
      }
    }
  };

  const handleImport = async (imported) => {
    if (!imported.length) { toast("İçe aktarılacak veri yok", "var(--acc)"); return; }
    // Migrate imported records to new structure
    const normalized = normalizeRecordsWithModel(imported);
    setRecords(p => [...normalized, ...p]);
    toast(`✓ ${normalized.length} kayıt içe aktarıldı`, "var(--ok)");

    // Sync each imported record to both active integrations
    const pgActive = integration.postgresApi?.active;
    const gsActive = integration.gsheets?.active;
    if ((pgActive || gsActive) && normalized.length > 0) {
      let pgSynced = 0, pgFailed = 0;
      for (const record of normalized) {
        if (pgActive) {
          try {
            await postgresApiInsert(integration.postgresApi, toDbPayload(record));
            handleSyncUpdate(record.id, true, null);
            pgSynced++;
          } catch (e) {
            handleSyncUpdate(record.id, false, e.message);
            addToSyncQueue("create", record.id, record);
            pgFailed++;
          }
        }
        if (gsActive) {
          try { await syncRecordToSheets(integration.gsheets, record, fields); }
          catch { addToSyncQueue("create", record.id, { record, fields }, "gsheets"); }
        }
      }
      if (pgActive) {
        pgFailed === 0
          ? toast(`${pgSynced} kayıt PostgreSQL'e senkronize edildi`, "var(--ok)")
          : toast(`${pgSynced} senkronize, ${pgFailed} başarısız (kuyruğa eklendi)`, "var(--acc)");
      }
      if (gsActive) toast(`${normalized.length} kayıt Google Sheets'e gönderildi`, "var(--ok)");
    }
  };

  // Wrapper setters — state'i günceller VE sunucuya iter
  const updateFields = useCallback((val) => {
    setFields(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      syncConfigToServer({ fields: next });
      return next;
    });
  }, [syncConfigToServer]);

  const updateUsers = useCallback((val) => {
    setUsers(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      syncUsersToServer(next);
      return next;
    });
  }, [syncUsersToServer]);

  // Kişisel ayar değiştirince user objesini ve sunucuyu güncelle
  const updateUserSettings = useCallback((patch) => {
    setUserSettings(prev => {
      const next = { ...prev, ...patch };
      if (user) {
        updateUsers(p => p.map(u => u.id === user.id ? { ...u, userSettings: next } : u));
        setUser(u => u ? { ...u, userSettings: next } : u);
      }
      return next;
    });
  }, [user, updateUsers]);

  const updateSettings = useCallback((val) => {
    setSettings(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      syncConfigToServer({ settings: next });
      return next;
    });
  }, [syncConfigToServer]);

  // Müşteri/açıklama değişince kullanıcı objesini güncelle ve sunucuya push et
  const syncUserLists = useCallback((custNext, aciklamaNext) => {
    if (!user) return;
    const patch = {};
    if (custNext !== undefined) patch.custList = custNext;
    if (aciklamaNext !== undefined) patch.aciklamaList = aciklamaNext;
    updateUsers(p => p.map(u => u.id === user.id ? { ...u, ...patch } : u));
    setUser(u => u ? { ...u, ...patch } : u);
  }, [user, updateUsers]);

  const customers = {
    list: custList,
    add: name => {
      if (!custList.includes(name)) {
        const next = [...custList, name];
        setCustList(next);
        syncUserLists(next, undefined);
      }
    },
    remove: name => {
      const next = custList.filter(c => c !== name);
      setCustList(next);
      syncUserLists(next, undefined);
    },
  };

  const aciklamalar = {
    list: aciklamaList,
    add: name => {
      if (!aciklamaList.includes(name)) {
        const next = [...aciklamaList, name];
        setAciklamaList(next);
        syncUserLists(undefined, next);
      }
    },
    remove: name => {
      const next = aciklamaList.filter(a => a !== name);
      setAciklamaList(next);
      syncUserLists(undefined, next);
    },
  };

  const NAV = [
    { id: "scan",     label: "Tara",      icon: I.scan },
    { id: "data",     label: "Veriler",   icon: I.data },
    { id: "report",   label: "Rapor",     icon: I.report },
    { id: "fields",   label: "Alanlar",   icon: I.fields },
    { id: "users",    label: "Kullanıcı", icon: I.users,    adminOnly: true },
    { id: "settings", label: "Ayarlar",   icon: I.settings },
  ].filter(n => !n.adminOnly || isAdmin);

  const handleMigratePassword = (userId, hashed) => {
    updateUsers(p => p.map(u => u.id === userId ? { ...u, password: hashed } : u));
  };

  const handleShiftTakeover = useCallback((shift, date) => {
    if (!user) return;
    const key = `${date}_${shift}`;
    setShiftTakeovers(p => ({
      ...p,
      [key]: { user: user.name, userId: user.id, ts: new Date().toISOString() },
    }));
  }, [user]);

  if (!hydrated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, color: "var(--tx2)" }}>
      <div style={{ width: 36, height: 36, border: "3px solid var(--brd)", borderTopColor: "var(--acc)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13 }}>Yükleniyor...</span>
    </div>
  );

  if (!user) return <Login users={users} onLogin={handleLogin} onMigratePassword={handleMigratePassword} logoutReason={logoutReason} integration={integration} />;

  return (
    <div className="shell">
      {/* TOPBAR (mobile) */}
      <div className="topbar">
        <div className="logo-icon" style={{ width: 28, height: 28, borderRadius: 7 }}><Ic d={I.barcode} s={14} /></div>
        <span style={{ fontSize: 15, fontWeight: 800 }}>ScanDesk</span>
        {(integration.postgresApi?.active || integration.gsheets?.active) && (
          <button
            className="btn btn-ghost btn-sm"
            style={{
              width: 36, height: 36, padding: 0, flexShrink: 0, position: "relative",
              background: isSyncing ? "var(--acc)" : retryableCount > 0 ? "rgba(239,68,68,.15)" : undefined,
              color: isSyncing ? "#000" : undefined,
              transition: "background 0.2s"
            }}
            onClick={processSyncQueue}
            disabled={isSyncing}
            title={isSyncing ? "Senkronize ediliyor..." : retryableCount > 0 ? `${retryableCount} bekleyen işlem` : "Senkronize et"}
          >
            <Ic d={I.refresh} s={16} style={{ animation: isSyncing ? "spin 0.7s linear infinite" : "none" }} />
            {retryableCount > 0 && !isSyncing && (
              <span style={{
                position: "absolute", top: 2, right: 2,
                background: "var(--err)", color: "#fff",
                fontSize: 9, fontWeight: 700, borderRadius: "50%",
                width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {retryableCount}
              </span>
            )}
          </button>
        )}
        <span style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--tx2)" }}>
          {NAV.find(n => n.id === page)?.label}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: 36, height: 36, padding: 0, flexShrink: 0 }}
          onClick={toggleTheme}
          title={theme === "dark" ? "Açık tema" : "Koyu tema"}
        >
          <Ic d={theme === "dark" ? I.sun : I.moon} s={16} />
        </button>
        <div className="user-pill">
          <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{(user.name || user.username || "?")[0]}</div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</span>
          {isAdmin && <span className="badge badge-acc">ADM</span>}
        </div>
      </div>

      {/* SIDEBAR (desktop) */}
      <div className="side-nav">
        <div className="side-logo">
          <div className="logo-icon" style={{ width: 30, height: 30, borderRadius: 8 }}><Ic d={I.barcode} s={14} /></div>
          ScanDesk
          {(integration.postgresApi?.active || integration.gsheets?.active) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{
                width: 32, height: 32, padding: 0, marginLeft: "auto", flexShrink: 0, position: "relative",
                background: isSyncing ? "var(--acc)" : retryableCount > 0 ? "rgba(239,68,68,.15)" : undefined,
                color: isSyncing ? "#000" : undefined,
                transition: "background 0.2s"
              }}
              onClick={processSyncQueue}
              disabled={isSyncing}
              title={isSyncing ? "Senkronize ediliyor..." : retryableCount > 0 ? `${retryableCount} bekleyen işlem` : "Senkronize et"}
            >
              <Ic d={I.refresh} s={14} style={{ animation: isSyncing ? "spin 0.7s linear infinite" : "none" }} />
              {retryableCount > 0 && !isSyncing && (
                <span style={{
                  position: "absolute", top: 1, right: 1,
                  background: "var(--err)", color: "#fff",
                  fontSize: 9, fontWeight: 700, borderRadius: "50%",
                  width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {retryableCount}
                </span>
              )}
            </button>
          )}
        </div>
        {NAV.map(n => (
          <button key={n.id} className={`side-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
            <Ic d={n.icon} s={15} />{n.label}
            {n.id === "data" && visibleRecordsCount > 0 && <span className="nav-badge" style={{ marginLeft: "auto" }}>{visibleRecordsCount}</span>}
            {n.id === "settings" && (integration.postgresApi?.active || integration.gsheets?.active) && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", marginLeft: "auto" }} />}
          </button>
        ))}
        <div className="side-footer">
          <div className="user-pill" style={{ borderRadius: "var(--r)", gap: 8 }}>
            <div className="avatar" style={{ width: 30, height: 30 }}>{(user.name || user.username || "?")[0]}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "var(--tx2)" }}>@{user.username} · {isAdmin ? "Admin" : "Kullanıcı"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="scroll-area" ref={scrollAreaRef}>
        {page === "scan"     && <ScanPage fields={fields} onSave={handleSave} onEdit={handleEdit} onSyncUpdate={handleSyncUpdate} records={records} lastSaved={lastSaved} customers={customers} aciklamalar={aciklamalar} isAdmin={isAdmin} user={user} integration={integration} scanSettings={effectiveSettings} toast={toast} shiftExpired={graceSecsLeft !== null && !isAdmin} shiftTakeovers={shiftTakeovers} onShiftTakeover={handleShiftTakeover} addToSyncQueue={addToSyncQueue} />}
        {page === "data"     && <DataPage     fields={fields} records={records} onDelete={handleDelete} onEdit={handleEdit} onExport={handleExport} onImport={handleImport} customers={customers} aciklamalar={aciklamalar} settings={effectiveSettings} toast={toast} isAdmin={isAdmin} currentShift={userLoginShift || getCurrentShift()} user={user} users={users} integration={integration} onSyncUpdate={handleSyncUpdate} />}
        {page === "report"   && <ReportPage   records={records} fields={fields} isAdmin={isAdmin} currentShift={userLoginShift || getCurrentShift()} user={user} />}
        {page === "fields"   && <FieldsPage   fields={fields} setFields={updateFields} isAdmin={isAdmin} settings={effectiveSettings} />}
        {page === "users"    && isAdmin && <UsersPage users={users} setUsers={updateUsers} currentUser={user} toast={toast} />}
        {page === "settings" && <SettingsPage settings={settings} setSettings={updateSettings} userSettings={userSettings} onUpdateUserSettings={updateUserSettings} integration={integration} setIntegration={setIntegration} isAdmin={isAdmin} onClearData={handleClear} onDeleteRange={handleDeleteRange} records={records} toast={toast} user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />}
      </div>

      {/* BOTTOM NAV (mobile) */}
      <nav className="bot-nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-btn ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
            <Ic d={n.icon} s={21} />{n.label}
            {n.id === "data" && visibleRecordsCount > 0 && <span className="nav-badge">{visibleRecordsCount}</span>}
          </button>
        ))}
      </nav>

      {/* ADMIN SUNUCU UYARISI */}
      {adminSyncWarning && isAdmin && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9100,
          background: "var(--acc)", color: "#fff",
          padding: "8px 16px", display: "flex", alignItems: "center",
          gap: 10, fontSize: 12, fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,.3)"
        }}>
          <Ic d={I.warning} s={14} />
          <span style={{ flex: 1 }}>Uyarı: Admin hesabı sunucuda bulunamadı. Local oturum devam ediyor.</span>
          <button className="btn btn-sm" style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.4)", padding: "2px 8px" }}
            onClick={() => setAdminSyncWarning(false)}>✕</button>
        </div>
      )}

      {/* GRACE PERIOD BANNER */}
      {graceSecsLeft !== null && !isAdmin && (
        <div style={{
          position: "fixed", bottom: 56, left: 0, right: 0, zIndex: 9000,
          background: "var(--err)", color: "#fff",
          padding: "10px 16px", display: "flex", alignItems: "center",
          gap: 10, fontSize: 13, fontWeight: 700,
          boxShadow: "0 -2px 12px rgba(0,0,0,.4)"
        }}>
          <Ic d={I.lock} s={16} />
          <span style={{ flex: 1 }}>
            Vardiya süresi doldu — çıkışa {Math.floor(graceSecsLeft / 60)}:{pad2(graceSecsLeft % 60)} kaldı
          </span>
          <button
            className="btn btn-sm"
            style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.4)" }}
            onClick={handleLogout}
          >
            <Ic d={I.logout} s={14} /> Çıkış Yap
          </button>
        </div>
      )}

      {/* EXIT CONFIRMATION MODAL */}
      {showExitConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "var(--card)", borderRadius: "var(--r)",
            border: "1.5px solid var(--brd)", padding: 20,
            maxWidth: 360, width: "100%",
            boxShadow: "0 8px 32px rgba(0,0,0,.4)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Ic d={I.warning} s={20} />
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Uygulamadan Çık</h3>
            </div>
            <p style={{ fontSize: 14, color: "var(--tx2)", marginBottom: 20 }}>
              Uygulamayı kapatmak istediğinizden emin misiniz? Geri tuşuna bir kez daha basın.
            </p>
            <button
              className="btn btn-ghost btn-full"
              onClick={() => {
                setShowExitConfirm(false);
                backPressCountRef.current = 0;
              }}
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderColor: t.color, color: t.color }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
