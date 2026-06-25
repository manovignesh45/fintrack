import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@fintrack/shared';
import { tokenCache, setOnUnauthorized } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    await tokenCache.clear();
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
  }, [logout]);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const savedToken = await tokenCache.load();
        const savedUserStr = await SecureStore.getItemAsync('fintrack_user');

        if (savedToken && savedUserStr) {
          setToken(savedToken);
          setUser(JSON.parse(savedUserStr));
        }
      } catch {
        // Failed to load auth state
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);

  const login = async (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    await tokenCache.set(newToken);
    await SecureStore.setItemAsync('fintrack_user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        loading,
        editMode,
        setEditMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
