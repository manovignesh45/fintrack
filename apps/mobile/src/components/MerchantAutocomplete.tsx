import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { Account, Category, PaymentMethod, TransactionSuggestion } from '@fintrack/shared';

export interface AutoFillNotice {
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
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

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

  const frequentChips = useMemo(() => {
    return suggestions.slice(0, 4);
  }, [suggestions]);

  const filteredSuggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) {
      return suggestions.slice(0, 5);
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

    return [...exactOrPrefix, ...substringMatches].slice(0, 5);
  }, [suggestions, value]);

  const handleSelect = (s: TransactionSuggestion) => {
    onSelectSuggestion(s, true);
    setIsOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      const q = value.trim().toLowerCase();
      if (!q) return;
      const match = suggestions.find((s) => s.title.toLowerCase() === q);
      if (match) {
        onSelectSuggestion(match, false);
      }
      setIsOpen(false);
    }, 200);
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400">Title *</Text>
        {suggestions.length > 0 && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="sparkles" size={12} color="#2563eb" />
            <Text className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              Suggestions enabled
            </Text>
          </View>
        )}
      </View>

      <TextInput
        value={value}
        onChangeText={(text) => {
          onChange(text);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={handleBlur}
        editable={!disabled}
        placeholder="e.g. Swiggy, Groceries, Amazon"
        placeholderTextColor={placeholderColor}
        className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
      />

      {/* Auto-fill Notice Banner */}
      {autoFillNotice && (
        <View className="flex-row items-center justify-between mt-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg">
          <View className="flex-1 flex-row items-center gap-1.5 mr-2">
            <Ionicons name="sparkles" size={14} color="#2563eb" />
            <Text className="text-xs text-blue-800 dark:text-blue-200" numberOfLines={1}>
              Auto-filled from {autoFillNotice.merchant}
              {autoFillNotice.amount !== undefined ? ` · ₹${autoFillNotice.amount.toLocaleString('en-IN')}` : ''}
              {autoFillNotice.categoryName ? ` · ${autoFillNotice.categoryName}` : ''}
              {autoFillNotice.subCategoryName ? ` › ${autoFillNotice.subCategoryName}` : ''}
            </Text>
          </View>
          {onUndoAutoFill && (
            <TouchableOpacity onPress={onUndoAutoFill} className="px-2 py-0.5">
              <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">Undo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Frequent Merchant Chips */}
      {!value && frequentChips.length > 0 && (
        <View className="flex-row flex-wrap items-center gap-1.5 mt-2">
          <Text className="text-[11px] text-gray-400 dark:text-gray-500">Frequent:</Text>
          {frequentChips.map((s) => (
            <TouchableOpacity
              key={s.title}
              onPress={() => handleSelect(s)}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.title}</Text>
              {s.is_template && s.amount !== undefined ? (
                <Text className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  ₹{s.amount.toLocaleString('en-IN')}
                </Text>
              ) : (
                <Text className="text-[10px] text-gray-400">{s.frequency}x</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <View className="mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-30">
          <View className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {value.trim() ? 'Matching History' : 'Frequent Merchants'}
            </Text>
          </View>
          {filteredSuggestions.map((s, idx) => {
            const { catName, subCatName, pmName, loanAccountName } = resolveMeta(s);
            return (
              <TouchableOpacity
                key={`${s.title}-${idx}`}
                onPress={() => handleSelect(s)}
                className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-b-0 active:bg-blue-50 dark:active:bg-blue-900/30"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                    <Text className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {s.title}
                    </Text>
                    {s.nature === 'EMI_PAYMENT' && (
                      <View className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
                        <Text className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">EMI</Text>
                      </View>
                    )}
                    {s.is_template && (
                      <View className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                        <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Template</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[10px] text-gray-400 dark:text-gray-500">
                    {s.frequency} {s.frequency === 1 ? 'time' : 'times'}
                  </Text>
                </View>

                {/* Subtitle with category, payment method or amount */}
                <View className="flex-row items-center gap-2 mt-1">
                  {catName && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      🏷️ {catName}{subCatName ? ` › ${subCatName}` : ''}
                    </Text>
                  )}
                  {pmName && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      💳 {pmName}
                    </Text>
                  )}
                  {loanAccountName && (
                    <Text className="text-xs text-purple-600 dark:text-purple-400">
                      🏦 {loanAccountName}
                    </Text>
                  )}
                  {s.amount !== undefined && s.amount > 0 && (
                    <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-auto">
                      ₹{s.amount.toLocaleString('en-IN')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
