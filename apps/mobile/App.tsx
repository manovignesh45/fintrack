import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { checkHealth } from './src/api/client';

export default function App() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('Not tested yet.');

  const onPressTestBackend = async () => {
    setStatus('loading');
    setMessage('Checking backend...');

    try {
      const result = await checkHealth();
      if (result.ok) {
        setStatus('success');
        setMessage(`Connected. Status ${result.status}. Body: ${result.body || '(empty)'}`);
      } else {
        setStatus('error');
        setMessage(`Backend responded with status ${result.status}. Body: ${result.body || '(empty)'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus('error');
      setMessage(`Connection failed: ${errorMessage}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Hello world!</Text>
      <Text style={styles.subtitle}>FinTrack mobile bootstrap</Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onPressTestBackend}
        disabled={status === 'loading'}
      >
        <Text style={styles.buttonText}>{status === 'loading' ? 'Testing...' : 'Test Backend'}</Text>
      </Pressable>

      <View style={styles.resultBox}>
        <Text style={styles.resultLabel}>Status: {status}</Text>
        {status === 'loading' ? <ActivityIndicator size="small" color="#2563eb" /> : null}
        <Text style={styles.resultMessage}>{message}</Text>
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  resultMessage: {
    fontSize: 13,
    color: '#334155',
  },
});
