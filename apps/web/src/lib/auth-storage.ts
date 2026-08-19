export interface StoredUser {
  id: string;
  email: string;
}

const TOKEN_KEY = 'gamenest.token';
const USER_KEY = 'gamenest.user';

/** Fired whenever auth is cleared, including from the *same* tab (unlike
 * the native `storage` event, which only fires in other tabs) — lets
 * AuthProvider react immediately when client.ts clears a token after a 401. */
export const AUTH_CLEARED_EVENT = 'gamenest:auth-cleared';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredAuth(): { token: string; user: StoredUser } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as StoredUser };
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
}
