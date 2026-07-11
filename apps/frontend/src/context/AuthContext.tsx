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
        const u = freshUser as User;
        localStorage.setItem('fintrack_user', JSON.stringify(u));
        setUser(u);
        setToken(savedToken);
        if (u.preferences?.editMode !== undefined) {
          setEditMode(u.preferences.editMode);
        }
      })
      .catch(() => {
        // Token invalid/expired (e.g. issued by a different backend). Clear it.
        setUser(null);
        setToken(null);
        localStorage.removeItem('fintrack_token');
        localStorage.removeItem('fintrack_user');
        localStorage.removeItem('fintrack_ledger_id');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSetEditMode = (v: boolean) => {
    setEditMode(v);
    if (user) {
      const updatedUser = { ...user, preferences: { ...user.preferences, editMode: v } };
      setUser(updatedUser);
      localStorage.setItem('fintrack_user', JSON.stringify(updatedUser));
      authApi.updatePreferences({ editMode: v }).catch(console.error);
    }
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
    if (newUser.preferences?.editMode !== undefined) {
      setEditMode(newUser.preferences.editMode);
    }
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
