import { useNavigate } from 'react-router-dom';
import { X, Wallet, Tags, LayoutTemplate, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const steps = [
  { to: '/categories', icon: Tags, label: 'Review or add your own categories' },
  { to: '/accounts', icon: Wallet, label: 'Add an account' },
  { to: '/templates/new', icon: LayoutTemplate, label: 'Create a transaction template' },
  { to: '/add', icon: PlusCircle, label: 'Log your first transaction' },
];

export default function GettingStartedCard() {
  const { user, updatePreferences } = useAuth();
  const navigate = useNavigate();

  if (user?.preferences?.onboardingDismissed) return null;

  return (
    <div className="relative bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
      <button
        type="button"
        onClick={() => updatePreferences({ onboardingDismissed: true })}
        aria-label="Dismiss getting started"
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-3 pr-6">
        Getting started with FinTrack
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {steps.map(({ to, icon: Icon, label }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className="flex items-center gap-2 text-left text-sm text-indigo-800 dark:text-indigo-200 bg-white dark:bg-gray-800 rounded-md px-3 py-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
