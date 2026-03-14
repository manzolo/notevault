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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {children}
    </span>
  );
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

  const hasAnyActive = activeFilterCount > 0;

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleExpanded}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <FilterIcon className="h-4 w-4" />
          <span>{t('filters')}</span>
          {hasAnyActive && (
            <span className="inline-flex items-center justify-center h-4 w-4 text-xs font-bold bg-indigo-600 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Active filter chips (visible even when collapsed) */}
        {!isExpanded && hasAnyActive && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedTagId !== null && (
              <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">
                {tags.find(t => t.id === selectedTagId)?.name ?? 'Tag'}
                <button onClick={() => onTagSelect(null)} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100">×</button>
              </span>
            )}
            {pinnedOnly && (
              <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full">
                <PinIcon className="h-3 w-3" filled />
                {t('pinnedOnly')}
                <button onClick={onPinnedOnlyToggle} className="ml-0.5 hover:text-indigo-900 dark:hover:text-indigo-100">×</button>
              </span>
            )}
            {archivedOnly && (
              <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs px-2 py-0.5 rounded-full">
                <ArchiveIcon className="h-3 w-3" />
                {t('archivedOnly')}
                <button onClick={onArchivedOnlyToggle} className="ml-0.5 hover:text-amber-900 dark:hover:text-amber-100">×</button>
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `≥ ${dateFrom}` : `≤ ${dateTo}`}
                <button onClick={() => onDateChange('', '')} className="ml-0.5 hover:text-gray-900 dark:hover:text-gray-100">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <SectionLabel>{t('tagsLabel')}</SectionLabel>
              <TagFilter tags={tags} selectedTagId={selectedTagId} onSelect={onTagSelect} />
            </div>
          )}

          {/* Show toggles */}
          <div className="px-3 py-2.5 flex flex-col gap-2">
            <SectionLabel>{t('showLabel')}</SectionLabel>
            <div className="flex gap-2 flex-wrap">
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
          </div>

          {/* Date range */}
          <div className="px-3 py-2.5 flex flex-col gap-2">
            <SectionLabel>{t('filterByDate')}</SectionLabel>
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
            <p className="text-xs text-gray-400 dark:text-gray-500">{t('dateFilterHint')}</p>
          </div>

          {/* Reset all */}
          {hasAnyActive && (
            <div className="px-3 py-2">
              <button
                onClick={() => { onTagSelect(null); if (pinnedOnly) onPinnedOnlyToggle(); if (archivedOnly) onArchivedOnlyToggle(); onDateChange('', ''); }}
                className="text-xs text-red-500 dark:text-red-400 hover:underline"
              >
                {t('resetFilters')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
