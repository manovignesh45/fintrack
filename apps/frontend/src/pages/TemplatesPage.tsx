import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesApi } from '../api/client';
import type { TransactionTemplate } from '../api/types';
import { useAuth } from '../context/AuthContext';

const natureLabels: Record<string, string> = {
  INCOME: 'Income', EXPENSE: 'Expense', EMI_PAYMENT: 'EMI', LOAN_DISBURSEMENT: 'Loan',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { editMode } = useAuth();

  const load = () => {
    setLoading(true);
    templatesApi.list()
      .then((data) => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
          entity: t.entity,
          payment_method: t.payment_method || '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: new Date().toISOString().split('T')[0],
        },
      },
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      await templatesApi.delete(id);
      load();
    } catch { alert('Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Templates</h2>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : templates.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          No templates yet. Create one or save from the transaction form.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{t.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {natureLabels[t.nature]} · {t.entity} · ₹{t.amount.toLocaleString('en-IN')}
                    {t.payment_method && ` · ${t.payment_method}`}
                  </p>
                </div>
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => handleUse(t)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium"
                  >
                    Use
                  </button>
                  {editMode && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="px-3 py-1.5 bg-red-100 text-red-600 dark:text-red-400 rounded text-xs font-medium"
                    >
                      Del
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button for Creating Template */}
      {editMode && (
        <button
          onClick={() => navigate('/templates/new')}
          className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-colors z-20"
          aria-label="Create Template"
        >
          +
        </button>
      )}
    </div>
  );
}
