import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * App-lock storage helper. Owns the device-local PIN + biometric preference used
 * to gate an already-authenticated session (see AppLockContext). The PIN is a
 * quick-unlock credential — it never leaves the device and is never sent to the
 * backend. Keys follow the existing `fintrack_*` SecureStore convention used by
 * TokenCache in src/api/client.ts.
 */
const PIN_HASH_KEY = 'fintrack_pin_hash';
const PIN_SALT_KEY = 'fintrack_pin_salt';
const BIOMETRIC_KEY = 'fintrack_biometric_enabled';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** Store a salted SHA-256 hash of the PIN. Overwrites any existing PIN. */
export async function setPin(pin: string): Promise<void> {
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

/** Re-hash the candidate PIN with the stored salt and compare. */
export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!salt || !stored) return false;
  const candidate = await hashPin(pin, salt);
  // Length is fixed (SHA-256 hex), so a direct compare is fine here.
  return candidate === stored;
}

export async function isPinSet(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return !!stored;
}

/** Remove the PIN and, implicitly, biometric unlock (which requires a PIN). */
export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return v === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  }
}

export interface BiometricCapability {
  available: boolean;
  /** True when hardware exists but no fingerprint/face is enrolled. */
  hasHardware: boolean;
  isEnrolled: boolean;
  /** Human label for the primary supported modality, e.g. "Fingerprint". */
  label: string;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  // Prefer Fingerprint: many Android devices report FACIAL_RECOGNITION as a
  // supported type even when only a fingerprint is enrolled, so checking facial
  // first mislabels them. iPhones with Face ID never report FINGERPRINT, so they
  // still fall through to the correct label.
  let label = 'Biometrics';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    label = 'Fingerprint';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    label = 'Face ID';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    label = 'Iris';
  }

  return { available: hasHardware && isEnrolled, hasHardware, isEnrolled, label };
}

/** Prompt the OS biometric sheet. Returns true only on a confirmed success. */
export async function authenticateBiometric(promptMessage = 'Unlock FinTrack'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use PIN',
    // Allow the OS device-credential fallback (pattern/passcode) if biometrics fail.
    disableDeviceFallback: false,
  });
  return result.success;
}
