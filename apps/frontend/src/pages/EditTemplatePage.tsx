import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { templatesApi } from '../api/client';
import TransactionForm, { type TransactionFormData } from '../components/TransactionForm';
import { invalidateCache } from '../hooks/useCachedList';
import type { TransactionTemplate } from '../api/types';

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<TransactionFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    templatesApi
      .get(parseInt(id, 10))
      .then((t: TransactionTemplate) => {
        setInitial({
          title: t.title,
          amount: t.amount.toString(),
          nature: t.nature,
          source_account_id: t.source_account_id.toString(),
          target_account_id: t.target_account_id?.toString() ?? '',
          sub_category_id: t.sub_category_id?.toString() ?? '',
          payment_method_id: t.payment_method_id?.toString() ?? '',
          notes: '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: new Date().toISOString().split('T')[0],
          warranty_until: '',
          warranty_notes: '',
          tag_ids: [],
        });
      })
      .catch(() => navigate('/templates'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (form: TransactionFormData) => {
    if (!id) return;
    await templatesApi.update(parseInt(id, 10), {
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id, 10) || 1,
      target_account_id: form.target_account_id ? parseInt(form.target_account_id, 10) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id, 10) : undefined,
      payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id, 10) : undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
    });
    invalidateCache('templates');
    navigate('/templates');
  };

  if (loading) return <p className="text-gray-400 text-center py-8">Loading...</p>;
  if (!initial) return <p className="text-red-500 text-center py-8">Template not found</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/templates')}
          className="text-gray-600 dark:text-gray-400 text-xl"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Edit Template</h2>
      </div>
      <TransactionForm
        initial={initial}
        onSubmit={handleSubmit}
        submitLabel="Update Template"
        enableAutoSuggestions={false}
      />
    </div>
  );
}
