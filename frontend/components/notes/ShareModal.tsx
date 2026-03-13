'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import Button from '@/components/common/Button';

interface ShareModalProps {
  noteId: number;
  onClose: () => void;
}

interface Sections {
  content: boolean;
  tasks: boolean;
  attachments: boolean;
  bookmarks: boolean;
  secrets: boolean;
}

const DEFAULT_SECTIONS: Sections = {
  content: true,
  tasks: false,
  attachments: false,
  bookmarks: false,
  secrets: false,
};

export default function ShareModal({ noteId, onClose }: ShareModalProps) {
  const t = useTranslations('share');
  const [token, setToken] = useState<string | null>(null);
  const [sections, setSections] = useState<Sections>(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<{ token: string | null; share_sections?: Sections }>(`/api/notes/${noteId}/share`)
      .then((r) => {
        setToken(r.data.token);
        if (r.data.share_sections) {
          setSections({ ...DEFAULT_SECTIONS, ...r.data.share_sections });
        }
      })
      .finally(() => setLoading(false));
  }, [noteId]);

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}`
    : '';

  const postShare = async (newSections: Sections): Promise<string> => {
    const r = await api.post<{ token: string }>(`/api/notes/${noteId}/share`, {
      sections: newSections,
    });
    return r.data.token;
  };

  const handleEnable = async () => {
    setWorking(true);
    try {
      const tok = await postShare(sections);
      setToken(tok);
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

  const handleSectionChange = async (key: keyof Sections, value: boolean) => {
    const newSections = { ...sections, [key]: value };
    setSections(newSections);
    // If already shared, persist the updated sections immediately
    if (token) {
      setWorking(true);
      try {
        await postShare(newSections);
      } finally {
        setWorking(false);
      }
    }
  };

  const sectionLabels: { key: keyof Sections; label: string }[] = [
    { key: 'content', label: t('sectionContent') },
    { key: 'tasks', label: t('sectionTasks') },
    { key: 'attachments', label: t('sectionAttachments') },
    { key: 'bookmarks', label: t('sectionBookmarks') },
    { key: 'secrets', label: t('sectionSecrets') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('shareNote')}
        </h2>

        {loading ? (
          <div className="flex justify-center py-4">
            <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : (
          <>
            {/* Section selection checkboxes — always visible */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t('sectionsLabel')}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {sectionLabels.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={sections[key]}
                      disabled={working || key === 'content'}
                      onChange={(e) => handleSectionChange(key, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    {label}
                    {key === 'secrets' && sections[key] && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ⚠
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {token ? (
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
                {sections.secrets && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                    {t('secretsWarning')}
                  </p>
                )}
                <Button
                  variant="danger"
                  onClick={handleDisable}
                  disabled={working}
                  className="w-full text-sm"
                >
                  {t('disable')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('notShared')}</p>
                <Button
                  variant="secondary"
                  onClick={handleEnable}
                  disabled={working}
                  className="w-full text-sm"
                >
                  {t('enable')}
                </Button>
              </div>
            )}
          </>
        )}

        <div className="pt-1">
          <Button variant="ghost" onClick={onClose} className="w-full text-sm">
            {t('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
