import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import {
  isPinSet,
  verifyPin,
  isBiometricEnabled,
  authenticateBiometric,
} from '../lib/appLock';

/**
 * App-lock state. Sits in front of AuthGate: when a PIN is configured, an
 * already-authenticated session starts *locked* on cold start and re-locks after
 * the app has been backgrounded past LOCK_TIMEOUT_MS. The token itself stays in
 * SecureStore (see TokenCache) — this only gates the UI.
 */
interface AppLockContextType {
  /** A PIN is configured, so the lock feature is active. */
  lockEnabled: boolean;
  /** Session is currently locked and should show the lock screen. */
  isLocked: boolean;
  /** Still resolving initial lock config on mount. */
  loading: boolean;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  /** Whether biometric unlock is switched on (only meaningful with a PIN). */
  biometricEnabled: boolean;
  /** Force the lock immediately (unused by UI today; handy for testing). */
  lockNow: () => void;
  /** Re-read PIN/biometric config after the settings screen changes it. */
  refreshLockConfig: () => Promise<void>;
}

const LOCK_TIMEOUT_MS = 60_000;

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [lockEnabled, setLockEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const backgroundedAt = useRef<number | null>(null);

  // Resolve lock config once on mount. If a PIN exists, start locked so a cold
  // start always requires an unlock before the app is revealed.
  useEffect(() => {
    (async () => {
      try {
        const [pinSet, bio] = await Promise.all([isPinSet(), isBiometricEnabled()]);
        setLockEnabled(pinSet);
        setBiometricEnabledState(bio);
        setIsLocked(pinSet);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshLockConfig = useCallback(async () => {
    const [pinSet, bio] = await Promise.all([isPinSet(), isBiometricEnabled()]);
    setLockEnabled(pinSet);
    setBiometricEnabledState(bio);
    // If the PIN was just turned off, drop any lock. Enabling a PIN while already
    // in the app leaves the current session unlocked (the next launch will lock).
    if (!pinSet) setIsLocked(false);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) setIsLocked(false);
    return ok;
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const ok = await authenticateBiometric();
    if (ok) setIsLocked(false);
    return ok;
  }, []);

  const lockNow = useCallback(() => {
    if (lockEnabled) setIsLocked(true);
  }, [lockEnabled]);

  // Background timeout: re-lock when returning to the foreground after being away
  // longer than the timeout. A cold kill re-locks via the mount effect above, so
  // keeping the timestamp in a ref (lost on kill) is sufficient.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (lockEnabled && isAuthenticated && since !== null && Date.now() - since > LOCK_TIMEOUT_MS) {
          setIsLocked(true);
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [lockEnabled, isAuthenticated]);

  return (
    <AppLockContext.Provider
      value={{
        lockEnabled,
        isLocked,
        loading,
        unlockWithPin,
        unlockWithBiometric,
        biometricEnabled,
        lockNow,
        refreshLockConfig,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};
