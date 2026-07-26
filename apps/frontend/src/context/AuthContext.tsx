import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../api/types';
import { authApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  updatePreferences: (partial: Record<string, any>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('fintrack_token');
    const savedUser = localStorage.getItem('fintrack_user');

    if (!savedToken || !savedUser) {
      setLoading(false);
      return;
    }

    // Validate the persisted token BEFORE activating the session, so no
    // ledger-scoped request fires with a stale/invalid token. The api client's
    // getToken reads localStorage, so me() uses the saved token directly.
    authApi
      .me()
      .then((freshUser) => {
        // A newer login/register may have replaced this session while the
        // request was in flight — don't clobber it with the stale result.
        if (localStorage.getItem('fintrack_token') !== savedToken) return;
        const u = freshUser as User;
        localStorage.setItem('fintrack_user', JSON.stringify(u));
        setUser(u);
        setToken(savedToken);
        // Unconditional: a prior session in this same tab may have left
        // editMode at a stale value that this user's preferences don't
        // mention, so always resolve it (defaulting true) rather than only
        // overwriting when the key is present.
        setEditMode(u.preferences?.editMode ?? true);
      })
      .catch(() => {
        // Same race: if a newer session has already taken over, don't wipe it.
        if (localStorage.getItem('fintrack_token') !== savedToken) return;
        // Token invalid/expired (e.g. issued by a different backend). Clear it.
        setUser(null);
        setToken(null);
        localStorage.removeItem('fintrack_token');
        localStorage.removeItem('fintrack_user');
        localStorage.removeItem('fintrack_ledger_id');
      })
      .finally(() => setLoading(false));
  }, []);

  const updatePreferences = (partial: Record<string, any>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updatedUser = { ...prev, preferences: { ...prev.preferences, ...partial } };
      localStorage.setItem('fintrack_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
    authApi.updatePreferences(partial).catch(console.error);
  };

  const handleSetEditMode = (v: boolean) => {
    setEditMode(v);
    updatePreferences({ editMode: v });
  };

  const login = (newUser: User, newToken: string) => {
    // Persist the session first so the next render's route guards / data
    // fetches immediately see the new identity.
    localStorage.setItem('fintrack_token', newToken);
    localStorage.setItem('fintrack_user', JSON.stringify(newUser));
    // A freshly logged-in user must NOT inherit the previous user's active
    // ledger — sending it would 403 as "you do not own this ledger".
    localStorage.removeItem('fintrack_ledger_id');
    if (newUser.preferences?.theme) {
      localStorage.setItem('fintrack-theme', newUser.preferences.theme);
    }
    setUser(newUser);
    setToken(newToken);
    // Unconditional (see comment in the mount-validation effect above): a
    // previous user's session in this tab must not leak its editMode into
    // this login.
    setEditMode(newUser.preferences?.editMode ?? true);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('fintrack_user');
    localStorage.removeItem('fintrack_ledger_id');
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
        updatePreferences,
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
