import { useState, useCallback } from "react";
import { genId, TOAST_DURATION_MS } from "../constants";

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, color = "var(--ok)") => {
    const id = genId();
    setToasts(p => [...p, { id, msg, color }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), TOAST_DURATION_MS);
  }, []);
  return { toasts, add };
}
