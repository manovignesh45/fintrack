import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@fintrack/shared';
import { tokenCache, setOnUnauthorized, authApi, setApiLedgerId } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPin } from '../lib/appLock';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => Promise<void>;
  /** Pass { clearLock: true } for an explicit user logout so the device PIN /
   *  biometric is removed too. Transient/401 logouts keep the lock configured. */
  logout: (opts?: { clearLock?: boolean }) => Promise<void>;
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

  const logout = useCallback(async (opts?: { clearLock?: boolean }) => {
    setUser(null);
    setToken(null);
    setApiLedgerId(null);
    await tokenCache.clear();
    await AsyncStorage.removeItem('fintrack_ledger_id');
    // Only an explicit user logout wipes the device-local PIN/biometric. A
    // transient startup failure or an automatic 401 keeps it configured so the
    // user can unlock again on the next launch / re-login.
    if (opts?.clearLock) {
      await clearPin();
    }
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

        // Restore the session from the cached user immediately so the app opens
        // (and the PIN / biometric lock screen appears) even when the backend is
        // cold-starting or the device is offline. Validation happens in the
        // background below.
        let cachedUser: User;
        try {
          cachedUser = JSON.parse(savedUserStr);
        } catch {
          // Corrupt cache — clear everything and fall through to login.
          await logout({ clearLock: true });
          return;
        }
        setUser(cachedUser);
        setToken(savedToken);
        if (cachedUser.preferences?.editMode !== undefined) {
          setEditMode(cachedUser.preferences.editMode);
        }

        // Background validation. A genuine 401 fires the global onUnauthorized
        // handler (-> logout), clearing the invalid session. Network/timeout
        // errors are swallowed so a slow backend never signs the user out.
        authApi
          .me()
          .then((freshUser) => {
            SecureStore.setItemAsync('fintrack_user', JSON.stringify(freshUser)).catch(() => {});
            setUser(freshUser);
            if (freshUser.preferences?.editMode !== undefined) {
              setEditMode(freshUser.preferences.editMode);
            }
          })
          .catch(() => {
            // Keep the cached session on transient failures.
          });
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
