import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountsApi, tallyApi } from '../api/client';
import type { Account, TallyResponse } from '../api/types';

export default function TallyPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actualBalance, setActualBalance] = useState('');
  const [result, setResult] = useState<TallyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((a) => {
      const list = a || [];
      setAccounts(list);
      if (list.length > 0) setSelectedId(list[0].id);
    }).catch(() => setAccounts([]));
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await tallyApi.check(selectedId, parseFloat(actualBalance));
      setResult(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Link to="/more" className="text-lg font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">More</Link>
        <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</span>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Loan Reconciliation</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Compare FinTrack's outstanding balance with your lender's actual statement.
      </p>

      <form onSubmit={handleCheck} className="space-y-3">
        <select
          value={selectedId ?? ''}
          onChange={(e) => { setSelectedId(parseInt(e.target.value)); setResult(null); }}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <input
          type="number" step="0.01"
          placeholder="Enter outstanding balance from lender's statement (₹)"
          value={actualBalance}
          onChange={(e) => setActualBalance(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
        />

        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Tally'}
        </button>
      </form>

      {result && (
        <div className={`rounded-lg border p-4 space-y-2 ${
          result.difference === 0 ? 'border-green-200 bg-green-50 dark:bg-green-900/30' : 'border-yellow-200 bg-yellow-50'
        }`}>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{result.account_name}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">FinTrack Outstanding</p>
              <p className="font-medium">₹{result.calculated_balance.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Lender's Statement</p>
              <p className="font-medium">₹{result.actual_balance.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className={`text-sm font-semibold ${
            result.difference === 0
              ? 'text-green-700'
              : result.difference > 0
              ? 'text-blue-700'
              : 'text-red-700'
          }`}>
            {result.difference === 0
              ? '✅ Perfectly balanced!'
              : result.difference > 0
              ? `↑ Surplus of ₹${Math.abs(result.difference).toLocaleString('en-IN')} — possible untracked income`
              : `↓ Deficit of ₹${Math.abs(result.difference).toLocaleString('en-IN')} — unaccounted transactions found`}
          </div>
        </div>
      )}
    </div>
  );
}
