import { createApiClient } from '@fintrack/shared';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const client = createApiClient({
  baseUrl: BASE,
  getToken: () => localStorage.getItem('fintrack_token'),
  onUnauthorized: () => {
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('fintrack_user');
    window.location.href = '/login';
  },
});

export const authApi = {
  ...client.authApi,
  logout: () => {
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('fintrack_user');
    window.location.href = '/login';
  },
};

export const accountsApi = client.accountsApi;
export const categoriesApi = client.categoriesApi;
export const transactionsApi = client.transactionsApi;
export const templatesApi = client.templatesApi;
export const tallyApi = client.tallyApi;
export const summaryApi = client.summaryApi;
