import { useEffect, useState } from 'react';
import { summaryApi } from '../api/client';
import type { EntitySummary, SummaryResponse } from '../api/types';

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN');
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function EntityCard({ e }: { e: EntitySummary }) {
  const totalOut = e.total_expense + e.total_emi;
  const isPositive = e.net_flow >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wide">{e.entity}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isPositive ? '+' : '-'}{fmt(e.net_flow)}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Income */}
        {e.total_income > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Income</span>
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">{fmt(e.total_income)}</span>
          </div>
        )}

        {/* Expense */}
        {e.total_expense > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Expense</span>
            </div>
            <span className="text-sm font-semibold text-red-500">{fmt(e.total_expense)}</span>
          </div>
        )}

        {/* EMI */}
        {e.total_emi > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">EMI Payments</span>
            </div>
            <span className="text-sm font-semibold text-orange-500">{fmt(e.total_emi)}</span>
          </div>
        )}

        {/* Divider + total out */}
        {totalOut > 0 && e.total_income > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">Total Out</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{fmt(totalOut)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SummaryPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const isCurrentMonth = month === currentMonth();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await summaryApi.get(month);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [month]);

  const totalIncome = data?.entities.reduce((s, e) => s + e.total_income, 0) ?? 0;
  const totalExpense = data?.entities.reduce((s, e) => s + e.total_expense + e.total_emi, 0) ?? 0;
  const totalNet = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Monthly Summary</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(prevMonth)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-900 active:scale-95 text-lg"
          >
            ‹
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none w-32 text-center dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={() => setMonth(nextMonth)}
            disabled={isCurrentMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-900 disabled:opacity-30 active:scale-95 text-lg"
          >
            ›
          </button>
        </div>
      </div>

      {/* Month label */}
      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">{monthLabel(month)}</p>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading...</p>
      ) : !data || data.entities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">No transactions for {monthLabel(month)}</p>
        </div>
      ) : (
        <>
          {/* Grand total banner */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-3">Grand Total</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-blue-200 mb-1">Income</p>
                <p className="text-sm font-bold text-green-300">{fmt(totalIncome)}</p>
              </div>
              <div className="border-x border-blue-500">
                <p className="text-xs text-blue-200 mb-1">Expense</p>
                <p className="text-sm font-bold text-red-300">{fmt(totalExpense)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-200 mb-1">Net</p>
                <p className={`text-sm font-bold ${totalNet >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totalNet >= 0 ? '+' : '-'}{fmt(totalNet)}
                </p>
              </div>
            </div>
          </div>

          {/* Entity breakdown */}
          <div className="space-y-3">
            {data.entities.map((e) => (
              <EntityCard key={e.entity} e={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
