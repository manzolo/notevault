'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { register } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { useServerConfig } from '@/hooks/useServerConfig';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { refresh } = useAuth();
  const { registration_enabled } = useServerConfig();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(username, email, password);
      await refresh();
      router.push(`/${locale}/dashboard`);
    } catch {
      toast.error(t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-2xl font-bold text-center mb-2">{t('createAccount')}</h1>
        <p className="text-center text-gray-500 text-sm mb-6">NoteVault</p>

        {registration_enabled ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label={t('password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              {loading ? t('registering') : t('register')}
            </Button>
          </form>
        ) : (
          <p className="text-center text-sm text-gray-500 py-4">{t('registrationDisabled')}</p>
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          {t('hasAccount')}{' '}
          <Link href={`/${locale}/login`} className="text-blue-600 hover:underline font-medium">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
