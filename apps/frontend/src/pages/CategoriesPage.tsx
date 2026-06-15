import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/client';
import type { Category, EntityType, TxNature } from '../api/types';
import { ENTITIES } from '../api/types';
import { useAuth } from '../context/AuthContext';

const STORAGE_ENTITY_KEY = 'cat_filter_entity';
const STORAGE_NATURE_KEY = 'cat_filter_nature';

export default function CategoriesPage() {
  const navigate = useNavigate();
  const { editMode } = useAuth();
  const [selectedEntity, setSelectedEntity] = useState<EntityType>(
    () => (sessionStorage.getItem(STORAGE_ENTITY_KEY) as EntityType) || 'PERSONAL'
  );
  const [selectedNature, setSelectedNature] = useState<TxNature>(
    () => (sessionStorage.getItem(STORAGE_NATURE_KEY) as TxNature) || 'EXPENSE'
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingSubFor, setAddingSubFor] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    categoriesApi.list({ entity: selectedEntity, nature: selectedNature })
      .then((data) => setCategories(data || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    sessionStorage.setItem(STORAGE_ENTITY_KEY, selectedEntity);
    sessionStorage.setItem(STORAGE_NATURE_KEY, selectedNature);
    load();
  }, [selectedEntity, selectedNature]);

  const deleteCategory = async (id: number) => {
    if (!confirm('Delete category and all its sub-categories?')) return;
    try {
      await categoriesApi.delete(id);
      load();
    } catch { alert('Failed'); }
  };

  const deleteSubCategory = async (categoryId: number, subId: number) => {
    if (!confirm('Delete this sub-category?')) return;
    try {
      await categoriesApi.deleteSub(categoryId, subId);
      load();
    } catch { alert('Failed'); }
  };

  const handleAddSub = (catId: number) => {
    setAddingSubFor(catId);
    setNewSubName('');
  };

  const handleSubSubmit = async (catId: number) => {
    if (!newSubName.trim()) return;
    setSubSubmitting(true);
    try {
      await categoriesApi.createSub(catId, { name: newSubName.trim() });
      setAddingSubFor(null);
      setNewSubName('');
      load();
    } catch { alert('Failed to create sub-category'); }
    finally { setSubSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Categories</h2>

      {/* Entity tabs */}
      <div className="flex gap-2">
        {ENTITIES.map((e) => (
          <button
            key={e}
            onClick={() => setSelectedEntity(e)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${
              selectedEntity === e ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Nature tabs */}
      <div className="flex gap-2">
        {(['EXPENSE', 'INCOME'] as TxNature[]).map((n) => (
          <button
            key={n}
            onClick={() => setSelectedNature(n)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${
              selectedNature === n ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-4">Loading...</p>
      ) : categories.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No categories yet</p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-800 dark:text-gray-200 text-sm italic">{cat.name}</span>
                <div className="flex gap-3">
                  {editMode && (
                    <button
                      onClick={() => handleAddSub(cat.id)}
                      className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md font-semibold border border-blue-100"
                    >
                      + Sub
                    </button>
                  )}
                  {editMode && (
                    <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-500 font-medium">
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-categories */}
              <div className="divide-y divide-gray-50">
                {(cat.sub_categories ?? []).length === 0 && addingSubFor !== cat.id ? (
                  <p className="px-5 py-3 text-xs text-gray-400 italic">No sub-categories</p>
                ) : (
                  (cat.sub_categories ?? []).map((sc) => (
                    <div key={sc.id} className="flex justify-between items-center px-5 py-2.5 hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{sc.name}</span>
                      {editMode && (
                        <button onClick={() => deleteSubCategory(cat.id, sc.id)} className="text-red-300 hover:text-red-500 transition-colors p-1">
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                )}
                {addingSubFor === cat.id && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30">
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubSubmit(cat.id);
                        if (e.key === 'Escape') setAddingSubFor(null);
                      }}
                      placeholder="Sub-category name"
                      autoFocus
                      className="flex-1 px-2.5 py-1.5 border border-blue-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      onClick={() => handleSubSubmit(cat.id)}
                      disabled={subSubmitting || !newSubName.trim()}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
                    >
                      {subSubmitting ? '...' : 'Add'}
                    </button>
                    <button
                      onClick={() => setAddingSubFor(null)}
                      className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1.5"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      {editMode && (
        <button
          onClick={() => navigate('/categories/new', { state: { entity: selectedEntity, nature: selectedNature } })}
          className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-all active:scale-95 z-40"
        >
          +
        </button>
      )}
    </div>
  );
}

