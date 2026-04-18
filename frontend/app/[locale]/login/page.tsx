'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { login, verifyTotp } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { useServerConfig } from '@/hooks/useServerConfig';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { refresh } = useAuth();

  const { registration_enabled } = useServerConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.totp_required && result.partial_token) {
        setPartialToken(result.partial_token);
      } else {
        await refresh();
        router.push(`/${locale}/dashboard`);
      }
    } catch {
      toast.error(t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialToken) return;
    setLoading(true);
    try {
      await verifyTotp(partialToken, totpCode);
      await refresh();
      router.push(`/${locale}/dashboard`);
    } catch {
      toast.error(t('totpInvalid'));
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        {!partialToken ? (
          <>
            <h1 className="text-2xl font-bold text-center mb-2">{t('welcomeBack')}</h1>
            <p className="text-center text-gray-500 text-sm mb-6">NoteVault</p>
            <form onSubmit={handleCredentials} className="space-y-4">
              <Input
                label={t('username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
              <Input
                label={t('password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Button type="submit" loading={loading} className="w-full">
                {loading ? t('loggingIn') : t('login')}
              </Button>
            </form>
            {registration_enabled && (
              <p className="mt-4 text-center text-sm text-gray-500">
                {t('noAccount')}{' '}
                <Link href={`/${locale}/register`} className="text-blue-600 hover:underline font-medium">
                  {t('register')}
                </Link>
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-center mb-2">{t('totpTitle')}</h1>
            <p className="text-center text-gray-500 text-sm mb-6">{t('totpHint')}</p>
            <form onSubmit={handleTotp} className="space-y-4">
              <Input
                label={t('totpCode')}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
              />
              <Button variant="secondary" type="submit" loading={loading} className="w-full">
                {loading ? t('loggingIn') : t('totpVerify')}
              </Button>
            </form>
            <button
              onClick={() => setPartialToken(null)}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ← {t('backToLogin')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
