import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { api, TOKEN_KEY } from '@/src/api';

export type Role = 'customer' | 'driver' | 'admin';
export type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  online?: boolean;
  tricycle_no?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginPhone: (phone: string, name: string) => Promise<void>;
  signupEmail: (name: string, email: string, password: string) => Promise<void>;
  signupPhone: (name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = await storage.secureGet<string>(TOKEN_KEY, '');
    if (token) {
      try {
        const me = (await api.me()) as User;
        setUser(me);
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const finish = async (res: { token: string; user: User }) => {
    await storage.secureSet(TOKEN_KEY, res.token);
    setUser(res.user);
  };

  const loginEmail = async (email: string, password: string) =>
    finish((await api.login({ email, password })) as any);
  const loginPhone = async (phone: string, name: string) =>
    finish((await api.login({ phone, name })) as any);
  const signupEmail = async (name: string, email: string, password: string) =>
    finish((await api.signup({ name, email, password })) as any);
  const signupPhone = async (name: string, phone: string) =>
    finish((await api.signup({ name, phone })) as any);

  const refresh = async () => {
    try {
      setUser((await api.me()) as User);
    } catch {
      /* ignore */
    }
  };

  const logout = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{ user, loading, loginEmail, loginPhone, signupEmail, signupPhone, logout, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
