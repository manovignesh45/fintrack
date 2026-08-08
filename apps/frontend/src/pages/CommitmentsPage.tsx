import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  CommitmentRow,
  currentMonthKey,
  fmtAmount,
  monthLabel,
  shiftMonth,
  useCommitmentsMonth,
} from '../components/MonthlyCommitments';

export default function CommitmentsPage() {
  const navigate = useNavigate();
  const { editMode } = useAuth();
  const [month, setMonth] = useState(currentMonthKey);

  const { data, loading, busyId, pay, unpay, remove, active, paused } = useCommitmentsMonth(month);

  const today = currentMonthKey();
  const isCurrentMonth = month === today;

  const rowProps = {
    month,
    onPay: pay,
    onUnpay: unpay,
    ...(editMode ? { onEdit: (i: { id: number }) => navigate(`/commitments/${i.id}/edit`), onDelete: remove } : {}),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Link to="/more" className="text-lg font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          More
        </Link>
        <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</span>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Monthly Commitments</h2>
      </div>

      {/* Month stepper */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-2">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="px-3 py-1 text-gray-500 dark:text-gray-400 text-lg"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{monthLabel(month)}</p>
          {!isCurrentMonth && (
            <button onClick={() => setMonth(today)} className="text-[11px] text-blue-600 dark:text-blue-400">
              Jump to current
            </button>
          )}
        </div>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="px-3 py-1 text-gray-500 dark:text-gray-400 text-lg"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Totals */}
      {!loading && active.length > 0 && (
        <div className="grid grid-cols-3 gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Total</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{fmtAmount(data.total)}</p>
          </div>
          <div className="text-center border-x border-gray-100 dark:border-gray-800">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Paid</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">{fmtAmount(data.paid_total)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Remaining</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtAmount(data.due_total)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : data.items.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          No commitments yet. Add your recurring monthly bills, EMIs and subscriptions.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((item) => (
            <CommitmentRow key={item.id} item={item} busy={busyId === item.id} {...rowProps} />
          ))}

          {paused.length > 0 && (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wider pt-2">Not active this month</p>
              {paused.map((item) => (
                <CommitmentRow key={item.id} item={item} busy={busyId === item.id} {...rowProps} />
              ))}
            </>
          )}
        </div>
      )}

      {editMode && (
        <button
          onClick={() => navigate('/commitments/new')}
          className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-all active:scale-95 z-40"
        >
          +
        </button>
      )}
    </div>
  );
}
