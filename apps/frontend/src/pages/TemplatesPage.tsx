import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { templatesApi, paymentMethodsApi, categoriesApi } from '../api/client';
import type { TransactionTemplate, PaymentMethod, Category } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { invalidateCache, useCachedList } from '../hooks/useCachedList';
import ConfirmModal from '../components/ConfirmModal';

const getNatureBadge = (nature: string) => {
  switch (nature) {
    case 'EMI_PAYMENT':
      return { label: 'EMI', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' };
    case 'EXPENSE':
      return { label: 'Expense', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
    case 'INCOME':
      return { label: 'Income', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
    case 'LOAN_DISBURSEMENT':
      return { label: 'Loan', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
    default:
      return { label: nature, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  }
};

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { editMode } = useAuth();
  const [deletingTemplate, setDeletingTemplate] = useState<TransactionTemplate | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: templates, loading, reload: load } = useCachedList<TransactionTemplate[]>(
    'templates',
    () => templatesApi.list(),
    []
  );
  const { data: paymentMethods } = useCachedList<PaymentMethod[]>(
    'payment-methods',
    () => paymentMethodsApi.list(),
    []
  );
  const { data: categories } = useCachedList<Category[]>(
    'categories:all',
    () => categoriesApi.list(),
    []
  );

  const getTemplateSubtitle = (t: TransactionTemplate) => {
    const parts: string[] = [];
    if (t.sub_category_id && categories) {
      for (const cat of categories) {
        const sub = cat.sub_categories?.find((s) => s.id === t.sub_category_id);
        if (sub) {
          parts.push(sub.name);
          break;
        }
      }
    }
    if (t.payment_method_id && paymentMethods) {
      const pm = paymentMethods.find((p) => p.id === t.payment_method_id);
      if (pm) parts.push(pm.name);
    }
    if (parts.length === 0) {
      parts.push(getNatureBadge(t.nature).label);
    }
    return parts.join(' · ');
  };

  const handleUse = (t: TransactionTemplate) => {
    navigate('/add', {
      state: {
        template: {
          title: t.title,
          amount: t.amount.toString(),
          nature: t.nature,
          source_account_id: t.source_account_id.toString(),
          target_account_id: t.target_account_id?.toString() || '',
          sub_category_id: t.sub_category_id?.toString() || '',
          payment_method_id: t.payment_method_id?.toString() || '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: new Date().toISOString().split('T')[0],
        },
      },
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    setBusyId(deletingTemplate.id);
    try {
      await templatesApi.delete(deletingTemplate.id);
      invalidateCache('templates');
      setDeletingTemplate(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Link to="/more" className="text-lg font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          More
        </Link>
        <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</span>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Templates</h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No templates yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-sm mx-auto">
            Save frequent transactions as templates to reuse them with a single tap.
          </p>
          {editMode && (
            <button
              onClick={() => navigate('/templates/new')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              + Create Template
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((t) => {
            const badge = getNatureBadge(t.nature);
            return (
              <div key={t.id} data-no-swipe="true" className="relative overflow-hidden rounded-xl">
                <div className="relative z-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 flex items-center gap-2 sm:gap-3 transition-colors shadow-xs">
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">
                        {t.title}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate text-gray-500 dark:text-gray-400">
                      {getTemplateSubtitle(t)}
                    </p>
                  </div>

                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap shrink-0">
                    ₹{t.amount.toLocaleString('en-IN')}
                  </span>

                  {/* Primary Action Button */}
                  <button
                    type="button"
                    onClick={() => handleUse(t)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm shadow-blue-500/20 disabled:opacity-50 whitespace-nowrap shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Use</span>
                    <span className="text-[10px]">›</span>
                  </button>

                  {/* Edit & Delete Controls (Only in Edit Mode) */}
                  {editMode && (
                    <div
                      data-no-swipe="true"
                      className="flex items-center gap-0.5 border-l border-gray-100 dark:border-gray-700 pl-1.5 shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/templates/${t.id}/edit`)}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 cursor-pointer"
                        title="Edit Template"
                        aria-label="Edit"
                      >
                        <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTemplate(t)}
                        disabled={busyId === t.id}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Delete Template"
                        aria-label="Delete"
                      >
                        <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Styled Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingTemplate)}
        title="Delete Template"
        message={`Delete template "${deletingTemplate?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setDeletingTemplate(null)}
        onConfirm={handleConfirmDelete}
        busy={busyId === deletingTemplate?.id}
      />

      {/* Floating Action Button for Creating Template (Edit Mode) */}
      {editMode && (
        <button
          onClick={() => navigate('/templates/new')}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-all active:scale-95 z-40"
          aria-label="Create Template"
        >
          +
        </button>
      )}
    </div>
  );
}
