import { createApiClient } from '@fintrack/shared';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://fintrack-seg6.onrender.com/api';

let onUnauthorizedCallback: (() => void) | null = null;
let currentLedgerId: string | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function setApiLedgerId(id: string | null) {
  currentLedgerId = id;
}

const client = createApiClient({
  baseUrl: BASE_URL,
  getToken: () => {
    // SecureStore is sync-ish on native but we need sync access here.
    // We cache the token in memory after loading from SecureStore.
    return tokenCache.get();
  },
  getLedgerId: () => currentLedgerId,
  onUnauthorized: () => {
    tokenCache.clear();
    currentLedgerId = null;
    onUnauthorizedCallback?.();
  },
});

// In-memory token cache backed by SecureStore
class TokenCache {
  private token: string | null = null;
  private loaded = false;

  async load(): Promise<string | null> {
    try {
      this.token = await SecureStore.getItemAsync('fintrack_token');
    } catch {
      this.token = null;
    }
    this.loaded = true;
    return this.token;
  }

  get(): string | null {
    return this.token;
  }

  async set(token: string) {
    this.token = token;
    await SecureStore.setItemAsync('fintrack_token', token);
  }

  async clear() {
    this.token = null;
    await SecureStore.deleteItemAsync('fintrack_token');
    await SecureStore.deleteItemAsync('fintrack_user');
  }

  isLoaded() {
    return this.loaded;
  }
}

export const tokenCache = new TokenCache();

export const authApi = client.authApi;
export const accountsApi = client.accountsApi;
export const categoriesApi = client.categoriesApi;
export const transactionsApi = client.transactionsApi;
export const templatesApi = client.templatesApi;
export const tallyApi = client.tallyApi;
export const summaryApi = client.summaryApi;
export const ledgersApi = client.ledgersApi;
