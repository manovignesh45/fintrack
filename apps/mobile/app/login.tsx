import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

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

  // Apply the logged-in user's saved theme immediately (no app restart needed).
  const applyUserTheme = (theme?: string) => {
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      setTheme(theme);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
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

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 bg-gray-100 dark:bg-gray-900"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center p-4">
        <View className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mx-auto w-full max-w-md">
          <Text className="text-2xl font-bold text-center mb-6 text-indigo-600 dark:text-indigo-400">
            FinTrack
          </Text>
          <Text className="text-xl font-semibold text-center mb-8 text-gray-800 dark:text-gray-100">
            {isForgotPassword ? 'Reset Password' : isRegistering ? 'Create an Account' : 'Login to Your Account'}
          </Text>

          {error ? (
            <View className="bg-red-100 border border-red-400 rounded-md px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</Text>
            <TextInput
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter username"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {isForgotPassword ? (
            <View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Temporary Password</Text>
                <View className="relative">
                  <TextInput
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm pr-10 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                    value={tempPassword}
                    onChangeText={setTempPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter temp password"
                    placeholderTextColor="#9ca3af"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5"
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">New Password</Text>
                <TextInput
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          ) : (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</Text>
              <View className="relative">
                <TextInput
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm pr-10 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Enter password"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`w-full py-3 rounded-md ${submitting ? 'bg-indigo-400' : 'bg-indigo-600'}`}
          >
            <Text className="text-white text-center font-medium">
              {submitting ? 'Please wait...' : isForgotPassword ? 'Reset Password' : isRegistering ? 'Register' : 'Login'}
            </Text>
          </TouchableOpacity>

          <View className="mt-6 space-y-4">
            {!isForgotPassword && !isRegistering && (
              <TouchableOpacity onPress={() => setIsForgotPassword(true)}>
                <Text className="text-indigo-600 dark:text-indigo-400 text-sm text-center">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            {(isForgotPassword || isRegistering) ? (
              <TouchableOpacity onPress={() => { setIsRegistering(false); setIsForgotPassword(false); }}>
                <Text className="text-indigo-600 dark:text-indigo-400 text-sm text-center">
                  Back to Login
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setIsRegistering(true)}>
                <Text className="text-indigo-600 dark:text-indigo-400 text-sm text-center">
                  Need an account? Register
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
