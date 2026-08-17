import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { summaryApi } from '../api/client';
import type { SummaryResponse, CategoryBreakdown, TxNature } from '../api/types';
import { useCachedList } from '../hooks/useCachedList';
import { useTheme } from '../context/ThemeContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { fmt, addMonths, shortMonthLabel, currentMonth } from '../lib/monthRange';
import MonthRangePicker from '../components/MonthRangePicker';

function monthOnlyLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
}

// Resolves the "system" theme choice against the OS preference so charts can
// pick literal colors — recharts renders raw SVG attributes, not Tailwind
// classes, so `dark:` utilities don't reach it.
function useIsDark() {
  const { theme } = useTheme();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  return theme === 'dark' || (theme === 'system' && prefersDark);
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function MonthlyTrendChart({ rows }: { rows: SummaryResponse[] }) {
  const isDark = useIsDark();
  const income = isDark ? '#4ade80' : '#22c55e';
  const expense = isDark ? '#f87171' : '#ef4444';
  const grid = isDark ? '#374151' : '#e5e7eb';
  const tick = isDark ? '#9ca3af' : '#6b7280';

  const data = rows.map((r) => ({
    month: monthOnlyLabel(r.month),
    fullMonth: shortMonthLabel(r.month),
    Income: r.total_income + r.total_loan,
    Expense: r.total_expense + r.total_emi,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wide">Monthly Trend</span>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: income }} />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: expense }} />
            Expense
          </span>
        </div>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: tick }} axisLine={{ stroke: grid }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: tick }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
            />
            <Tooltip content={<ChartTooltip />} labelFormatter={(_, p) => p?.[0]?.payload?.fullMonth} cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="Income" name="Income" fill={income} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Expense" name="Expense" fill={expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryBreakdownChart({ from, to }: { from: string; to: string }) {
  const [nature, setNature] = useState<TxNature>('EXPENSE');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const isDark = useIsDark();
  const barColor = nature === 'EXPENSE' ? (isDark ? '#f87171' : '#ef4444') : (isDark ? '#4ade80' : '#22c55e');
  const barBg = isDark ? 'bg-gray-700' : 'bg-gray-100';

  const { data, loading } = useCachedList<CategoryBreakdown[]>(
    `category-breakdown:${from}:${to}:${nature}`,
    () => (from > to ? Promise.resolve([]) : summaryApi.getByCategory(from, to, nature)),
    []
  );

  const categories = data ?? [];
  const maxTotal = Math.max(1, ...categories.map((c) => c.total));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wide">By Category</span>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
          {(['EXPENSE', 'INCOME'] as const).map((n) => (
            <button
              key={n}
              onClick={() => { setNature(n); setExpandedId(null); }}
              className={`px-2.5 py-1 ${
                nature === n
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {n === 'EXPENSE' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <p className="text-gray-400 text-center py-8 text-sm">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">No {nature.toLowerCase()} categories in this range</p>
        ) : (
          <div className="space-y-2.5">
            {categories.map((cat) => {
              const pct = Math.round((cat.total / maxTotal) * 100);
              const isOpen = expandedId === cat.category_id;
              const subs = cat.sub_categories.filter((s) => s.total > 0);
              return (
                <div key={cat.category_id}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : cat.category_id)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1">
                        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                        {cat.category_name}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{fmt(cat.total)}</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${barBg}`}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                  </button>
                  {isOpen && subs.length > 0 && (
                    <div className="mt-2 ml-4 space-y-1.5 border-l border-gray-100 dark:border-gray-700 pl-3">
                      {subs.map((s) => {
                        const subPct = Math.round((s.total / cat.total) * 100);
                        return (
                          <div key={s.sub_category_id}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{s.sub_category_name}</span>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{fmt(s.total)}</span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${barBg}`}>
                              <div
                                className="h-full rounded-full opacity-60"
                                style={{ width: `${subPct}%`, backgroundColor: barColor }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const [rangeFrom, setRangeFrom] = useState(() => addMonths(currentMonth(), -11));
  const [rangeTo, setRangeTo] = useState(currentMonth);

  const { data: rangeData, loading } = useCachedList<SummaryResponse[]>(
    `summary:${rangeFrom}:${rangeTo}`,
    () => (rangeFrom > rangeTo ? Promise.resolve([]) : summaryApi.getRange(rangeFrom, rangeTo)),
    []
  );
  const hasData = !!rangeData && rangeData.some((r) => r.total_income > 0 || r.total_expense > 0 || r.total_emi > 0 || r.total_loan > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/summary" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Summary
        </Link>
      </div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Charts</h2>

      <MonthRangePicker from={rangeFrom} to={rangeTo} onFromChange={setRangeFrom} onToChange={setRangeTo} />

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading...</p>
      ) : !hasData ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">No transactions in this range</p>
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
          <MonthlyTrendChart rows={rangeData!} />
          <CategoryBreakdownChart from={rangeFrom} to={rangeTo} />
        </div>
      )}
    </div>
  );
}
