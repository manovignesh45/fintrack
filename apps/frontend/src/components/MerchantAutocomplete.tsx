import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Tag, CreditCard, Clock, Landmark } from 'lucide-react';
import type { Account, Category, PaymentMethod, TransactionSuggestion } from '../api/types';

interface AutoFillNotice {
  merchant: string;
  amount?: number;
  principalAmount?: number;
  interestAmount?: number;
  loanAccountName?: string;
  isTemplate?: boolean;
  categoryName?: string;
  subCategoryName?: string;
  paymentMethodName?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion: (suggestion: TransactionSuggestion, isExplicit?: boolean) => void;
  suggestions: TransactionSuggestion[];
  accounts: Account[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  autoFillNotice?: AutoFillNotice | null;
  onUndoAutoFill?: () => void;
  disabled?: boolean;
  required?: boolean;
}

export default function MerchantAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  suggestions,
  accounts,
  categories,
  paymentMethods,
  autoFillNotice,
  onUndoAutoFill,
  disabled = false,
  required = true,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper maps for instantaneous account, category & payment method name lookups
  const accountMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accounts) {
      map.set(a.id, a.name);
    }
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<number, { catName: string; subCats: Map<number, string> }>();
    for (const c of categories) {
      const subMap = new Map<number, string>();
      if (c.sub_categories) {
        for (const sc of c.sub_categories) {
          subMap.set(sc.id, sc.name);
        }
      }
      map.set(c.id, { catName: c.name, subCats: subMap });
    }
    return map;
  }, [categories]);

  const paymentMethodMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const pm of paymentMethods) {
      map.set(pm.id, pm.name);
    }
    return map;
  }, [paymentMethods]);

  const resolveMeta = (s: TransactionSuggestion) => {
    let catName: string | undefined;
    let subCatName: string | undefined;

    if (s.category_id && categoryMap.has(s.category_id)) {
      const entry = categoryMap.get(s.category_id)!;
      catName = entry.catName;
      if (s.sub_category_id && entry.subCats.has(s.sub_category_id)) {
        subCatName = entry.subCats.get(s.sub_category_id);
      }
    } else if (s.sub_category_id) {
      // Find which category contains this subcategory
      for (const entry of categoryMap.values()) {
        if (entry.subCats.has(s.sub_category_id)) {
          catName = entry.catName;
          subCatName = entry.subCats.get(s.sub_category_id);
          break;
        }
      }
    }

    const pmName = s.payment_method_id ? paymentMethodMap.get(s.payment_method_id) : undefined;

    let loanAccountName: string | undefined;
    if (s.nature === 'EMI_PAYMENT' && s.target_account_id) {
      loanAccountName = accountMap.get(s.target_account_id);
    } else if (s.nature === 'LOAN_DISBURSEMENT' && s.source_account_id) {
      loanAccountName = accountMap.get(s.source_account_id);
    }

    return { catName, subCatName, pmName, loanAccountName };
  };

  // Top 4 most frequent merchants for quick-fill chips
  const frequentChips = useMemo(() => {
    return suggestions.slice(0, 4);
  }, [suggestions]);

  // Filter suggestions matching the user's input
  const filteredSuggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) {
      // When input is blank but focused, show top 6 frequent merchants
      return suggestions.slice(0, 6);
    }

    const exactOrPrefix: TransactionSuggestion[] = [];
    const substringMatches: TransactionSuggestion[] = [];

    for (const s of suggestions) {
      const titleLower = s.title.toLowerCase();
      if (titleLower.startsWith(q)) {
        exactOrPrefix.push(s);
      } else if (titleLower.includes(q)) {
        substringMatches.push(s);
      }
    }

    return [...exactOrPrefix, ...substringMatches].slice(0, 6);
  }, [suggestions, value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (s: TransactionSuggestion) => {
    onSelectSuggestion(s, true);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % filteredSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          e.preventDefault();
          handleSelect(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSelect(filteredSuggestions[highlightedIndex]);
        } else {
          // Check for exact match on Tab
          const q = value.trim().toLowerCase();
          const match = suggestions.find((s) => s.title.toLowerCase() === q);
          if (match) {
            onSelectSuggestion(match, false);
          }
          setIsOpen(false);
        }
        break;
    }
  };

  const handleBlur = () => {
    // Slight timeout so click on suggestion dropdown fires first
    setTimeout(() => {
      const q = value.trim().toLowerCase();
      if (!q) return;
      // If user typed an exact match title, trigger auto-fill seamlessly
      const match = suggestions.find((s) => s.title.toLowerCase() === q);
      if (match) {
        onSelectSuggestion(match, false);
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-500 dark:text-gray-400 block">Title *</label>
        {suggestions.length > 0 && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3" /> Smart suggestions enabled
          </span>
        )}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="e.g. Swiggy, Groceries, Amazon"
          value={value}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white"
          autoComplete="off"
        />
      </div>

      {/* Auto-fill banner notification */}
      {autoFillNotice && (
        <div className="flex items-center justify-between mt-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs text-blue-800 dark:text-blue-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              Auto-filled from <strong>{autoFillNotice.merchant}</strong>
              {autoFillNotice.isTemplate ? ' (template)' : ''}
              {autoFillNotice.loanAccountName && ` · Loan: ${autoFillNotice.loanAccountName}`}
              {autoFillNotice.amount !== undefined ? ` · ₹${autoFillNotice.amount.toLocaleString('en-IN')}` : ''}
              {autoFillNotice.principalAmount !== undefined && autoFillNotice.principalAmount > 0
                ? ` (Principal: ₹${autoFillNotice.principalAmount.toLocaleString('en-IN')}, Interest: ₹${(autoFillNotice.interestAmount || 0).toLocaleString('en-IN')})`
                : ''}
              {autoFillNotice.categoryName && ` · ${autoFillNotice.categoryName}`}
              {autoFillNotice.subCategoryName && ` › ${autoFillNotice.subCategoryName}`}
              {autoFillNotice.paymentMethodName && ` · ${autoFillNotice.paymentMethodName}`}
            </span>
          </div>
          {onUndoAutoFill && (
            <button
              type="button"
              onClick={onUndoAutoFill}
              className="ml-2 px-1.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:underline shrink-0"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Quick merchant chips when field is empty */}
      {!value && frequentChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> Frequent:
          </span>
          {frequentChips.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => handleSelect(s)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-700 dark:bg-gray-800 dark:hover:bg-blue-900/40 dark:text-gray-300 dark:hover:text-blue-300 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <span>{s.title}</span>
              {s.is_template && s.amount !== undefined ? (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  ₹{s.amount.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{s.frequency}x</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Suggestion Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60 max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50/70 dark:bg-gray-800/80">
            {value.trim() ? 'Matching history' : 'Frequent merchants'}
          </div>
          {filteredSuggestions.map((s, idx) => {
            const { catName, subCatName, pmName, loanAccountName } = resolveMeta(s);
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={`${s.title}-${idx}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur before click
                  handleSelect(s);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  isHighlighted
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {s.title}
                    </span>
                    {s.nature === 'EMI_PAYMENT' && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                        EMI
                      </span>
                    )}
                    {s.is_template && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                        Template {s.amount !== undefined ? `· ₹${s.amount.toLocaleString('en-IN')}` : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded shrink-0 ml-2">
                    {s.frequency} {s.frequency === 1 ? 'time' : 'times'}
                  </span>
                </div>

                {(catName || pmName || loanAccountName || (s.amount && s.nature === 'EMI_PAYMENT')) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {loanAccountName && (
                      <span className="inline-flex items-center gap-0.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded font-medium">
                        <Landmark className="w-2.5 h-2.5 shrink-0" />
                        <span>Loan: {loanAccountName}</span>
                      </span>
                    )}
                    {s.nature === 'EMI_PAYMENT' && s.principal_amount !== undefined && s.principal_amount > 0 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        ₹{(s.amount || (s.principal_amount + (s.interest_amount || 0))).toLocaleString('en-IN')} (P: ₹{s.principal_amount.toLocaleString('en-IN')} + I: ₹{(s.interest_amount || 0).toLocaleString('en-IN')})
                      </span>
                    )}
                    {catName && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        <Tag className="w-2.5 h-2.5 shrink-0" />
                        <span>
                          {catName}
                          {subCatName ? ` › ${subCatName}` : ''}
                        </span>
                      </span>
                    )}
                    {pmName && (
                      <span className="inline-flex items-center gap-0.5 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                        <CreditCard className="w-2.5 h-2.5 shrink-0" />
                        <span>{pmName}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
