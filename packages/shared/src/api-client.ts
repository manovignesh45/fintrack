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
      onUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  const authApi = {
    login: (data: LoginReq) =>
      request<AuthResponse>('/login', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: RegisterReq) =>
      request<AuthResponse>('/register', { method: 'POST', body: JSON.stringify(data) }),
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
        const search = new URLSearchParams();
        if (params.date_before) search.set('date_before', params.date_before);
        if (params.date_to) search.set('date_to', params.date_to);
        const qs = search.toString();
        if (qs) url += `?${qs}`;
      }
      return request<Account>(url);
    },
    create: (data: { name: string; type: string; initial_balance: number; interest_rate: number }) =>
      request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; is_active?: boolean }) =>
      request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  };

  const categoriesApi = {
    list: (params?: { nature?: string }) => {
      const search = new URLSearchParams();
      if (params?.nature) search.set('nature', params.nature);
      const qs = search.toString();
      return request<Category[]>(`/categories${qs ? `?${qs}` : ''}`);
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

  const transactionsApi = {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
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
  };

  return {
    authApi,
    ledgersApi,
    importApi,
    accountsApi,
    categoriesApi,
    transactionsApi,
    templatesApi,
    tallyApi,
    summaryApi,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
