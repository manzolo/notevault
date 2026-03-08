'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { setupTotp, enableTotp, disableTotp } from '@/lib/auth';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

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

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">{t('title')}</h1>

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
                    <Button type="submit" loading={enableLoading}>
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
