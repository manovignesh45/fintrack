import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { PinPad } from '@/src/components/PinPad';
import { useAppLock } from '@/src/context/AppLockContext';
import { useToast } from '@/src/context/ToastContext';
import { isPinSet, verifyPin, setPin } from '@/src/lib/appLock';

type Phase = 'current' | 'new' | 'confirm';

/**
 * PIN setup / change flow. If a PIN already exists, the user must first enter the
 * current one; otherwise it starts at "choose a new PIN". Confirm step must match.
 */
export default function PinSetupScreen() {
  const router = useRouter();
  const toast = useToast();
  const { refreshLockConfig } = useAppLock();
  const [phase, setPhase] = useState<Phase>('new');
  const [firstEntry, setFirstEntry] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (await isPinSet()) setPhase('current');
      setReady(true);
    })();
  }, []);

  const handleComplete = useCallback(
    async (pin: string) => {
      setError(undefined);
      if (phase === 'current') {
        const ok = await verifyPin(pin);
        if (!ok) {
          setError('Incorrect current PIN.');
          return;
        }
        setPhase('new');
        return;
      }
      if (phase === 'new') {
        setFirstEntry(pin);
        setPhase('confirm');
        return;
      }
      // confirm
      if (pin !== firstEntry) {
        setFirstEntry('');
        setPhase('new');
        setError('PINs did not match. Try again.');
        return;
      }
      await setPin(pin);
      await refreshLockConfig();
      toast.showToast('PIN saved', 'success');
      router.back();
    },
    [phase, firstEntry, refreshLockConfig, router, toast]
  );

  const copy: Record<Phase, { title: string; subtitle: string }> = {
    current: { title: 'Enter current PIN', subtitle: 'Confirm your existing PIN to continue' },
    new: { title: 'Choose a new PIN', subtitle: 'Pick a 4-digit PIN to unlock the app' },
    confirm: { title: 'Confirm PIN', subtitle: 'Re-enter your new PIN' },
  };

  return (
    <KeyboardScreen>
      <ScreenHeader title="App Lock PIN" />
      <View className="flex-1 justify-center px-6">
        {ready && (
          <PinPad
            // Remount per phase so the internal buffer resets cleanly.
            key={phase}
            title={copy[phase].title}
            subtitle={copy[phase].subtitle}
            error={error}
            onComplete={handleComplete}
          />
        )}
      </View>
    </KeyboardScreen>
  );
}
