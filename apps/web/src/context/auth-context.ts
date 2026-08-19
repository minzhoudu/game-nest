import { createContext } from 'react';
import type { StoredUser } from '../lib/auth-storage';

export interface AuthContextValue {
  user: StoredUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
