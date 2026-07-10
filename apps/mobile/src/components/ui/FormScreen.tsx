import { forwardRef, useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * KeyboardScreen — KAV shell for screens that own their own ScrollView/FAB.
 *
 * Under Expo SDK 54 edge-to-edge, Android's native `adjustResize` no longer
 * shrinks the window for the keyboard, so a JS-side KeyboardAvoidingView is the
 * only thing that keeps lower fields reachable. `behavior="padding"` is used on
 * both platforms deliberately — the usual Android `undefined` relies on native
 * resize, which is inert here.
 *
 * These screens run with the native Stack header hidden (their own inline header
 * is the single header), so we apply the top safe-area inset here and the KAV
 * offset is 0. Reading HeaderHeightContext directly (rather than useHeaderHeight)
 * avoids throwing when no header context is present.
 */
export function KeyboardScreen({
  children,
  className = 'flex-1 bg-gray-50 dark:bg-gray-900',
}: {
  children: ReactNode;
  className?: string;
}) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={{ paddingTop: insets.top }}
      className={className}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

interface FormScreenProps {
  children: ReactNode;
  /** Fixed row rendered above the scroll area (e.g. an inline back-arrow header). */
  header?: ReactNode;
  contentContainerClassName?: string;
  className?: string;
}

/**
 * FormScreen — KeyboardScreen + ScrollView, for form screens. Forwards a ref to
 * the inner ScrollView so callers can `scrollToEnd()` when focusing bottom fields.
 */
export const FormScreen = forwardRef<ScrollView, FormScreenProps>(function FormScreen(
  { children, header, contentContainerClassName = 'p-4 pb-8', className },
  ref
) {
  return (
    <KeyboardScreen className={className}>
      {header}
      <ScrollView
        ref={ref}
        className="flex-1"
        contentContainerClassName={contentContainerClassName}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Constrain form width on tablets / large screens; full-width on phones. */}
        <View className="w-full max-w-xl self-center">{children}</View>
      </ScrollView>
    </KeyboardScreen>
  );
});
