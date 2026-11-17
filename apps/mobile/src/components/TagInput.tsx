import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tagsApi } from '@/src/api/client';
import type { Tag } from '@fintrack/shared';
import { useColorScheme } from 'nativewind';

interface Props {
  selectedTagIds: number[];
  onChange: (ids: number[]) => void;
  /** Called when the field (or its suggestion list) needs scrolling into view above the keyboard. */
  onReveal?: () => void;
}

export default function TagInput({ selectedTagIds, onChange, onReveal }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    tagsApi
      .list()
      .then((tags) => setAllTags(tags || []))
      .catch(() => setAllTags([]));
  }, []);

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));

  const filteredTags = allTags.filter(
    (t) =>
      !selectedTagIds.includes(t.id) &&
      t.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const exactMatch = allTags.some(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase()
  );

  const showDropdown = isFocused && (query.trim().length > 0 || filteredTags.length > 0);

  // The suggestion list renders below the input; keep it visible when it opens.
  useEffect(() => {
    if (showDropdown) onReveal?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the list opening
  }, [showDropdown]);

  const handleAddTag = (tag: Tag) => {
    if (!selectedTagIds.includes(tag.id)) {
      onChange([...selectedTagIds, tag.id]);
    }
    setQuery('');
  };

  const handleRemoveTag = (id: number) => {
    onChange(selectedTagIds.filter((tId) => tId !== id));
  };

  const handleCreateNewTag = async () => {
    const trimmed = query.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const created = await tagsApi.create({ name: trimmed });
      setAllTags((prev) => [...prev, created]);
      handleAddTag(created);
    } catch {
      // Ignore or handle error
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400">Tags / Event Grouping</Text>
        <Text className="text-[10px] text-gray-400">e.g. trip, wedding</Text>
      </View>

      <View className="min-h-[44px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 flex-row flex-wrap items-center gap-1.5">
        {/* Selected Tag Pills */}
        {selectedTags.map((tag) => (
          <View
            key={tag.id}
            className="flex-row items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md"
          >
            <Text className="text-xs text-blue-700 dark:text-blue-300 font-medium">🏷️ {tag.name}</Text>
            <TouchableOpacity
              onPress={() => handleRemoveTag(tag.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={14} color={isDark ? '#93c5fd' : '#1d4ed8'} />
            </TouchableOpacity>
          </View>
        ))}

        {/* TextInput */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => {
            setIsFocused(true);
            onReveal?.();
          }}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={selectedTags.length === 0 ? 'Add tags (e.g. goa-trip, diwali)' : '+ tag'}
          placeholderTextColor={placeholderColor}
          className="flex-1 min-w-[100px] text-sm text-gray-800 dark:text-gray-100 py-0"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (filteredTags.length > 0 && query.trim()) {
              handleAddTag(filteredTags[0]);
            } else if (query.trim() && !exactMatch) {
              handleCreateNewTag();
            }
          }}
        />
      </View>

      {/* Autocomplete Dropdown / Suggestions */}
      {showDropdown && (
        <View className="mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden p-1 z-30">
          {filteredTags.slice(0, 5).map((tag) => (
            <TouchableOpacity
              key={tag.id}
              onPress={() => handleAddTag(tag)}
              className="flex-row items-center justify-between px-3 py-2 rounded-md active:bg-gray-100 dark:active:bg-gray-700"
            >
              <Text className="text-sm text-gray-800 dark:text-gray-200">🏷️ {tag.name}</Text>
              <Text className="text-[10px] text-gray-400">existing</Text>
            </TouchableOpacity>
          ))}

          {query.trim().length > 0 && !exactMatch && (
            <TouchableOpacity
              onPress={handleCreateNewTag}
              disabled={isCreating}
              className="flex-row items-center justify-between px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/30 active:bg-blue-100 dark:active:bg-blue-900/50"
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <>
                  <Text className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    + Create &quot;{query.trim()}&quot;
                  </Text>
                  <Text className="text-[10px] text-blue-500">new tag</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Quick Suggestion Chips (when input not focused and none or few selected) */}
      {selectedTags.length === 0 && allTags.length > 0 && !isFocused && (
        <View className="flex-row flex-wrap items-center gap-1 mt-1.5">
          <Text className="text-[10px] text-gray-400">Quick add:</Text>
          {allTags.slice(0, 5).map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => handleAddTag(t)}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700"
            >
              <Text className="text-[11px] text-gray-600 dark:text-gray-300">+{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
