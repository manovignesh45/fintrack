import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      if (isRegistering) {
        await authApi.register({ username, password });
        const loginRes = await authApi.login({ username, password });
        await login(loginRes.user, loginRes.token);
      } else {
        const res = await authApi.login({ username, password });
        await login(res.user, res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-100"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center p-4">
        <View className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mx-auto w-full max-w-md">
          <Text className="text-2xl font-bold text-center mb-6 text-indigo-600">
            FinTrack
          </Text>
          <Text className="text-xl font-semibold text-center mb-8">
            {isRegistering ? 'Create an Account' : 'Login to Your Account'}
          </Text>

          {error ? (
            <View className="bg-red-100 border border-red-400 rounded-md px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</Text>
            <TextInput
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter username"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</Text>
            <View className="relative">
              <TextInput
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm pr-10"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter password"
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

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`w-full py-3 rounded-md ${submitting ? 'bg-indigo-400' : 'bg-indigo-600'}`}
          >
            <Text className="text-white text-center font-medium">
              {submitting ? 'Please wait...' : isRegistering ? 'Register' : 'Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsRegistering(!isRegistering)}
            className="mt-6"
          >
            <Text className="text-indigo-600 text-sm text-center">
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
