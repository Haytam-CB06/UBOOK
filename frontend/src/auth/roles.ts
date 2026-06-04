const SESSION_ROLE_KEY = "ubook_session_role";

export function storeSessionRole(role?: string | null): void {
  if (!role) return;
  window.localStorage.setItem(SESSION_ROLE_KEY, role);
}

export function clearStoredSessionRole(): void {
  window.localStorage.removeItem(SESSION_ROLE_KEY);
}

export function getStoredSessionRole(): string | null {
  return window.localStorage.getItem(SESSION_ROLE_KEY);
}