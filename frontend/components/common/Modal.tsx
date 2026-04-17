'use client';

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const t = useTranslations('common');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-vault-800 rounded-xl shadow-modal w-full max-w-md overflow-hidden border border-cream-300/60 dark:border-vault-600/60">
          <div className="border-t-[3px] border-t-violet-500 dark:border-t-violet-400 px-6 py-4 flex items-center justify-between border-b border-cream-200 dark:border-vault-700/80 bg-gradient-to-br from-violet-50/60 to-white dark:from-vault-700/30 dark:to-vault-800">
            <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-vault-50 tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-50 transition-colors rounded-md p-0.5 hover:bg-cream-200/60 dark:hover:bg-vault-700/60"
              aria-label={t('close')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
