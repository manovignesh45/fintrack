import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@fintrack/shared';
import { tokenCache, setOnUnauthorized, authApi, setApiLedgerId } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [editMode, setEditMode] = useState(true);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setApiLedgerId(null);
    await tokenCache.clear();
    await AsyncStorage.removeItem('fintrack_ledger_id');
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

        if (!savedToken || !savedUserStr) {
          return;
        }

        // Validate the persisted token BEFORE activating the session. The token
        // is already in tokenCache (from tokenCache.load()), so authApi.me()
        // uses it without needing React state. Only mark the session active if
        // it's valid — this prevents ledger-scoped requests (LedgerContext keys
        // off `token`) from firing with a stale/invalid token and 401'ing.
        try {
          const freshUser = await authApi.me();
          await SecureStore.setItemAsync('fintrack_user', JSON.stringify(freshUser));
          setUser(freshUser);
          setToken(savedToken);
          if (freshUser.preferences?.editMode !== undefined) {
            setEditMode(freshUser.preferences.editMode);
          }
        } catch {
          // Token invalid/expired (e.g. issued by a different backend). Clear it
          // and fall through to the login screen.
          await logout();
        }
      } catch {
        // Failed to load auth state
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, [logout]);

  const handleSetEditMode = (v: boolean) => {
    setEditMode(v);
    if (user) {
      const updatedUser = { ...user, preferences: { ...user.preferences, editMode: v } };
      setUser(updatedUser);
      SecureStore.setItemAsync('fintrack_user', JSON.stringify(updatedUser)).catch(console.error);
      authApi.updatePreferences({ editMode: v }).catch(console.error);
    }
  };

  const login = async (newUser: User, newToken: string) => {
    // Populate the token cache FIRST. The api client reads the token from
    // tokenCache (in-memory), and LedgerContext fires /ledgers as soon as the
    // `token` state changes. If we flipped state before setting the cache, that
    // request would go out with the previous (or empty) token and 401.
    await tokenCache.set(newToken);
    // A freshly logged-in user must NOT inherit the previous user's active
    // ledger — sending it would 403 as "you do not own this ledger".
    setApiLedgerId(null);
    await AsyncStorage.removeItem('fintrack_ledger_id');
    await SecureStore.setItemAsync('fintrack_user', JSON.stringify(newUser));
    if (newUser.preferences?.theme) {
      await SecureStore.setItemAsync('fintrack-theme', newUser.preferences.theme);
    }
    // Now activate the session — LedgerContext fetches with the token in place.
    setUser(newUser);
    setToken(newToken);
    if (newUser.preferences?.editMode !== undefined) {
      setEditMode(newUser.preferences.editMode);
    }
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
        setEditMode: handleSetEditMode,
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
