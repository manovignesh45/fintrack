import { forwardRef, useRef, useState, type ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Keyboard, type TextInputProps, type TextInputInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useThemeColors } from '@/src/theme/colors';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { Button } from '@/src/components/ui/Button';

type Mode = 'login' | 'register' | 'reset';

const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  login: { title: 'Welcome back', subtitle: 'Log in to keep tracking your money', cta: 'Log in' },
  register: { title: 'Create your account', subtitle: 'Start tracking every rupee in minutes', cta: 'Create account' },
  reset: { title: 'Reset password', subtitle: 'Enter your temporary password and choose a new one', cta: 'Reset password' },
};

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { setTheme } = useTheme();
  const passwordRef = useRef<TextInputInstance>(null);
  const tempPasswordRef = useRef<TextInputInstance>(null);
  const newPasswordRef = useRef<TextInputInstance>(null);

  const mode: Mode = isForgotPassword ? 'reset' : isRegistering ? 'register' : 'login';
  const copy = COPY[mode];

  const switchMode = (next: Mode) => {
    setError('');
    setShowPassword(false);
    setIsRegistering(next === 'register');
    setIsForgotPassword(next === 'reset');
  };

  // Apply the logged-in user's saved theme immediately (no app restart needed).
  const applyUserTheme = (theme?: string) => {
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      setTheme(theme);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    Keyboard.dismiss();
    setError('');
    setSubmitting(true);
    try {
      if (isForgotPassword) {
        await authApi.resetPassword({ username, temp_password: tempPassword, new_password: newPassword });
        setIsForgotPassword(false);
        setPassword('');
        setTempPassword('');
        setNewPassword('');
        Alert.alert('Success', 'Password reset successfully. You can now login.');
      } else if (isRegistering) {
        await authApi.register({ username, password });
        const loginRes = await authApi.login({ username, password });
        await login(loginRes.user, loginRes.token);
        applyUserTheme(loginRes.user.preferences?.theme);
      } else {
        const res = await authApi.login({ username, password });
        await login(res.user, res.token);
        applyUserTheme(res.user.preferences?.theme);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const eyeToggle = (
    <TouchableOpacity
      onPress={() => setShowPassword((v) => !v)}
      hitSlop={10}
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
    >
      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    // Content is top-anchored (not vertically centred) so the keyboard opening/closing never
    // moves it: FormScreen's KAV only shrinks the viewport from the bottom, and top-aligned
    // content stays put, keeping the submit button under the user's finger. On very small
    // screens the ScrollView still lets the button scroll above the keyboard.
    <FormScreen className="flex-1 bg-gray-50 dark:bg-gray-900" contentContainerClassName="px-6 pt-10 pb-8">
      <View className="w-full max-w-md self-center">
        {/* Brand */}
        <View className="flex-row items-center mb-8">
          <View className="w-11 h-11 rounded-xl bg-blue-600 dark:bg-blue-500 items-center justify-center mr-3">
            <Ionicons name="trending-up" size={24} color="#ffffff" />
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-50">FinTrack</Text>
        </View>

        {/* Heading */}
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50">{copy.title}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-7">{copy.subtitle}</Text>

        {error ? (
          <View className="flex-row items-start bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 mb-4">
            <Ionicons name="alert-circle" size={18} color="#dc2626" style={{ marginTop: 1 }} />
            <Text className="flex-1 text-sm text-red-700 dark:text-red-300 ml-2">{error}</Text>
          </View>
        ) : null}

        {/* Fields */}
        <AuthField
          icon="person-outline"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholder="Username"
          accessibilityLabel="Username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => (isForgotPassword ? tempPasswordRef : passwordRef).current?.focus()}
        />

        {mode === 'reset' ? (
          <>
            <AuthField
              ref={tempPasswordRef}
              icon="key-outline"
              value={tempPassword}
              onChangeText={setTempPassword}
              secureTextEntry={!showPassword}
              placeholder="Temporary password"
              accessibilityLabel="Temporary password"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
              right={eyeToggle}
            />
            <AuthField
              ref={newPasswordRef}
              icon="lock-closed-outline"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              placeholder="New password"
              accessibilityLabel="New password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </>
        ) : (
          <AuthField
            ref={passwordRef}
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder="Password"
            accessibilityLabel="Password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            right={eyeToggle}
          />
        )}

        {mode === 'login' ? (
          <TouchableOpacity onPress={() => switchMode('reset')} hitSlop={8} className="self-end -mt-1 mb-6">
            <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Forgot password?</Text>
          </TouchableOpacity>
        ) : (
          <View className="h-3" />
        )}

        <Button
          title={submitting ? 'Please wait…' : copy.cta}
          loading={submitting}
          onPress={handleSubmit}
        />

        {/* Mode switch */}
        <View className="flex-row justify-center items-center mt-6">
          {mode === 'login' ? (
            <>
              <Text className="text-sm text-gray-500 dark:text-gray-400">New to FinTrack? </Text>
              <TouchableOpacity onPress={() => switchMode('register')} hitSlop={8}>
                <Text className="text-sm font-semibold text-blue-600 dark:text-blue-400">Create an account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {mode === 'register' ? 'Already have an account? ' : 'Remembered it? '}
              </Text>
              <TouchableOpacity onPress={() => switchMode('login')} hitSlop={8}>
                <Text className="text-sm font-semibold text-blue-600 dark:text-blue-400">Log in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </FormScreen>
  );
}

/** Tall input with a leading icon, optional trailing element and a blue focus ring. */
const AuthField = forwardRef<
  TextInputInstance,
  TextInputProps & { icon: keyof typeof Ionicons.glyphMap; right?: ReactNode }
>(function AuthField({ icon, right, onFocus, onBlur, ...props }, ref) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={`flex-row items-center h-12 px-3.5 mb-3 rounded-lg border bg-white dark:bg-gray-800 ${
        focused ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <Ionicons name={icon} size={18} color={focused ? colors.blue : colors.iconMuted} />
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        className="flex-1 h-full ml-2.5 text-[15px] text-gray-900 dark:text-gray-100"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {right ? <View className="ml-2">{right}</View> : null}
    </View>
  );
});
