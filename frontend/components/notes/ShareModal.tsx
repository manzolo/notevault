'use client';

import { useEffect, useState, useCallback } from 'react';
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
  events: boolean;
}

interface UserResult {
  id: number;
  username: string;
  email: string;
}

const DEFAULT_SECTIONS: Sections = {
  content: true,
  tasks: false,
  attachments: false,
  bookmarks: false,
  secrets: false,
  events: false,
};

type Visibility = 'public' | 'users' | 'specific';

export default function ShareModal({ noteId, onClose }: ShareModalProps) {
  const t = useTranslations('share');
  const [token, setToken] = useState<string | null>(null);
  const [sections, setSections] = useState<Sections>(DEFAULT_SECTIONS);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowedUserId, setAllowedUserId] = useState<number | null>(null);
  const [allowedUser, setAllowedUser] = useState<UserResult | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<{
        token: string | null;
        share_sections?: Sections;
        visibility?: Visibility;
        allowed_user_id?: number | null;
      }>(`/api/notes/${noteId}/share`)
      .then((r) => {
        setToken(r.data.token);
        if (r.data.share_sections) {
          setSections({ ...DEFAULT_SECTIONS, ...r.data.share_sections });
        }
        if (r.data.visibility) {
          setVisibility(r.data.visibility);
        }
        if (r.data.allowed_user_id) {
          setAllowedUserId(r.data.allowed_user_id);
        }
      })
      .finally(() => setLoading(false));
  }, [noteId]);

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}`
    : '';

  const postShare = async (
    newSections: Sections,
    newVisibility: Visibility,
    newAllowedUserId: number | null,
  ): Promise<string> => {
    const r = await api.post<{ token: string }>(`/api/notes/${noteId}/share`, {
      sections: newSections,
      visibility: newVisibility,
      allowed_user_id: newAllowedUserId,
    });
    return r.data.token;
  };

  const handleEnable = async () => {
    setWorking(true);
    try {
      const tok = await postShare(sections, visibility, allowedUserId);
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
    if (token) {
      setWorking(true);
      try {
        await postShare(newSections, visibility, allowedUserId);
      } finally {
        setWorking(false);
      }
    }
  };

  const handleVisibilityChange = async (newVisibility: Visibility) => {
    setVisibility(newVisibility);
    if (newVisibility !== 'specific') {
      setAllowedUserId(null);
      setAllowedUser(null);
    }
    if (token) {
      setWorking(true);
      try {
        const newAllowedId = newVisibility === 'specific' ? allowedUserId : null;
        if (newVisibility !== 'specific') {
          await postShare(sections, newVisibility, null);
        }
      } finally {
        setWorking(false);
      }
    }
  };

  const handleUserSearch = useCallback(async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) {
      setUserResults([]);
      return;
    }
    setUserSearching(true);
    try {
      const r = await api.get<UserResult[]>(`/api/users/search?q=${encodeURIComponent(q)}`);
      setUserResults(r.data);
    } finally {
      setUserSearching(false);
    }
  }, []);

  const handleSelectUser = async (user: UserResult) => {
    setAllowedUser(user);
    setAllowedUserId(user.id);
    setUserSearch('');
    setUserResults([]);
    if (token) {
      setWorking(true);
      try {
        await postShare(sections, 'specific', user.id);
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
    { key: 'events', label: t('sectionEvents') },
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
            {/* Visibility selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t('visibilityLabel')}
              </p>
              <div className="flex gap-2 flex-wrap">
                {(['public', 'users', 'specific'] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => handleVisibilityChange(v)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      visibility === v
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {t(
                      v === 'public'
                        ? 'visibilityPublic'
                        : v === 'users'
                        ? 'visibilityUsers'
                        : 'visibilitySpecific',
                    )}
                  </button>
                ))}
              </div>

              {/* User picker for "specific" visibility */}
              {visibility === 'specific' && (
                <div className="mt-2 space-y-2">
                  {allowedUser ? (
                    <div className="flex items-center justify-between text-xs bg-indigo-50 dark:bg-indigo-900/30 rounded-lg px-3 py-2">
                      <span className="text-indigo-700 dark:text-indigo-300">
                        {t('selectedUser')}: <strong>{allowedUser.username}</strong>
                      </span>
                      <button
                        onClick={() => {
                          setAllowedUser(null);
                          setAllowedUserId(null);
                        }}
                        className="text-gray-400 hover:text-red-500 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        placeholder={t('searchUser')}
                        className="w-full text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {userSearching && (
                        <div className="absolute right-2 top-2">
                          <svg className="animate-spin w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </div>
                      )}
                      {userResults.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                          {userResults.map((u) => (
                            <li key={u.id}>
                              <button
                                onClick={() => handleSelectUser(u)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300"
                              >
                                <span className="font-medium">{u.username}</span>
                                <span className="text-gray-400 ml-1">({u.email})</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {userSearch.length >= 2 && !userSearching && userResults.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">
                          {t('userNotFound')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

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
                {visibility === 'users' && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                    {t('loginRequired')}
                  </p>
                )}
                {visibility === 'specific' && allowedUser && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                    {t('accessDenied')}
                  </p>
                )}
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
                  disabled={working || (visibility === 'specific' && allowedUserId === null)}
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
