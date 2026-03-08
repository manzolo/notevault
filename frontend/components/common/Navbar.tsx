'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import Button from './Button';

export default function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14">
          <Link
            href={`/${locale}/dashboard`}
            className="text-lg font-bold text-blue-600 hover:text-blue-700"
          >
            {t('brand')}
          </Link>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />

            {user ? (
              <>
                <Link
                  href={`/${locale}/dashboard`}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('dashboard')}
                </Link>
                <Link
                  href={`/${locale}/notes/new`}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('newNote')}
                </Link>
                <span className="text-sm text-gray-400">{user.username}</span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  {t('logout')}
                </Button>
              </>
            ) : (
              <>
                <Link href={`/${locale}/login`} className="text-sm text-gray-600 hover:text-gray-900">
                  Login
                </Link>
                <Link href={`/${locale}/register`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
