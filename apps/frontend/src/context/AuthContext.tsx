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

    if (savedToken && savedUser) {
      setToken(savedToken);
      const parsedUser = JSON.parse(savedUser) as User;
      setUser(parsedUser);
      if (parsedUser.preferences?.editMode !== undefined) {
        setEditMode(parsedUser.preferences.editMode);
      }
    }
    setLoading(false);
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
    setUser(newUser);
    setToken(newToken);
    if (newUser.preferences?.editMode !== undefined) {
      setEditMode(newUser.preferences.editMode);
    }
    if (newUser.preferences?.theme) {
      localStorage.setItem('fintrack-theme', newUser.preferences.theme);
      // Reload to apply theme cleanly on first login from a new device
      window.location.reload();
    }
    localStorage.setItem('fintrack_token', newToken);
    localStorage.setItem('fintrack_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('fintrack_user');
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
