import type {
  Account,
  Category,
  Transaction,
  TransactionTemplate,
  TallyResponse,
  SummaryResponse,
  AuthResponse,
  LoginReq,
  RegisterReq,
  PaymentMethod,
  User,
} from './types';

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
  getLedgerId: () => string | null;
  onUnauthorized: () => void;
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getToken, getLedgerId, onUnauthorized } = config;

  async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const token = getToken();
    const ledgerId = getLedgerId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'User-Agent': 'FintrackMobileApp/1.0.0',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (ledgerId) {
      headers['X-Ledger-Id'] = ledgerId;
    }

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const res = await fetch(baseUrl + url, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      if (url !== '/login') {
        onUnauthorized();
      }
      throw new Error('Invalid credentials or unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  const authApi = {
    me: () => request<User>('/me'),
    login: (data: LoginReq) =>
      request<AuthResponse>('/login', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: RegisterReq) =>
      request<AuthResponse>('/register', { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (data: any) =>
      request<{ message: string }>('/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    updatePreferences: (preferences: Record<string, any>) =>
      request<{ preferences: Record<string, any> }>('/users/me/preferences', { method: 'PUT', body: JSON.stringify({ preferences }) }),
  };

  const adminApi = {
    listUsers: () => request<any[]>('/admin/users'),
    resetPassword: (data: { user_id: number; temp_password: string }) =>
      request<{ message: string }>('/admin/users/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    deleteUser: (id: number) =>
      request<void>(`/admin/users/${id}`, { method: 'DELETE' }),
  };

  const ledgersApi = {
    list: () => request<import('./types').Ledger[]>('/ledgers'),
    create: (data: { name: string }) =>
      request<import('./types').Ledger>('/ledgers', { method: 'POST', body: JSON.stringify(data) }),
  };

  const importApi = {
    uploadCsv: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // For FormData, we must delete the content-type header so fetch sets the correct boundary
      const headers: Record<string, string> = { 'X-Ledger-Id': getLedgerId() || '' };
      const token = getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return fetch(baseUrl + '/import/csv', {
        method: 'POST',
        headers,
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'Import failed');
        }
        return res.json();
      });
    },
  };

  const accountsApi = {
    list: (params?: { type?: 'ASSET' | 'LIABILITY' }) => {
      const qs = params?.type ? `?type=${params.type}` : '';
      return request<Account[]>(`/accounts${qs}`);
    },
    get: (id: number, params?: { date_before?: string; date_to?: string }) => {
      let url = `/accounts/${id}`;
      if (params) {
        const parts: string[] = [];
        if (params.date_before) parts.push(`date_before=${encodeURIComponent(params.date_before)}`);
        if (params.date_to) parts.push(`date_to=${encodeURIComponent(params.date_to)}`);
        if (parts.length > 0) {
          url += `?${parts.join('&')}`;
        }
      }
      return request<Account>(url);
    },
    create: (data: { name: string; type: string; initial_balance: number; interest_rate: number }) =>
      request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; is_active?: boolean; interest_rate?: number }) =>
      request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  };

  const categoriesApi = {
    list: (params?: { nature?: string }) => {
      let url = '/categories';
      if (params?.nature) {
        url += `?nature=${encodeURIComponent(params.nature)}`;
      }
      return request<Category[]>(url);
    },
    create: (data: { name: string; nature: string }) =>
      request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string }) =>
      request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/categories/${id}`, { method: 'DELETE' }),
    createSub: (categoryId: number, data: { name: string }) =>
      request<Category>(`/categories/${categoryId}/subcategories`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateSub: (categoryId: number, subId: number, data: { name: string }) =>
      request<Category>(`/categories/${categoryId}/subcategories/${subId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteSub: (categoryId: number, subId: number) =>
      request<void>(`/categories/${categoryId}/subcategories/${subId}`, {
        method: 'DELETE',
      }),
  };

  const paymentMethodsApi = {
    list: () => request<PaymentMethod[]>('/payment-methods'),
    create: (data: { name: string }) =>
      request<PaymentMethod>('/payment-methods', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string }) =>
      request<PaymentMethod>(`/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/payment-methods/${id}`, { method: 'DELETE' }),
  };

  const transactionsApi = {
    list: (params?: Record<string, string>) => {
      let qs = '';
      if (params && Object.keys(params).length > 0) {
        qs = '?' + Object.entries(params)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
      }
      return request<Transaction[]>(`/transactions${qs}`);
    },
    get: (id: number) => request<Transaction>(`/transactions/${id}`),
    create: (data: Omit<Transaction, 'id' | 'created_at' | 'ledger_id'>) =>
      request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Omit<Transaction, 'id' | 'created_at' | 'ledger_id'>) =>
      request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/transactions/${id}`, { method: 'DELETE' }),
  };

  const templatesApi = {
    list: () => request<TransactionTemplate[]>('/templates'),
    create: (data: Omit<TransactionTemplate, 'id' | 'created_at' | 'ledger_id'>) =>
      request<TransactionTemplate>('/templates', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/templates/${id}`, { method: 'DELETE' }),
    execute: (id: number) =>
      request<Transaction>(`/templates/${id}/execute`, { method: 'POST' }),
  };

  const tallyApi = {
    get: (accountId: number) => request<TallyResponse>(`/tally/${accountId}`),
    check: (accountId: number, actualBalance: number) =>
      request<TallyResponse>(`/tally/${accountId}`, {
        method: 'POST',
        body: JSON.stringify({ actual_balance: actualBalance }),
      }),
  };

  const summaryApi = {
    get: (month: string) => request<SummaryResponse>(`/summary?month=${month}`),
    getRange: (from: string, to: string) =>
      request<SummaryResponse[]>(`/summary/range?from=${from}&to=${to}`),
  };

  return {
    authApi,
    ledgersApi,
    importApi,
    accountsApi,
    categoriesApi,
    paymentMethodsApi,
    transactionsApi,
    templatesApi,
    tallyApi,
    summaryApi,
    adminApi,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
