'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from './ThemeProvider';
import LanguageSwitcher from './LanguageSwitcher';
import {
  HomeIcon,
  PlusIcon,
  CheckSquareIcon,
  CalendarIcon,
  CogIcon,
  UserIcon,
  LogoutIcon,
} from './Icons';

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
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const isActive = (segment: string) => pathname.includes(`/${segment}`);

  const navLinkClass = (segment: string) =>
    `flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md transition-colors font-medium whitespace-nowrap ${
      isActive(segment)
        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60'
    }`;

  const mobileNavLinkClass = (segment: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
      isActive(segment)
        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
    }`;

  return (
    <>
      <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-700/80 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between h-14 gap-4">

            {/* Logo */}
            <Link
              href={`/${locale}/dashboard`}
              className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent shrink-0"
              onClick={closeMenu}
            >
              {t('brand')}
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-end">

              {/* Controls: theme + language */}
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                <LanguageSwitcher />
              </div>

              {/* Separator */}
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

              {/* Nav links */}
              {user && (
                <>
                  <Link href={`/${locale}/dashboard`} className={navLinkClass('dashboard')}>
                    <HomeIcon className="w-3.5 h-3.5" />
                    {t('dashboard')}
                  </Link>
                  <Link href={`/${locale}/notes/new`} className={navLinkClass('notes/new')}>
                    <PlusIcon className="w-3.5 h-3.5" />
                    {t('newNote')}
                  </Link>
                  <Link href={`/${locale}/tasks`} className={navLinkClass('tasks')}>
                    <CheckSquareIcon className="w-3.5 h-3.5" />
                    {t('tasks')}
                  </Link>
                  <Link href={`/${locale}/calendar`} className={navLinkClass('calendar')}>
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {t('calendar')}
                  </Link>
                  <Link href={`/${locale}/settings`} className={navLinkClass('settings')}>
                    <CogIcon className="w-3.5 h-3.5" />
                    {t('settings')}
                  </Link>

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

                  {/* User + logout */}
                  <div className="flex items-center gap-1">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap">
                      <UserIcon className="w-3.5 h-3.5" />
                      {user.username}
                    </span>
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                      title={t('logout')}
                    >
                      <LogoutIcon className="w-3.5 h-3.5" />
                      {t('logout')}
                    </button>
                  </div>
                </>
              )}

              {!user && (
                <>
                  <Link href={`/${locale}/login`} className={navLinkClass('login')}>Login</Link>
                  <Link href={`/${locale}/register`} className="text-sm px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg z-[60] overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <div className="px-3 py-3 flex flex-col gap-1">

            {/* Controls row */}
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <LanguageSwitcher />
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800 mx-1 mb-1" />

            {user ? (
              <>
                <Link href={`/${locale}/dashboard`} className={mobileNavLinkClass('dashboard')} onClick={closeMenu}>
                  <HomeIcon className="w-4 h-4 shrink-0" />
                  {t('dashboard')}
                </Link>
                <Link href={`/${locale}/notes/new`} className={mobileNavLinkClass('notes/new')} onClick={closeMenu}>
                  <PlusIcon className="w-4 h-4 shrink-0" />
                  {t('newNote')}
                </Link>
                <Link href={`/${locale}/tasks`} className={mobileNavLinkClass('tasks')} onClick={closeMenu}>
                  <CheckSquareIcon className="w-4 h-4 shrink-0" />
                  {t('tasks')}
                </Link>
                <Link href={`/${locale}/calendar`} className={mobileNavLinkClass('calendar')} onClick={closeMenu}>
                  <CalendarIcon className="w-4 h-4 shrink-0" />
                  {t('calendar')}
                </Link>
                <Link href={`/${locale}/settings`} className={mobileNavLinkClass('settings')} onClick={closeMenu}>
                  <CogIcon className="w-4 h-4 shrink-0" />
                  {t('settings')}
                </Link>

                <div className="h-px bg-gray-100 dark:bg-gray-800 mx-1 my-1" />

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <UserIcon className="w-4 h-4" />
                    {user.username}
                  </span>
                  <button
                    onClick={() => { logout(); closeMenu(); }}
                    className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 font-medium"
                  >
                    <LogoutIcon className="w-4 h-4" />
                    {t('logout')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href={`/${locale}/login`} className={mobileNavLinkClass('login')} onClick={closeMenu}>Login</Link>
                <Link href={`/${locale}/register`} className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400" onClick={closeMenu}>Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
