import { useNavigate } from 'react-router-dom';
import { templatesApi } from '../api/client';
import TransactionForm, { type TransactionFormData } from '../components/TransactionForm';

export default function CreateTemplatePage() {
  const navigate = useNavigate();

  const handleSubmit = async (form: TransactionFormData) => {
    await templatesApi.create({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id),
      target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
      entity: form.entity,
      payment_method: form.payment_method || undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
    });
    navigate('/templates');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/templates')}
          className="text-gray-600 dark:text-gray-400 text-xl"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Create Template</h2>
      </div>
      <TransactionForm onSubmit={handleSubmit} submitLabel="Save Template" />
    </div>
  );
}
