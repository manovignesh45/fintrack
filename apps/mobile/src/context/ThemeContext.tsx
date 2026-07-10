import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { authApi, tokenCache } from '../api/client';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    SecureStore.getItemAsync('fintrack-theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved);
        setColorScheme(saved);
      }
    });
  }, [setColorScheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setColorScheme(newTheme);
    SecureStore.setItemAsync('fintrack-theme', newTheme);
    if (tokenCache.get()) {
      authApi.updatePreferences({ theme: newTheme }).catch(console.error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
