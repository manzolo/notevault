'use client';

import { useTranslations } from 'next-intl';
import { InfoIcon } from '@/components/common/Icons';
import { formatDate } from '@/lib/utils';

interface Props {
  createdAt: string;
  updatedAt?: string;
  extras?: { label: string; value: string }[];
}

export default function DateInfoTooltip({ createdAt, updatedAt, extras }: Props) {
  const t = useTranslations('common');
  const showUpdated = updatedAt && updatedAt !== createdAt;

  return (
    <div className="relative group/dateinfo inline-flex items-center">
      <InfoIcon className="h-3.5 w-3.5 text-gray-400 cursor-default" />
      <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/dateinfo:block z-20
                      bg-gray-800 dark:bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap
                      shadow-lg pointer-events-none">
        <div className="flex gap-1.5">
          <span className="text-gray-400">{t('createdAt')}:</span>
          <span>{formatDate(createdAt)}</span>
        </div>
        {showUpdated && (
          <div className="flex gap-1.5 mt-0.5">
            <span className="text-gray-400">{t('updatedAt')}:</span>
            <span>{formatDate(updatedAt)}</span>
          </div>
        )}
        {extras?.map((row) => (
          <div key={row.label} className="flex gap-1.5 mt-0.5">
            <span className="text-gray-400">{row.label}:</span>
            <span>{row.value}</span>
          </div>
        ))}
        {/* Arrow */}
        <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-900" />
      </div>
    </div>
  );
}
