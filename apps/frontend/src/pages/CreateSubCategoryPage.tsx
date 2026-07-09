import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { categoriesApi } from '../api/client';
import type { Category } from '../api/types';

export default function CreateSubCategoryPage() {
  const navigate = useNavigate();
  const { catId } = useParams<{ catId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!catId) return;

    // Fetch categories with its sub-categories to get its details
    // For simplicity, we fetch all and find ours since there's no single category get endpoint
    categoriesApi.list()
      .then((cats) => {
        const cat = cats.find(c => c.id === parseInt(catId));
        if (cat) {
          setCategory(cat);
        } else {
          setError('Category not found');
        }
      })
      .catch(() => setError('Failed to load category'))
      .finally(() => setLoading(false));
  }, [catId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !catId) return;
    
    setSubmitting(true);
    setError('');
    try {
      await categoriesApi.createSub(parseInt(catId), {
        name: name.trim()
      });
      navigate('/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sub-category');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-center py-8 text-gray-400">Loading...</p>;
  if (!category) return <p className="text-center py-8 text-red-500">{error || 'Not found'}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/categories')} className="text-gray-600 dark:text-gray-400 text-xl">
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Create Sub-category</h2>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 mb-4">
        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1 uppercase tracking-wider">Parent Category</p>
        <p className="text-sm font-bold text-blue-800">{category.name}</p>
        <div className="flex gap-2 mt-2">
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold uppercase">{category.nature}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">{error}</p>}

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Sub-category Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Milk, Fruits, Clothes"
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
          {submitting ? 'Creating...' : 'Create Sub-category'}
        </button>
      </form>
    </div>
  );
}
