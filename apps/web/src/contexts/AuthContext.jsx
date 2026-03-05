'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authLogin, authRegister, authRefresh, authMe } from '@/lib/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rem_access_token';
const REFRESH_KEY = 'rem_refresh_token';
const USER_KEY = 'rem_user';

// ゲストユーザーオブジェクト
const GUEST_USER = {
  id: 'guest',
  email: '',
  org_id: '',
  org_name: '',
  role: 'guest',
  display_name: 'ゲスト',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  // Restore session on mount — デフォルトでゲストモード
  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setIsGuest(false);
      } catch {
        // 復元失敗 → ゲスト
        setUser(GUEST_USER);
        setIsGuest(true);
      }
    } else {
      // トークンなし → ゲストモードで自動開始
      setUser(GUEST_USER);
      setIsGuest(true);
    }
    setLoading(false);
  }, []);

  // Auto-refresh token every 25 minutes (認証ユーザーのみ)
  useEffect(() => {
    const interval = setInterval(async () => {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!refresh) return;
      try {
        const data = await authRefresh(refresh);
        localStorage.setItem(TOKEN_KEY, data.access_token);
      } catch {
        // refresh failed — ゲストにフォールバック
        loginAsGuest();
      }
    }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loginAsGuest = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(GUEST_USER);
    setIsGuest(true);
    setError(null);
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await authLogin({ email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setIsGuest(false);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (email, password, orgName, displayName) => {
    setError(null);
    try {
      const data = await authRegister({ email, password, orgName, displayName });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setIsGuest(false);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    // ログアウト → ゲストに戻る
    loginAsGuest();
  }, [loginAsGuest]);

  const getAccessToken = useCallback(() => {
    if (isGuest) return null;
    return localStorage.getItem(TOKEN_KEY);
  }, [isGuest]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      isAuthenticated: !!user && !isGuest,
      isGuest,
      login,
      loginAsGuest,
      register,
      logout,
      getAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: GUEST_USER,
      loading: false,
      error: null,
      isAuthenticated: false,
      isGuest: true,
      login: async () => {},
      loginAsGuest: () => {},
      register: async () => {},
      logout: () => {},
      getAccessToken: () => null,
    };
  }
  return ctx;
}
