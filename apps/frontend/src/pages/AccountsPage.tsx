import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsApi } from '../api/client';
import type { Account } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useCachedList } from '../hooks/useCachedList';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { editMode } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [newInterestRate, setNewInterestRate] = useState('0');
  const [saving, setSaving] = useState(false);

  const { data: accounts, loading, reload: load } = useCachedList<Account[]>(
    'accounts:liability',
    () => accountsApi.list({ type: 'LIABILITY' }),
    []
  );

  const liabilities = accounts.filter((a) => a.type === 'LIABILITY');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountsApi.create({ name: newName, type: 'LIABILITY', initial_balance: parseFloat(newBalance), interest_rate: parseFloat(newInterestRate) || 0 });
      setNewName(''); setNewBalance('0'); setNewInterestRate('0'); setShowAdd(false);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a: Account) => {
    try {
      await accountsApi.update(a.id, { is_active: !a.is_active });
      load();
    } catch {
      alert('Failed to update');
    }
  };

  const handleUpdateRate = async (a: Account, rate: number) => {
    try {
      await accountsApi.update(a.id, { interest_rate: rate });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update interest rate');
    }
  };

  const handleDelete = async (a: Account) => {
    if (!window.confirm(`Delete "${a.name}"? This cannot be undone.`)) return;
    try {
      await accountsApi.delete(a.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleAccountClick = (account: Account) => {
    navigate(`/accounts/${account.id}`);
  };

  if (loading) return <p className="text-gray-400 text-center py-8">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Loan Accounts</h2>
      </div>

      {showAdd && editMode && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <input
            type="text" placeholder="Loan name (e.g. SBI Home Loan)" value={newName}
            onChange={(e) => setNewName(e.target.value)} required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none dark:bg-gray-700 dark:text-white"
          />
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Total Loan Amount (₹)</label>
            <input
              type="number" step="0.01" placeholder="e.g. 200000" value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Interest Rate (% per year)</label>
            <input
              type="number" step="0.01" min="0" max="100" placeholder="e.g. 12.5" value={newInterestRate}
              onChange={(e) => setNewInterestRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            type="submit" disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Loan Account'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="w-full py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded text-sm font-medium"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Loan Accounts */}
      <section>
        <div className="space-y-2">
          {liabilities.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No loan accounts yet.</p>
          ) : (
            liabilities.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onClick={handleAccountClick}
                onUpdateRate={handleUpdateRate}
                colorClass="text-orange-600"
                editMode={editMode}
              />
            ))
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      {editMode && (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-colors z-20"
          aria-label="Add Loan Account"
        >
          +
        </button>
      )}
    </div>
  );
}

function AccountCard({
  account,
  onToggle,
  onDelete,
  onClick,
  onUpdateRate,
  colorClass = 'text-green-600 dark:text-green-400',
  editMode = false,
}: {
  account: Account;
  onToggle: (a: Account) => void;
  onDelete: (a: Account) => void;
  onClick: (a: Account) => void;
  onUpdateRate: (a: Account, rate: number) => void;
  colorClass?: string;
  editMode?: boolean;
}) {
  const [editingRate, setEditingRate] = useState(false);
  const [rateValue, setRateValue] = useState(String(account.interest_rate));

  const saveRate = () => {
    const rate = parseFloat(rateValue);
    if (!isNaN(rate) && rate >= 0) onUpdateRate(account, rate);
    setEditingRate(false);
  };

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:border-blue-300 transition-colors ${!account.is_active ? 'opacity-50' : ''}`}
      onClick={() => onClick(account)}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{account.name}</p>
          {editMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(account);
              }}
              className="text-gray-300 hover:text-red-500 transition-colors p-1"
              title="Delete Account"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
        <p className={`font-semibold ${colorClass}`}>
          Outstanding: ₹{account.current_balance.toLocaleString('en-IN')}
        </p>
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">
            Total: ₹{account.total_disbursed.toLocaleString('en-IN')}
          </p>
          {editingRate ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="number" step="0.01" min="0" max="100" autoFocus value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRate();
                  if (e.key === 'Escape') setEditingRate(false);
                }}
                className="w-14 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-xs outline-none dark:bg-gray-700 dark:text-white"
              />
              <span className="text-xs text-gray-400">%</span>
              <button onClick={saveRate} className="text-xs text-blue-600 dark:text-blue-400 font-medium">✓</button>
              <button onClick={() => setEditingRate(false)} className="text-xs text-gray-400">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {account.interest_rate > 0 && (
                <p className="text-xs font-medium text-orange-500">
                  {account.interest_rate}% p.a.
                </p>
              )}
              {editMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); setRateValue(String(account.interest_rate)); setEditingRate(true); }}
                  className="text-gray-300 hover:text-blue-500 transition-colors p-0.5"
                  title="Edit interest rate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        <label 
          className="flex items-center gap-2 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {account.is_active ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(account);
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              account.is_active ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                account.is_active ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
}
