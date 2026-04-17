'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';

interface ConfirmDialogProps {
  message: string;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'secondary';
  inputLabel?: string;
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmVariant = 'danger',
  inputLabel,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const [inputValue, setInputValue] = useState('');

  const isDanger = confirmVariant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-md"
      onClick={onCancel}
    >
      <div
        className="relative bg-white dark:bg-vault-800 rounded-xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4 border border-cream-300/60 dark:border-vault-600/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${isDanger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
            {isDanger ? (
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 pt-2">{message}</p>
        </div>

        {inputLabel && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">{inputLabel}</label>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder={t('optionalPlaceholder')}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            variant={confirmVariant === 'danger' ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => onConfirm(inputLabel ? inputValue : undefined)}
          >
            {confirmLabel ?? t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
