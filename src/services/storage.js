import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { logger } from "../logger";

export const STORAGE_KEY = "scandesk_state_v2";
export const isNative = () => Capacitor.isNativePlatform && Capacitor.isNativePlatform();

export async function loadState() {
  try {
    if (isNative()) {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      return value ? JSON.parse(value) : null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error("loadState failed:", err);
    return null;
  }
}

export async function saveState(state) {
  try {
    const raw = JSON.stringify(state);
    if (isNative()) await Preferences.set({ key: STORAGE_KEY, value: raw });
    else localStorage.setItem(STORAGE_KEY, raw);
  } catch (err) {
    logger.error("saveState failed:", err);
  }
}
