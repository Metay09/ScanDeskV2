export const pad2 = (n) => String(n).padStart(2, "0");
export const nowTs = () => new Date().toISOString();

export const fmtDate = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};

export const fmtTime = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Sabit vardiyalar — değiştirilemez
// 12-8 : 00:00-07:59, 8-4 : 08:00-15:59, 4-12 : 16:00-23:59
export const FIXED_SHIFTS = [
  { label: "12-8", start: 0,  end: 8  },
  { label: "8-4",  start: 8,  end: 16 },
  { label: "4-12", start: 16, end: 24 },
];

// Saate göre vardiya etiketini döner (0-23)
export const getShiftByHour = (h) => {
  if (h < 8)  return "12-8";
  if (h < 16) return "8-4";
  return "4-12";
};

// Şu anki saate göre aktif vardiyayı döner
export const getCurrentShift = () => getShiftByHour(new Date().getHours());

// Get the end time (in milliseconds since epoch) for a given shift
export const getShiftEndTime = (shiftLabel) => {
  const now = new Date();
  const shift = FIXED_SHIFTS.find(s => s.label === shiftLabel);
  if (!shift) return null;

  const endHour = shift.end % 24; // Handle 24 -> 0
  const endTime = new Date(now);
  endTime.setHours(endHour, 0, 0, 0);

  // If end hour is before current hour, shift ends tomorrow (for overnight shifts like 4-12)
  const currentHour = now.getHours();
  if (endHour <= currentHour && shift.start > endHour) {
    endTime.setDate(endTime.getDate() + 1);
  }

  return endTime.getTime();
};

// Kayıtların ait olduğu vardiya tarihini hesapla (iş günü)
export const getShiftDate = (ts, shiftLabel) => {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const shift = shiftLabel || getShiftByHour(d.getHours());
  // Gerektiğinde vardiya sınırları gün değişimini geçiyorsa burada ayarlanabilir
  return fmtDate(d);
};

// Varsa shiftDate kullan, yoksa timestamp üzerinden hesapla
export const deriveShiftDate = (record) => {
  if (!record) return "";
  if (record.shiftDate) return record.shiftDate;
  const ts = record.timestamp || nowTs();
  return getShiftDate(ts, record.shift);
};

export async function hashPassword(plain, saltHex) {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    keyMaterial, 256
  );
  const hashHex  = bytesToHex(new Uint8Array(bits));
  const saltHexOut = bytesToHex(salt);
  return `pbkdf2:${saltHexOut}:${hashHex}`;
}

export async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":");
    const saltHex = parts[1];
    const recomputed = await hashPassword(plain, saltHex);
    return recomputed === stored;
  }
  // legacy: plaintext stored before hashing was introduced
  return plain === stored;
}

export function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 1900; osc.type = "square";
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    osc.start(); osc.stop(ctx.currentTime + 0.11);
  } catch {}
}

// Toggle a value in a Set (add if not present, remove if present)
export function toggleSetMember(set, value) {
  const newSet = new Set(set);
  newSet.has(value) ? newSet.delete(value) : newSet.add(value);
  return newSet;
}

// Convert byte array to hex string
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Safely extract customer list from customers prop
export function getCustomerList(customers) {
  return Array.isArray(customers) ? customers : (customers?.list || []);
}
