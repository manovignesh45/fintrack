import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; bg: string }> = {
  success: { icon: 'checkmark-circle', bg: 'bg-green-600' },
  error: { icon: 'alert-circle', bg: 'bg-red-600' },
  info: { icon: 'information-circle', bg: 'bg-gray-800' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, type });
    Haptics.notificationAsync(
      type === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
    ).catch(() => {});
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, 2400);
  }, [opacity]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{ opacity, bottom: insets.bottom + 24 }}
          className="absolute left-4 right-4 items-center"
        >
          <View className={`flex-row items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${CONFIG[toast.type].bg}`}>
            <Ionicons name={CONFIG[toast.type].icon} size={18} color="white" />
            <Text className="text-white font-medium flex-shrink">{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
