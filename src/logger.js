/**
 * Basit logger modülü.
 * Production build'de sessiz çalışır, development'ta console'a yazar.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  warn:  (...args) => { if (isDev) console.warn(...args);  },
  error: (...args) => { if (isDev) console.error(...args); },
  info:  (...args) => { if (isDev) console.info(...args);  },
};
