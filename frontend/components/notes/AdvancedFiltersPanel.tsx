'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tag } from '@/lib/types';
import { ArchiveIcon, ChevronDownIcon, FilterIcon, PinIcon } from '@/components/common/Icons';
import TagFilter from '@/components/search/TagFilter';

interface AdvancedFiltersPanelProps {
  tags: Tag[];
  selectedTagId: number | null;
  dateFrom: string;
  dateTo: string;
  pinnedOnly: boolean;
  archivedOnly: boolean;
  onTagSelect: (tagId: number | null) => void;
  onDateChange: (from: string, to: string) => void;
  onPinnedOnlyToggle: () => void;
  onArchivedOnlyToggle: () => void;
}

export default function AdvancedFiltersPanel({
  tags,
  selectedTagId,
  dateFrom,
  dateTo,
  pinnedOnly,
  archivedOnly,
  onTagSelect,
  onDateChange,
  onPinnedOnlyToggle,
  onArchivedOnlyToggle,
}: AdvancedFiltersPanelProps) {
  const t = useTranslations('notes');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('notevault.filtersExpanded');
    if (saved !== null) setIsExpanded(saved === 'true');
  }, []);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('notevault.filtersExpanded', String(next));
      return next;
    });
  };

  const activeFilterCount = [
    selectedTagId !== null,
    !!dateFrom,
    !!dateTo,
    pinnedOnly,
    archivedOnly,
  ].filter(Boolean).length;

  return (
    <div className="mb-4">
      <button
        onClick={toggleExpanded}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <FilterIcon className="h-4 w-4" />
        <span>{t('filters')}</span>
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 w-4 text-xs font-bold bg-indigo-600 text-white rounded-full">
            {activeFilterCount}
          </span>
        )}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {tags.length > 0 && (
              <TagFilter tags={tags} selectedTagId={selectedTagId} onSelect={onTagSelect} />
            )}
            <button
              onClick={onPinnedOnlyToggle}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                pinnedOnly
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
            >
              <PinIcon className="h-3.5 w-3.5" filled={pinnedOnly} />
              {t('pinnedOnly')}
            </button>
            <button
              onClick={onArchivedOnlyToggle}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                archivedOnly
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-600'
              }`}
            >
              <ArchiveIcon className="h-3.5 w-3.5" />
              {t('archivedOnly')}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('filterByDate')}:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{t('dateFrom')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateChange(e.target.value, dateTo)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                             bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                             focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full sm:w-auto"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{t('dateTo')}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateChange(dateFrom, e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                             bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                             focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full sm:w-auto"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => onDateChange('', '')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                >
                  {t('clearDate')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
