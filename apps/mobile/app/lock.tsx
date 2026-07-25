import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useAppLock } from '@/src/context/AppLockContext';
import { PinPad } from '@/src/components/PinPad';
import { useThemeColors } from '@/src/theme/colors';

/**
 * Lock screen shown when an authenticated session is locked. PIN is the base
 * credential; biometric (if enabled) auto-prompts and always falls back to the
 * PIN pad. "Log in with password" is the forgot-PIN escape hatch — it clears the
 * session so AuthGate routes to /login.
 */
export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { logout, user } = useAuth();
  const { unlockWithPin, unlockWithBiometric, biometricEnabled } = useAppLock();
  const [error, setError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);

  const tryBiometric = useCallback(async () => {
    try {
      await unlockWithBiometric();
    } catch {
      // Cancelled or failed — silently fall back to the PIN pad.
    }
  }, [unlockWithBiometric]);

  // Auto-prompt biometrics on mount when enabled.
  useEffect(() => {
    if (biometricEnabled) tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = useCallback(
    async (pin: string) => {
      setVerifying(true);
      setError(undefined);
      const ok = await unlockWithPin(pin);
      setVerifying(false);
      if (!ok) setError('Incorrect PIN. Try again.');
    },
    [unlockWithPin]
  );

  return (
    <View
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 justify-center px-6">
        {/* Branding */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-blue-600 dark:bg-blue-500 items-center justify-center mb-3">
            <Ionicons name="lock-closed" size={30} color="#ffffff" />
          </View>
          <Text className="text-base text-gray-500 dark:text-gray-400">
            {user?.username ? `Welcome back, ${user.username}` : 'FinTrack is locked'}
          </Text>
        </View>

        <PinPad
          title="Enter PIN"
          subtitle="Enter your 4-digit PIN to unlock"
          error={error}
          disabled={verifying}
          onComplete={handleComplete}
          bottomLeft={
            biometricEnabled ? (
              <TouchableOpacity
                onPress={tryBiometric}
                accessibilityLabel="Unlock with biometrics"
                className="items-center justify-center rounded-full"
                style={{ width: 68, height: 68 }}
              >
                <Ionicons name="finger-print" size={30} color={colors.iconActive} />
              </TouchableOpacity>
            ) : null
          }
        />
      </View>

      {/* Forgot-PIN escape hatch */}
      <View className="items-center pb-4">
        <TouchableOpacity onPress={logout} activeOpacity={0.7} className="py-3 px-6">
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Log in with password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
