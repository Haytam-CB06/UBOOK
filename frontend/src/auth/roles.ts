const SESSION_ROLE_KEY = "ubook_session_role";
type BrowserSessionStorage = "local" | "session";
const SESSION_STORAGE_MODE: BrowserSessionStorage =
  import.meta.env.VITE_AUTH_SESSION_STORAGE === "session" ? "session" : "local";

function getStorage(mode: BrowserSessionStorage): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return mode === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function getPreferredStorage(): Storage | null {
  return getStorage(SESSION_STORAGE_MODE) || getStorage("local") || getStorage("session");
}

function getFallbackStorage(): Storage | null {
  return getStorage(SESSION_STORAGE_MODE === "local" ? "session" : "local");
}

export function storeSessionRole(role?: string | null): void {
  if (!role) return;
  getPreferredStorage()?.setItem(SESSION_ROLE_KEY, role);
}

export function clearStoredSessionRole(): void {
  getStorage("local")?.removeItem(SESSION_ROLE_KEY);
  getStorage("session")?.removeItem(SESSION_ROLE_KEY);
}

export function getStoredSessionRole(): string | null {
  return getPreferredStorage()?.getItem(SESSION_ROLE_KEY) || getFallbackStorage()?.getItem(SESSION_ROLE_KEY) || null;
}
