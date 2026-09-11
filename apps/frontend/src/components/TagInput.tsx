import { useState, useEffect, useRef } from 'react';
import { tagsApi } from '../api/client';
import type { Tag } from '../api/types';

interface Props {
  selectedTagIds: number[];
  onChange: (ids: number[]) => void;
}

export default function TagInput({ selectedTagIds, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tagsApi.list().then((tags) => setAllTags(tags || [])).catch(() => setAllTags([]));
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInputFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      // Ignored or handle error
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500 dark:text-gray-400 block">
          Tags / Event Grouping
        </label>
        <span className="text-[10px] text-gray-400">e.g. vacation, trip, wedding</span>
      </div>

      <div className="min-h-[42px] px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 flex flex-wrap items-center gap-1.5">
        {/* Selected Tag Pills */}
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-md text-xs font-medium"
          >
            <span>🏷️</span>
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-100 p-0.5 rounded-full"
              aria-label={`Remove tag ${tag.name}`}
            >
              ✕
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredTags.length > 0 && query.trim()) {
                handleAddTag(filteredTags[0]);
              } else if (query.trim() && !exactMatch) {
                handleCreateNewTag();
              }
            } else if (e.key === 'Backspace' && !query && selectedTagIds.length > 0) {
              handleRemoveTag(selectedTagIds[selectedTagIds.length - 1]);
            }
          }}
          placeholder={selectedTags.length === 0 ? 'Add tags (e.g. goa-trip, diwali)' : '+ tag'}
          className="flex-1 min-w-[90px] border-none outline-none text-xs bg-transparent dark:text-white placeholder-gray-400 py-1"
        />
      </div>

      {/* Autocomplete Dropdown */}
      {isInputFocused && (query.trim() || filteredTags.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto p-1 text-xs">
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddTag(tag);
              }}
              className="w-full text-left px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex items-center justify-between"
            >
              <span>🏷️ {tag.name}</span>
              <span className="text-[10px] text-gray-400">existing</span>
            </button>
          ))}

          {query.trim() && !exactMatch && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreateNewTag();
              }}
              disabled={isCreating}
              className="w-full text-left px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium flex items-center justify-between"
            >
              <span>+ Create &quot;{query.trim()}&quot;</span>
              <span className="text-[10px] text-blue-500">new tag</span>
            </button>
          )}
        </div>
      )}

      {/* Quick Suggestion Chips (when none selected or low selection) */}
      {selectedTags.length === 0 && allTags.length > 0 && !isInputFocused && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[10px] text-gray-400">Quick add:</span>
          {allTags.slice(0, 5).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleAddTag(t)}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full text-[11px] transition-colors"
            >
              +{t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
