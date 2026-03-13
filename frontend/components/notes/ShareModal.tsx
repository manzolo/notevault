'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import Button from '@/components/common/Button';

interface ShareModalProps {
  noteId: number;
  onClose: () => void;
}

export default function ShareModal({ noteId, onClose }: ShareModalProps) {
  const t = useTranslations('share');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<{ token: string | null }>(`/api/notes/${noteId}/share`)
      .then((r) => setToken(r.data.token))
      .finally(() => setLoading(false));
  }, [noteId]);

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}`
    : '';

  const handleEnable = async () => {
    setWorking(true);
    try {
      const r = await api.post<{ token: string }>(`/api/notes/${noteId}/share`);
      setToken(r.data.token);
    } finally {
      setWorking(false);
    }
  };

  const handleDisable = async () => {
    setWorking(true);
    try {
      await api.delete(`/api/notes/${noteId}/share`);
      setToken(null);
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('shareNote')}</h2>

        {loading ? (
          <div className="flex justify-center py-4">
            <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : token ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('shareDesc')}</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 truncate"
              />
              <Button variant="secondary" onClick={handleCopy} className="shrink-0 text-xs">
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
            <Button variant="danger" onClick={handleDisable} disabled={working} className="w-full text-sm">
              {t('disable')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('notShared')}</p>
            <Button variant="secondary" onClick={handleEnable} disabled={working} className="w-full text-sm">
              {t('enable')}
            </Button>
          </div>
        )}

        <div className="pt-1">
          <Button variant="ghost" onClick={onClose} className="w-full text-sm">{t('close')}</Button>
        </div>
      </div>
    </div>
  );
}
