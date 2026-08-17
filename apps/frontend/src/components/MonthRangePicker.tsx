import { addMonths, currentMonth } from '../lib/monthRange';

export default function MonthRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        From
        <input
          type="month"
          value={from}
          max={to}
          onChange={(e) => onFromChange(e.target.value)}
          className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        To
        <input
          type="month"
          value={to}
          min={from}
          max={currentMonth()}
          onChange={(e) => onToChange(e.target.value)}
          className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800"
        />
      </label>
      <button
        onClick={() => {
          onFromChange(addMonths(currentMonth(), -11));
          onToChange(currentMonth());
        }}
        className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
      >
        Last 12 months
      </button>
    </div>
  );
}
