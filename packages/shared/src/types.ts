export type AccountType = 'ASSET' | 'LIABILITY';
export type TxNature = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'EMI_PAYMENT' | 'LOAN_DISBURSEMENT';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'superadmin' | 'user';
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Ledger {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Account {
  id: number;
  ledger_id: number;
  name: string;
  type: AccountType;
  initial_balance: number;
  current_balance: number;
  total_disbursed: number;
  interest_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  ledger_id: number;
  name: string;
  nature: TxNature;
  created_at: string;
  sub_categories?: SubCategory[];
}

export interface SubCategory {
  id: number;
  category_id: number;
  ledger_id: number;
  name: string;
  created_at: string;
}

export interface PaymentMethod {
  id: number;
  ledger_id: number;
  name: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  ledger_id: number;
  title: string;
  amount: number;
  nature: TxNature;
  source_account_id: number;
  target_account_id?: number;
  sub_category_id?: number;
  payment_method_id?: number;
  notes?: string;
  principal_amount: number;
  interest_amount: number;
  transaction_date: string;
  created_at: string;
}

export interface TransactionTemplate {
  id: number;
  ledger_id: number;
  title: string;
  amount: number;
  nature: TxNature;
  source_account_id: number;
  target_account_id?: number;
  sub_category_id?: number;
  payment_method_id?: number;
  principal_amount: number;
  interest_amount: number;
  created_at: string;
}

export interface TransactionSuggestion {
  title: string;
  nature: TxNature;
  category_id?: number;
  sub_category_id?: number;
  payment_method_id?: number;
  frequency: number;
  last_used: string;
}


export type CommitmentStatusValue = 'PAID' | 'DUE' | 'INACTIVE';

/** A fixed obligation that recurs every month (EMI, bill, subscription, chit fund). */
export interface Commitment {
  id: number;
  ledger_id: number;
  name: string;
  amount: number;
  nature: TxNature;
  due_day: number;
  source_account_id?: number;
  target_account_id?: number;
  sub_category_id?: number;
  payment_method_id?: number;
  principal_amount: number;
  interest_amount: number;
  notes?: string;
  is_active: boolean;
  start_month?: string;
  end_month?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CommitmentPayment {
  id: number;
  ledger_id: number;
  commitment_id: number;
  period: string;
  transaction_id?: number;
  amount: number;
  paid_on: string;
  created_at: string;
}

/** A commitment resolved against a specific month. */
export interface CommitmentStatus extends Commitment {
  status: CommitmentStatusValue;
  due_date: string;
  payment?: CommitmentPayment;
}

export interface CommitmentsMonthResponse {
  month: string;
  total: number;
  paid_total: number;
  due_total: number;
  items: CommitmentStatus[];
}

/** Body for creating/updating a commitment. */
export interface CommitmentInput {
  name: string;
  amount: number;
  nature: TxNature;
  due_day: number;
  source_account_id: number;
  target_account_id?: number | null;
  sub_category_id?: number | null;
  payment_method_id?: number | null;
  principal_amount: number;
  interest_amount: number;
  notes?: string;
  is_active?: boolean;
  start_month?: string | null;
  end_month?: string | null;
  sort_order?: number;
}

export interface PayCommitmentInput {
  month: string;
  amount?: number;
  transaction_date?: string;
  notes?: string;
}

export interface TallyResponse {
  account_id: number;
  account_name: string;
  calculated_balance: number;
  actual_balance: number;
  difference: number;
}

export interface SummaryResponse {
  month: string;
  total_income: number;
  total_expense: number;
  total_emi: number;
  total_loan: number;
  net_flow: number;
}

export interface SubCategoryBreakdown {
  sub_category_id: number;
  sub_category_name: string;
  total: number;
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  total: number;
  sub_categories: SubCategoryBreakdown[];
}

export interface LoginReq {
  username?: string;
  password?: string;
}

export interface RegisterReq {
  username?: string;
  password?: string;
}

export interface TransactionFormData {
  title: string;
  amount: string;
  nature: TxNature;
  source_account_id: string;
  target_account_id: string;
  sub_category_id: string;
  payment_method_id: string;
  notes: string;
  principal_amount: string;
  interest_amount: string;
  transaction_date: string;
}

export interface FilterState {
  search: string;
  nature: TxNature | '';
  category_id: string;
  sub_category_id: string;
  date_from: string;
  date_to: string;
  datePreset: string;
}
