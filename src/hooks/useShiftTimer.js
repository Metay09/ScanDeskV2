import { useState, useEffect, useRef } from "react";
import { getCurrentShift, getShiftEndTime } from "../utils";

const GRACE_PERIOD_SECS = 300; // 5 dakika

/**
 * Vardiya bitimini ve grace period geri sayımını yönetir.
 *
 * @param {object|null} user           - Oturum açmış kullanıcı
 * @param {boolean}     isAdmin        - Admin mi?
 * @param {string|null} userLoginShift - Kullanıcının giriş yaptığı vardiya
 * @param {React.MutableRefObject} onLogoutRef - handleLogout'a ref (döngüsel bağımlılığı kırar)
 *
 * @returns {{ graceSecsLeft, graceEndTime, setGraceSecsLeft, setGraceEndTime }}
 *   - `setGraceSecsLeft` ve `setGraceEndTime`: login/logout akışından dışarıdan set edilebilir
 */
export function useShiftTimer(user, isAdmin, userLoginShift, onLogoutRef) {
  const [graceSecsLeft, setGraceSecsLeft] = useState(null);
  const [graceEndTime,  setGraceEndTime]  = useState(null);
  const inGraceRef = useRef(false);

  // Dışarıdan reset için public setter — inGraceRef de sıfırlanır
  const resetGrace = () => {
    inGraceRef.current = false;
    setGraceSecsLeft(null);
    setGraceEndTime(null);
  };

  // Grace başlangıcını dışarıdan (restore-session) set etmek için
  const startGrace = (endTime) => {
    inGraceRef.current = true;
    setGraceEndTime(endTime);
    const secsLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    setGraceSecsLeft(secsLeft);
  };

  // Vardiya bitimi algılama
  useEffect(() => {
    if (!user || isAdmin || !userLoginShift) return;

    const id = setInterval(() => {
      if (inGraceRef.current) return;
      const current = getCurrentShift();
      if (current !== userLoginShift) {
        inGraceRef.current = true;
        const shiftEnd = getShiftEndTime(userLoginShift);
        const endTime = (shiftEnd && shiftEnd > Date.now())
          ? shiftEnd + GRACE_PERIOD_SECS * 1000
          : Date.now() + GRACE_PERIOD_SECS * 1000;
        setGraceEndTime(endTime);
        setGraceSecsLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
      }
    }, 15_000);

    return () => clearInterval(id);
  }, [user, isAdmin, userLoginShift]);

  // Grace geri sayımı
  useEffect(() => {
    if (graceEndTime === null || !user) return;

    let id;
    const update = () => {
      const secsLeft = Math.max(0, Math.floor((graceEndTime - Date.now()) / 1000));
      if (secsLeft === 0) {
        clearInterval(id);
        onLogoutRef.current?.("shift_expired");
      } else {
        setGraceSecsLeft(secsLeft);
      }
    };

    update();
    id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [graceEndTime, user, onLogoutRef]);

  return { graceSecsLeft, graceEndTime, setGraceSecsLeft, setGraceEndTime, resetGrace, startGrace };
}
