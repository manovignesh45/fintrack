import type { TxNature, FilterState } from './types';

export const NATURES: TxNature[] = ['INCOME', 'EXPENSE', 'EMI_PAYMENT', 'LOAN_DISBURSEMENT'];

export const DATE_PRESET_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  thisweek: 'This week',
  lastweek: 'Last week',
  thismonth: 'This month',
  lastmonth: 'Last month',
  custom: 'Custom range',
};

function fmt(d: Date): string {
  const z = d.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(d.getTime() - z);
  return localDate.toISOString().slice(0, 10);
}

export function getPresetDates(preset: string): { date_from: string; date_to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'today': {
      const d = fmt(today);
      return { date_from: d, date_to: d };
    }
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      return { date_from: d, date_to: d };
    }
    case 'last7': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'thisweek': {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const from = new Date(today);
      from.setDate(today.getDate() + diff);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'lastweek': {
      const day = today.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + diffToMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return { date_from: fmt(lastMonday), date_to: fmt(lastSunday) };
    }
    case 'thismonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'lastmonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { date_from: fmt(from), date_to: fmt(to) };
    }
    default:
      return { date_from: '', date_to: '' };
  }
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  nature: '',
  category_id: '',
  sub_category_id: '',
  date_from: getPresetDates('thismonth').date_from,
  date_to: getPresetDates('thismonth').date_to,
  datePreset: 'thismonth',
};

export function countActiveFilters(f: FilterState): number {
  const dateActive = f.datePreset && (f.datePreset !== 'custom' || f.date_from || f.date_to) ? 1 : 0;
  return [f.search, f.nature, f.category_id, f.sub_category_id].filter(Boolean).length + dateActive;
}

export function emptyTransactionForm(): {
  title: string;
  amount: string;
  nature: 'EXPENSE';
  source_account_id: string;
  target_account_id: string;
  sub_category_id: string;
  payment_method_id: string;
  notes: string;
  principal_amount: string;
  interest_amount: string;
  transaction_date: string;
} {
  return {
    title: '',
    amount: '',
    nature: 'EXPENSE',
    source_account_id: '',
    target_account_id: '',
    sub_category_id: '',
    payment_method_id: '',
    notes: '',
    principal_amount: '0',
    interest_amount: '0',
    transaction_date: fmt(new Date()),
  };
}
