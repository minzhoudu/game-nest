import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { AUTH_CLEARED_EVENT, clearAuth, getStoredAuth, setStoredAuth } from '../lib/auth-storage';
import type { StoredUser } from '../lib/auth-storage';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context';

interface AuthState {
  user: StoredUser | null;
  token: string | null;
}

function readState(): AuthState {
  const stored = getStoredAuth();
  return stored ? { user: stored.user, token: stored.token } : { user: null, token: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readState);

  useEffect(() => {
    const sync = () => setState(readState());
    window.addEventListener('storage', sync); // another tab logged in/out
    window.addEventListener(AUTH_CLEARED_EVENT, sync); // this tab, e.g. after a 401
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(AUTH_CLEARED_EVENT, sync);
    };
  }, []);

  const login: AuthContextValue['login'] = async (email, password) => {
    const result = await api.login({ email, password });
    setStoredAuth(result.accessToken, result.user);
    setState({ user: result.user, token: result.accessToken });
  };

  const register: AuthContextValue['register'] = async (email, password) => {
    const result = await api.register({ email, password });
    setStoredAuth(result.accessToken, result.user);
    setState({ user: result.user, token: result.accessToken });
  };

  const loginWithGoogle: AuthContextValue['loginWithGoogle'] = async (idToken) => {
    const result = await api.loginWithGoogle(idToken);
    setStoredAuth(result.accessToken, result.user);
    setState({ user: result.user, token: result.accessToken });
  };

  const logout = () => {
    clearAuth();
    setState({ user: null, token: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
