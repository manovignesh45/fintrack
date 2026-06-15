import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { categoriesApi } from '../api/client';
import { ENTITIES } from '../api/types';
import type { EntityType, TxNature } from '../api/types';

const STORAGE_ENTITY_KEY = 'cat_filter_entity';
const STORAGE_NATURE_KEY = 'cat_filter_nature';

export default function CreateCategoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { entity?: EntityType; nature?: TxNature } | null;
  const [name, setName] = useState('');
  const [entity, setEntity] = useState<EntityType>(
    locState?.entity ?? (sessionStorage.getItem(STORAGE_ENTITY_KEY) as EntityType) ?? 'PERSONAL'
  );
  const [nature, setNature] = useState<TxNature>(
    locState?.nature ?? (sessionStorage.getItem(STORAGE_NATURE_KEY) as TxNature) ?? 'EXPENSE'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSubmitting(true);
    setError('');
    try {
      await categoriesApi.create({
        name: name.trim(),
        entity,
        nature
      });
      sessionStorage.setItem(STORAGE_ENTITY_KEY, entity);
      sessionStorage.setItem(STORAGE_NATURE_KEY, nature);
      navigate('/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/categories')} className="text-gray-600 dark:text-gray-400 text-xl">
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Create Category</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">{error}</p>}

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Entity *</label>
          <div className="flex gap-2">
            {ENTITIES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEntity(e)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  entity === e ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Transaction Type *</label>
          <div className="flex gap-2">
            {(['EXPENSE', 'INCOME'] as TxNature[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNature(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  nature === n ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Category Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries, Shopping"
            required
            autoFocus
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 shadow-md active:scale-[0.98] transition-all"
        >
          {submitting ? 'Creating...' : 'Create Category'}
        </button>
      </form>
    </div>
  );
}
