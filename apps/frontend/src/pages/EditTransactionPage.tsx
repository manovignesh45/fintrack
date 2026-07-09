import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { transactionsApi } from '../api/client';
import TransactionForm, { type TransactionFormData } from '../components/TransactionForm';
import type { Transaction } from '../api/types';

export default function EditTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<TransactionFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    transactionsApi
      .get(parseInt(id))
      .then((t: Transaction) => {
        setInitial({
          title: t.title,
          amount: t.amount.toString(),
          nature: t.nature,
          source_account_id: t.source_account_id.toString(),
          target_account_id: t.target_account_id?.toString() ?? '',
          sub_category_id: t.sub_category_id?.toString() ?? '',
          payment_method: t.payment_method ?? '',
          notes: t.notes ?? '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: t.transaction_date,
        });
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (form: TransactionFormData) => {
    if (!id) return;
    await transactionsApi.update(parseInt(id), {
      title: form.title,
      amount: parseFloat(form.amount),
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id) || 1,
      target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
      payment_method: form.payment_method || undefined,
      notes: form.notes || undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
      transaction_date: form.transaction_date,
    });
    navigate('/');
  };

  if (loading) return <p className="text-gray-400 text-center py-8">Loading...</p>;
  if (!initial) return <p className="text-red-500 text-center py-8">Transaction not found</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Edit Transaction</h2>
      <TransactionForm initial={initial} onSubmit={handleSubmit} submitLabel="Update Transaction" />
    </div>
  );
}
