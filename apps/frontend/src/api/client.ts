import { createApiClient } from '@fintrack/shared';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const client = createApiClient({
  baseUrl: BASE,
  getToken: () => localStorage.getItem('fintrack_token'),
  getLedgerId: () => localStorage.getItem('fintrack_ledger_id'),
  onUnauthorized: () => {
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('fintrack_user');
    localStorage.removeItem('fintrack_ledger_id');
    window.location.href = '/login';
  },
});

export const authApi = {
  ...client.authApi,
  logout: () => {
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('fintrack_user');
    localStorage.removeItem('fintrack_ledger_id');
    window.location.href = '/login';
  },
};

export const ledgersApi = client.ledgersApi;
export const importApi = client.importApi;

export const accountsApi = client.accountsApi;
export const categoriesApi = client.categoriesApi;
export const transactionsApi = client.transactionsApi;
export const templatesApi = client.templatesApi;
export const tallyApi = client.tallyApi;
export const summaryApi = client.summaryApi;
export const adminApi = client.adminApi;
