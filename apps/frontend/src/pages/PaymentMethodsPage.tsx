import { useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentMethodsApi } from '../api/client';
import type { PaymentMethod } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useCachedList } from '../hooks/useCachedList';

export default function PaymentMethodsPage() {
  const { editMode } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: paymentMethods, loading, reload: load } = useCachedList<PaymentMethod[]>(
    'payment-methods',
    () => paymentMethodsApi.list(),
    []
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this payment method?')) return;
    try {
      await paymentMethodsApi.delete(id);
      load();
    } catch { alert('Failed to delete. It might be in use.'); }
  };

  const handleAddSubmit = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await paymentMethodsApi.create({ name: newName.trim() });
      setIsAdding(false);
      setNewName('');
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to create payment method');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <Link to="/more" className="text-lg font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">More</Link>
          <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</span>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Payment Methods</h2>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-4">Loading...</p>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex justify-between items-center px-4 py-3">
              <span className="font-medium text-gray-800 dark:text-gray-200">{pm.name}</span>
              {editMode && (
                <button onClick={() => handleDelete(pm.id)} className="text-xs text-red-500 font-medium hover:underline">
                  Delete
                </button>
              )}
            </div>
          ))}

          {paymentMethods.length === 0 && !isAdding && (
            <p className="text-gray-400 text-center py-4">No payment methods yet</p>
          )}

          {isAdding && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-900/50 overflow-hidden shadow-sm flex items-center px-4 py-2 gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubmit();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                placeholder="Method Name (e.g. Credit Card)"
                autoFocus
                className="flex-1 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleAddSubmit}
                disabled={submitting || !newName.trim()}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
              >
                {submitting ? '...' : 'Add'}
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1.5"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      {editMode && !isAdding && (
        <button
          onClick={() => { setIsAdding(true); setNewName(''); }}
          className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-all active:scale-95 z-40"
        >
          +
        </button>
      )}
    </div>
  );
}
