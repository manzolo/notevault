'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;

export default function SearchBar({ onSearch }: SearchBarProps) {
  const t = useTranslations('search');
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live search: fire after debounce when >= MIN_CHARS, clear when empty
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length === 0) {
      onSearch('');
      return;
    }
    if (query.length < MIN_CHARS) return;

    debounceRef.current = setTimeout(() => {
      onSearch(query.trim());
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= MIN_CHARS) onSearch(query.trim());
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
      >
        🔍
      </button>
    </form>
  );
}
