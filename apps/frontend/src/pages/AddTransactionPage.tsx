import { useNavigate, useLocation } from 'react-router-dom';
import { transactionsApi } from '../api/client';
import TransactionForm, { type TransactionFormData } from '../components/TransactionForm';
import { invalidateCache } from '../hooks/useCachedList';

export default function AddTransactionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialData = location.state?.template as TransactionFormData | undefined;

  const handleSubmit = async (form: TransactionFormData) => {
    await transactionsApi.create({
      title: form.title,
      amount: parseFloat(form.amount),
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id) || 1,
      target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
      payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id) : undefined,
      notes: form.notes || undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
      transaction_date: form.transaction_date,
      warranty_until: form.warranty_until || undefined,
      warranty_notes: form.warranty_notes || undefined,
      tag_ids: form.tag_ids || [],
    });
    invalidateCache('transaction');
    navigate('/');
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Add Transaction</h2>
      <TransactionForm 
        initial={initialData}
        onSubmit={handleSubmit} 
        submitLabel="Add Transaction" 
      />
    </div>
  );
}
