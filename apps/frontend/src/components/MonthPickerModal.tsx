import { useState } from 'react';
import { createPortal } from 'react-dom';
import { currentMonthKey } from './MonthlyCommitments';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string; // 'YYYY-MM'
  onSelect: (month: string) => void;
}

export default function MonthPickerModal({
  isOpen,
  onClose,
  selectedMonth,
  onSelect,
}: MonthPickerModalProps) {
  if (!isOpen) return null;

  return (
    <MonthPickerModalContent
      onClose={onClose}
      selectedMonth={selectedMonth}
      onSelect={onSelect}
    />
  );
}

function MonthPickerModalContent({
  onClose,
  selectedMonth,
  onSelect,
}: Omit<MonthPickerModalProps, 'isOpen'>) {
  const [selectedYear, selectedM] = selectedMonth.split('-').map(Number);
  const [viewYear, setViewYear] = useState(selectedYear || new Date().getFullYear());

  const actualToday = currentMonthKey();
  const [todayY, todayM] = actualToday.split('-').map(Number);

  const handleSelect = (monthIndex: number) => {
    const formatted = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    onSelect(formatted);
    onClose();
  };

  const handleJumpToToday = () => {
    onSelect(actualToday);
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xs p-5 pointer-events-auto transform transition-all animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with year stepper */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-base"
              aria-label="Previous Year"
            >
              ‹
            </button>
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">
              {viewYear}
            </span>
            <button
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-base"
              aria-label="Next Year"
            >
              ›
            </button>
          </div>

          {/* 12-Month Grid */}
          <div className="grid grid-cols-3 gap-2.5 py-4">
            {MONTH_NAMES.map((name, index) => {
              const monthNum = index + 1;
              const isSelected = viewYear === selectedYear && monthNum === selectedM;
              const isToday = viewYear === todayY && monthNum === todayM;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(index)}
                  className={`relative py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : isToday
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1.5 ring-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70'
                  }`}
                >
                  {name}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions Footer */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleJumpToToday}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium py-1 px-1.5"
            >
              Current Month
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1 px-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
