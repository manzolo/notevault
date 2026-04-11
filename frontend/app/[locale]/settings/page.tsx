'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { setupTotp, enableTotp, disableTotp, changePassword } from '@/lib/auth';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import api from '@/lib/api';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

type SetupState = 'idle' | 'pending' | 'done';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { user, refresh } = useAuth();

  // Setup flow state
  const [setupState, setSetupState] = useState<SetupState>('idle');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [enableCode, setEnableCode] = useState('');
  const [enableLoading, setEnableLoading] = useState(false);

  // Disable flow state
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Calendar export state
  const [exportLoading, setExportLoading] = useState(false);

  // Calendar feed URL state
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedRegenerating, setFeedRegenerating] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const handleSetup = async () => {
    try {
      const data = await setupTotp();
      setSetupSecret(data.secret);
      setSetupUri(data.otpauth_url);
      setSetupState('pending');
    } catch {
      toast.error(t('setupFailed'));
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnableLoading(true);
    try {
      await enableTotp(setupSecret, enableCode);
      await refresh();
      setSetupState('done');
      setEnableCode('');
      toast.success(t('enabledSuccess'));
    } catch {
      toast.error(t('invalidCode'));
    } finally {
      setEnableLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableLoading(true);
    try {
      await disableTotp(disablePassword);
      await refresh();
      setShowDisable(false);
      setDisablePassword('');
      toast.success(t('disabledSuccess'));
    } catch {
      toast.error(t('invalidPassword'));
    } finally {
      setDisableLoading(false);
    }
  };

  const feedUrl = feedToken
    ? `${process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/api/events/feed/${feedToken}/calendar.ics`
    : null;

  useEffect(() => {
    if (!user) return;
    setFeedLoading(true);
    api.get<{ token: string }>('/api/events/feed-token')
      .then((r) => setFeedToken(r.data.token))
      .catch(() => toast.error(t('feedError')))
      .finally(() => setFeedLoading(false));
  }, [user]);

  const handleCopyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
    } catch {
      // Fallback for HTTP / non-secure contexts where clipboard API is unavailable
      const ta = document.createElement('textarea');
      ta.value = feedUrl;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2000);
  };

  const handleRegenerateFeed = async () => {
    if (!confirm(t('feedRegenerateConfirm'))) return;
    setFeedRegenerating(true);
    try {
      const r = await api.post<{ token: string }>('/api/events/feed-token/regenerate');
      setFeedToken(r.data.token);
    } catch {
      toast.error(t('feedError'));
    } finally {
      setFeedRegenerating(false);
    }
  };

  const handleExportCalendar = async () => {
    setExportLoading(true);
    try {
      const response = await api.get('/api/events/export/calendar.ics', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notevault-calendar.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('passwordTooShort'));
      return;
    }
    setChangePasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success(t('changePasswordSuccess'));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(detail === 'Invalid current password' ? t('invalidPassword') : t('changePasswordFailed'));
    } finally {
      setChangePasswordLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">{t('title')}</h1>

      {/* ── Change password section ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t('changePasswordTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('changePasswordDesc')}</p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          <Input
            label={t('currentPassword')}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            label={t('newPassword')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label={t('confirmNewPassword')}
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button variant="secondary" type="submit" loading={changePasswordLoading}>
            {t('changePassword')}
          </Button>
        </form>
      </div>

      {/* ── Calendar Export section ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('exportTitle')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('exportDesc')}</p>
          </div>
          <Button variant="secondary" onClick={handleExportCalendar} loading={exportLoading}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {t('exportButton')}
          </Button>
        </div>
      </div>

      {/* ── Calendar Subscription URL section ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">{t('feedTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('feedDesc')}</p>
        </div>
        {feedLoading ? (
          <p className="text-sm text-gray-400">{t('feedLoading')}</p>
        ) : feedUrl ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={feedUrl}
                className="flex-1 text-xs font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 select-all min-w-0"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="secondary" onClick={handleCopyFeedUrl}>
                {feedCopied ? t('feedCopied') : t('feedCopy')}
              </Button>
            </div>
            <div>
              <Button variant="ghost" onClick={handleRegenerateFeed} loading={feedRegenerating}>
                {t('feedRegenerate')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── TOTP section ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t('totpTitle')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('totpDesc')}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            user.totp_enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {user.totp_enabled ? t('enabled') : t('disabled')}
          </span>
        </div>

        {/* ── TOTP not enabled ── */}
        {!user.totp_enabled && (
          <>
            {setupState === 'idle' && (
              <Button variant="secondary" onClick={handleSetup}>
                {t('setupTotp')}
              </Button>
            )}

            {setupState === 'pending' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('scanQr')}</p>
                <div className="flex justify-center p-4 bg-white rounded-lg border border-gray-200 w-fit">
                  <QRCodeSVG value={setupUri} size={180} />
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    {t('manualEntry')}
                  </summary>
                  <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs break-all select-all">
                    {setupSecret}
                  </code>
                </details>
                <form onSubmit={handleEnable} className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Input
                    label={t('verifyCode')}
                    value={enableCode}
                    onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="000000"
                    autoComplete="one-time-code"
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" type="submit" loading={enableLoading}>
                      {t('activate')}
                    </Button>
                    <Button variant="secondary" type="button" onClick={() => setSetupState('idle')}>
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

        {/* ── App version ── */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            NoteVault{' '}
            <span className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[11px]">
              v{APP_VERSION}
            </span>
          </p>
        </div>

        {/* ── TOTP enabled ── */}
        {user.totp_enabled && (
          <>
            {!showDisable ? (
              <Button variant="danger" onClick={() => setShowDisable(true)}>
                {t('disableTotp')}
              </Button>
            ) : (
              <form onSubmit={handleDisable} className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('confirmDisable')}</p>
                <Input
                  label={t('currentPassword')}
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="danger" loading={disableLoading}>
                    {t('disableTotp')}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => { setShowDisable(false); setDisablePassword(''); }}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
