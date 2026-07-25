import { useEffect, useState } from 'react';
import { summaryApi } from '../api/client';
import type { SummaryResponse } from '../api/types';

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN');
}

function addMonths(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shortMonthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function rangeLabel(from: string, to: string) {
  return from === to ? shortMonthLabel(from) : `${shortMonthLabel(from)} – ${shortMonthLabel(to)}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function BreakdownCard({ data }: { data: SummaryResponse }) {
  const totalOut = data.total_expense + data.total_emi;
  const isPositive = data.net_flow >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wide">Breakdown</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isPositive ? '+' : '-'}{fmt(data.net_flow)}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Income */}
        {data.total_income > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Income</span>
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">{fmt(data.total_income)}</span>
          </div>
        )}

        {/* Loan Received */}
        {data.total_loan > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Loan Received</span>
            </div>
            <span className="text-sm font-semibold text-purple-500">{fmt(data.total_loan)}</span>
          </div>
        )}

        {/* Expense */}
        {data.total_expense > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Expense</span>
            </div>
            <span className="text-sm font-semibold text-red-500">{fmt(data.total_expense)}</span>
          </div>
        )}

        {/* EMI */}
        {data.total_emi > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">EMI Payments</span>
            </div>
            <span className="text-sm font-semibold text-orange-500">{fmt(data.total_emi)}</span>
          </div>
        )}

        {/* Divider + total out */}
        {totalOut > 0 && (data.total_income > 0 || data.total_loan > 0) && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">Total Out</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{fmt(totalOut)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareTable({ rows }: { rows: SummaryResponse[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-2 font-semibold">Month</th>
            <th className="text-right px-4 py-2 font-semibold">Income</th>
            <th className="text-right px-4 py-2 font-semibold">Expense</th>
            <th className="text-right px-4 py-2 font-semibold">EMI</th>
            <th className="text-right px-4 py-2 font-semibold">Net</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.month} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">{shortMonthLabel(r.month)}</td>
              <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">
                {r.total_income + r.total_loan > 0 ? fmt(r.total_income + r.total_loan) : '—'}
              </td>
              <td className="px-4 py-2 text-right text-red-500">{r.total_expense > 0 ? fmt(r.total_expense) : '—'}</td>
              <td className="px-4 py-2 text-right text-orange-500">{r.total_emi > 0 ? fmt(r.total_emi) : '—'}</td>
              <td className={`px-4 py-2 text-right font-semibold ${r.net_flow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {r.net_flow >= 0 ? '+' : '-'}{fmt(r.net_flow)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SummaryPage() {
  const [rangeFrom, setRangeFrom] = useState(() => addMonths(currentMonth(), -11));
  const [rangeTo, setRangeTo] = useState(currentMonth);
  const [rangeData, setRangeData] = useState<SummaryResponse[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rangeFrom > rangeTo) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await summaryApi.getRange(rangeFrom, rangeTo);
        setRangeData(res);
      } catch {
        setRangeData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rangeFrom, rangeTo]);

  const totals = (rangeData ?? []).reduce(
    (acc, r) => ({
      total_income: acc.total_income + r.total_income,
      total_expense: acc.total_expense + r.total_expense,
      total_emi: acc.total_emi + r.total_emi,
      total_loan: acc.total_loan + r.total_loan,
      net_flow: acc.net_flow + r.net_flow,
    }),
    { total_income: 0, total_expense: 0, total_emi: 0, total_loan: 0, net_flow: 0 }
  );
  const totalExpense = totals.total_expense + totals.total_emi;
  const hasData = !!rangeData && rangeData.some((r) => r.total_income > 0 || r.total_expense > 0 || r.total_emi > 0 || r.total_loan > 0);
  const monthsWithData = (rangeData ?? []).filter((r) => r.total_income > 0 || r.total_expense > 0 || r.total_emi > 0 || r.total_loan > 0).length;
  const avgExpense = monthsWithData > 0 ? totalExpense / monthsWithData : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Monthly Summary</h2>

      {/* Date range selection */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          From
          <input
            type="month"
            value={rangeFrom}
            max={rangeTo}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          To
          <input
            type="month"
            value={rangeTo}
            min={rangeFrom}
            max={currentMonth()}
            onChange={(e) => setRangeTo(e.target.value)}
            className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800"
          />
        </label>
        <button
          onClick={() => {
            setRangeFrom(addMonths(currentMonth(), -11));
            setRangeTo(currentMonth());
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          Last 12 months
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading...</p>
      ) : !hasData ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">No transactions in this range</p>
        </div>
      ) : (
        <>
          {/* Grand total banner */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-3">
              Grand Total <span className="normal-case font-normal text-blue-300">· {rangeLabel(rangeFrom, rangeTo)}</span>
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs text-blue-200 mb-1">Income</p>
                <p className="text-sm font-bold text-green-300">{fmt(totals.total_income + totals.total_loan)}</p>
              </div>
              <div className="border-l border-blue-500">
                <p className="text-xs text-blue-200 mb-1">Expense</p>
                <p className="text-sm font-bold text-red-300">{fmt(totalExpense)}</p>
              </div>
              <div className="border-l border-blue-500">
                <p className="text-xs text-blue-200 mb-1">Avg Exp/mo</p>
                <p className="text-sm font-bold text-red-300">{fmt(avgExpense)}</p>
              </div>
              <div className="border-l border-blue-500">
                <p className="text-xs text-blue-200 mb-1">Net</p>
                <p className={`text-sm font-bold ${totals.net_flow >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totals.net_flow >= 0 ? '+' : '-'}{fmt(totals.net_flow)}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <BreakdownCard data={{ month: rangeTo, ...totals }} />

          {/* Month-by-month comparison */}
          <CompareTable rows={rangeData!} />
        </>
      )}
    </div>
  );
}
