import { useState, useMemo } from "react";
import { Ic, I } from "../ui/Icon";
import { FIXED_SHIFTS, toggleSetMember, getShiftDate, deriveShiftDate } from "../../utils";
import Modal from "../ui/Modal";

export default function ShiftInheritModal({ currentShift, currentUser, records, onCopy, onClose }) {
  const today = getShiftDate();

  // Calculate yesterday's date
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  }, []);

  // Stage 1: Shift selection (now includes date+shift combinations)
  // Stage 2: User selection
  // Stage 3: Record selection
  const [stage, setStage] = useState(1);

  const allLabels = FIXED_SHIFTS.map(s => s.label);
  const otherShifts = allLabels.filter(s => s !== currentShift);
  const defaultSrc = otherShifts[0] || currentShift;

  const [sourceShift, setSourceShift] = useState(defaultSrc);
  const [sourceDate, setSourceDate] = useState(today); // New state for selected date
  const [sourceUser, setSourceUser] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [customerFilter, setCustomerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get users who have records in the selected source shift for the selected date
  const usersInSourceShift = useMemo(() => {
    const userMap = new Map();

    (records || [])
      .filter(r => r.shift === sourceShift && deriveShiftDate(r) === sourceDate)
      .forEach(r => {
        const username = r.scanned_by_username;
        const name = r.scanned_by || username;
        if (!userMap.has(username)) {
          userMap.set(username, {
            username,
            name,
            count: 0,
            lastTimestamp: r.timestamp
          });
        }
        const userData = userMap.get(username);
        userData.count++;
        if (r.timestamp > userData.lastTimestamp) {
          userData.lastTimestamp = r.timestamp;
        }
      });

    return Array.from(userMap.values()).sort((a, b) => b.count - a.count);
  }, [records, sourceShift, sourceDate]);

  // Get records for the selected user in the selected shift
  const userRecords = useMemo(() => {
    if (!sourceUser) return [];

    // Get current user's already taken-over records to prevent duplicates
    const alreadyTakenSourceIds = new Set(
      (records || [])
        .filter(r =>
          r.scanned_by_username === currentUser.username &&
          r.shift === currentShift &&
          deriveShiftDate(r) === today &&
          r.source === "shift_takeover" &&
          r.sourceRecordId
        )
        .map(r => r.sourceRecordId)
    );

    return (records || [])
      .filter(r =>
        r.shift === sourceShift &&
        deriveShiftDate(r) === sourceDate &&
        r.scanned_by_username === sourceUser.username &&
        !alreadyTakenSourceIds.has(r.id) // Exclude records already taken over
      )
      .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
  }, [records, sourceShift, sourceDate, sourceUser, today, currentUser, currentShift]);

  // Get unique customers from user records
  const uniqueCustomers = useMemo(() => {
    const customers = [...new Set(userRecords.map(r => r.customer).filter(Boolean))].sort();
    return customers;
  }, [userRecords]);

  // Apply filters to user records
  const filteredRecords = useMemo(() => {
    return userRecords.filter(r => {
      // Customer filter
      if (customerFilter !== "all" && r.customer !== customerFilter) return false;

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const barcode = String(r.barcode || "").toLowerCase();
        const customer = String(r.customer || "").toLowerCase();
        const scannedBy = String(r.scanned_by || "").toLowerCase();

        if (!barcode.includes(query) && !customer.includes(query) && !scannedBy.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [userRecords, customerFilter, searchQuery]);

  const handleShiftSelect = (shift, date) => {
    setSourceShift(shift);
    setSourceDate(date);
    setSourceUser(null);
    setSelected(new Set());
    setCustomerFilter("all");
    setSearchQuery("");
    setStage(2);
  };

  const handleUserSelect = (user) => {
    setSourceUser(user);
    setCustomerFilter("all");
    setSearchQuery("");
    setStage(3);
    // Auto-select all records by default
    const newRecords = (records || [])
      .filter(r =>
        r.shift === sourceShift &&
        deriveShiftDate(r) === sourceDate &&
        r.scanned_by_username === user.username
      );

    // Check for already taken records
    const alreadyTakenSourceIds = new Set(
      (records || [])
        .filter(r =>
          r.scanned_by_username === currentUser.username &&
          r.shift === currentShift &&
          deriveShiftDate(r) === today &&
          r.source === "shift_takeover" &&
          r.sourceRecordId
        )
        .map(r => r.sourceRecordId)
    );

    const selectableIds = newRecords
      .filter(r => !alreadyTakenSourceIds.has(r.id))
      .map(r => r.id);

    setSelected(new Set(selectableIds));
  };

  const handleBack = () => {
    if (stage === 3) {
      setStage(2);
      setSourceUser(null);
      setSelected(new Set());
      setCustomerFilter("all");
      setSearchQuery("");
    } else if (stage === 2) {
      setStage(1);
      setSourceUser(null);
      setSelected(new Set());
      setCustomerFilter("all");
      setSearchQuery("");
    }
  };

  const toggle = (id) => setSelected(p => toggleSetMember(p, id));

  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every(r => selected.has(r.id));

  const getTitle = () => {
    if (stage === 1) return "Hangi Vardiyadan Devralacaksınız?";
    if (stage === 2) return "Hangi Kullanıcıdan Devralacaksınız?";
    return "Hangi Kayıtları Devralacaksınız?";
  };

  const footer = (
    <>
      {stage > 1 && (
        <button className="btn btn-ghost" style={{ width: 88 }} onClick={handleBack}>
          <span style={{ transform: "rotate(180deg)", display: "inline-block" }}><Ic d={I.chevR} s={15} /></span> Geri
        </button>
      )}
      {stage === 3 && (
        <button
          className="btn btn-ok"
          style={{ flex: 1 }}
          disabled={selected.size === 0}
          onClick={() => onCopy(sourceShift, sourceUser.username, [...selected], sourceDate)}
        >
          <Ic d={I.save} s={15} /> Devral ({selected.size})
        </button>
      )}
      <button className="btn btn-ghost" style={{ width: 88 }} onClick={onClose}>
        {stage === 3 ? "İptal" : "Kapat"}
      </button>
    </>
  );

  return (
    <Modal title={getTitle()} icon={I.upload} onClose={onClose} footer={footer}>
      {/* Stage 1: Shift Selection */}
      {stage === 1 && (
        <>
          {otherShifts.length === 0 ? (
            <div style={{ color: "var(--tx3)", fontSize: 13 }}>Başka vardiya yok.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Today's shifts */}
              {otherShifts.map(shift => {
                const recordCount = (records || []).filter(r =>
                  r.shift === shift && deriveShiftDate(r) === today
                ).length;

                if (recordCount === 0) return null;

                return (
                  <button
                    key={`${today}-${shift}`}
                    className="btn btn-ghost"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 14
                    }}
                    onClick={() => handleShiftSelect(shift, today)}
                  >
                    <span style={{ fontWeight: 700 }}>{today} / {shift}</span>
                    <span style={{ fontSize: 12, color: "var(--tx3)" }}>{recordCount} kayıt</span>
                  </button>
                );
              })}

              {/* Yesterday's shifts */}
              {otherShifts.map(shift => {
                const recordCount = (records || []).filter(r =>
                  r.shift === shift && deriveShiftDate(r) === yesterday
                ).length;

                if (recordCount === 0) return null;

                return (
                  <button
                    key={`${yesterday}-${shift}`}
                    className="btn btn-ghost"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 14
                    }}
                    onClick={() => handleShiftSelect(shift, yesterday)}
                  >
                    <span style={{ fontWeight: 700 }}>{yesterday} / {shift}</span>
                    <span style={{ fontSize: 12, color: "var(--tx3)" }}>{recordCount} kayıt</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Stage 2: User Selection */}
      {stage === 2 && (
        <>
          <div style={{ fontSize: 13, color: "var(--tx2)", marginBottom: 12 }}>
            Kaynak Vardiya: <b>{sourceDate} / {sourceShift}</b>
          </div>
          {usersInSourceShift.length === 0 ? (
            <div style={{ color: "var(--tx3)", fontSize: 13 }}>
              Bu vardiyada kayıt bulunamadı.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {usersInSourceShift.map(user => (
                <button
                  key={user.username}
                  className="btn btn-ghost"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: 14
                  }}
                  onClick={() => handleUserSelect(user)}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: "var(--tx3)" }}>@{user.username}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--tx3)" }}>{user.count} kayıt</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Stage 3: Record Selection */}
      {stage === 3 && (
        <>
          <div style={{ fontSize: 12, color: "var(--tx2)", marginBottom: 12 }}>
            <b>{sourceDate} / {sourceShift}</b> / <b>{sourceUser?.name}</b>
          </div>

          {userRecords.length === 0 ? (
            <div style={{ color: "var(--tx3)", fontSize: 13, marginTop: 12 }}>
              Bu kullanıcıya ait devralınabilir kayıt bulunamadı.
              <div style={{ fontSize: 11, marginTop: 4 }}>(Tüm kayıtlar zaten devralınmış olabilir.)</div>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <div className="srch" style={{ flex: "1 1 140px", minWidth: 120 }}>
                    <span className="srch-ico"><Ic d={I.search} s={16} /></span>
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Barkod ara..."
                    />
                  </div>
                  {uniqueCustomers.length > 0 && (
                    <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                      <select
                        value={customerFilter}
                        onChange={e => setCustomerFilter(e.target.value)}
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 10,
                          padding: "0 10px",
                          background: "var(--s2)",
                          color: "var(--tx)",
                          border: "1.5px solid var(--brd)",
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        <option value="all">Tüm Müşteriler</option>
                        {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {(customerFilter !== "all" || searchQuery) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setCustomerFilter("all"); setSearchQuery(""); }}
                    style={{ fontSize: 11 }}
                  >
                    <Ic d={I.close} s={12} /> Filtreleri Temizle
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--tx2)" }}>
                  {filteredRecords.length} kayıt · <b>{selected.size}</b> seçili
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() =>
                  setSelected(allFilteredSelected ? new Set() : new Set([...selected, ...filteredRecords.map(r => r.id)]))
                }>
                  {allFilteredSelected ? "Görünenleri Kaldır" : "Görünenleri Seç"}
                </button>
              </div>

              <div style={{ maxHeight: 240, overflow: "auto", border: "1.5px solid var(--brd)", borderRadius: "var(--r)", padding: 4, background: "var(--s1)" }}>
                {filteredRecords.length === 0 ? (
                  <div style={{ color: "var(--tx3)", fontSize: 12, padding: 12, textAlign: "center" }}>
                    Filtreye uygun kayıt bulunamadı
                  </div>
                ) : (
                  filteredRecords.map((r, i) => (
                    <label
                      key={r.id}
                      className="chk-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 6px",
                        borderBottom: i === filteredRecords.length - 1 ? "none" : "1px solid var(--brd)",
                        cursor: "pointer",
                        background: selected.has(r.id) ? "var(--s2)" : "transparent",
                        borderRadius: 6,
                        margin: "2px 0"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bc" style={{ fontWeight: 800 }}>{r.barcode}</div>
                        <div style={{ fontSize: 11, color: "var(--tx3)" }}>
                          {r.customer || "—"} · {new Date(r.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
