'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from './ThemeProvider';
import LanguageSwitcher from './LanguageSwitcher';
import Button from './Button';

function SunIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14">
          <Link
            href={`/${locale}/dashboard`}
            className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent hover:from-indigo-700 hover:to-violet-700"
            onClick={closeMenu}
          >
            {t('brand')}
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <LanguageSwitcher />

            {user ? (
              <>
                <Link
                  href={`/${locale}/dashboard`}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {t('dashboard')}
                </Link>
                <Link
                  href={`/${locale}/notes/new`}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {t('newNote')}
                </Link>
                <Link
                  href={`/${locale}/tasks`}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {t('tasks')}
                </Link>
                <Link
                  href={`/${locale}/calendar`}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {t('calendar')}
                </Link>
                <Link
                  href={`/${locale}/settings`}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {t('settings')}
                </Link>
                <span className="text-sm text-gray-400">{user.username}</span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  {t('logout')}
                </Button>
              </>
            ) : (
              <>
                <Link href={`/${locale}/login`} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Login
                </Link>
                <Link href={`/${locale}/register`} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <XIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>
      </nav>

    {/* Mobile dropdown — sibling of <nav>, outside its backdrop-blur stacking context */}
    {menuOpen && (
      <div className="md:hidden fixed top-14 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-md px-4 py-3 flex flex-col gap-3 z-[60]">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <LanguageSwitcher />
        </div>

        {user ? (
          <>
            <Link
              href={`/${locale}/dashboard`}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-1"
              onClick={closeMenu}
            >
              {t('dashboard')}
            </Link>
            <Link
              href={`/${locale}/notes/new`}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-1"
              onClick={closeMenu}
            >
              {t('newNote')}
            </Link>
            <Link
              href={`/${locale}/tasks`}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-1"
              onClick={closeMenu}
            >
              {t('tasks')}
            </Link>
            <Link
              href={`/${locale}/calendar`}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-1"
              onClick={closeMenu}
            >
              {t('calendar')}
            </Link>
            <Link
              href={`/${locale}/settings`}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-1"
              onClick={closeMenu}
            >
              {t('settings')}
            </Link>
            <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-400">{user.username}</span>
              <Button variant="ghost" size="sm" onClick={() => { logout(); closeMenu(); }}>
                {t('logout')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Link
              href={`/${locale}/login`}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-1"
              onClick={closeMenu}
            >
              Login
            </Link>
            <Link
              href={`/${locale}/register`}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium py-1"
              onClick={closeMenu}
            >
              Register
            </Link>
          </>
        )}
      </div>
    )}
    </>
  );
}
