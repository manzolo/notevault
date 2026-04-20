'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from './ThemeProvider';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import {
  HomeIcon,
  PlusIcon,
  CheckSquareIcon,
  CalendarIcon,
  BookOpenIcon,
  CogIcon,
  UserIcon,
  LogoutIcon,
} from './Icons';
import { useNotes } from '@/hooks/useNotes';

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
  const router = useRouter();
  const { user, logout } = useAuth();
  const { createDailyNote } = useNotes();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalLoading, setJournalLoading] = useState(false);

  const handleNewNote = (onNavigate?: () => void) => {
    const catId = typeof window !== 'undefined' ? sessionStorage.getItem('dashboard_categoryId') : null;
    const href = catId && catId !== 'null'
      ? `/${locale}/notes/new?category_id=${catId}`
      : `/${locale}/notes/new`;
    onNavigate?.();
    router.push(href);
  };

  const closeMenu = () => setMenuOpen(false);

  const handleTodayNote = async (onNavigate?: () => void) => {
    setJournalLoading(true);
    try {
      const daily = await createDailyNote(undefined, locale);
      onNavigate?.();
      router.push(`/${locale}/notes/${daily.note_id}`);
    } finally {
      setJournalLoading(false);
    }
  };

  const isActive = (segment: string) => pathname.includes(`/${segment}`);

  const active = 'text-violet-700 dark:text-violet-300 font-semibold bg-violet-50 dark:bg-violet-500/10';

  const navLinkClass = (segment: string, mobile = false) =>
    mobile
      ? `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive(segment) ? active : 'text-gray-600 dark:text-vault-200 hover:bg-cream-200/70 dark:hover:bg-vault-700/50'}`
      : `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-150 ${isActive(segment) ? active : 'text-gray-500 dark:text-vault-300 hover:text-gray-900 dark:hover:text-vault-50 hover:bg-cream-200/70 dark:hover:bg-vault-700/50'}`;

  return (
    <>
      <nav className="bg-cream-50/95 dark:bg-vault-900/95 backdrop-blur-md border-b border-cream-300/70 dark:border-vault-700/60 shadow-nav sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between h-14 gap-4">

            {/* Logo */}
            <Link
              href={`/${locale}/dashboard`}
              className="font-display italic text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-500 dark:from-violet-300 dark:to-indigo-300 bg-clip-text text-transparent shrink-0 tracking-tight"
              onClick={closeMenu}
            >
              {t('brand')}
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-end">

              {/* Controls: theme + language + notifications */}
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-md text-gray-400 dark:text-vault-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-cream-200/70 dark:hover:bg-vault-700/50 transition-all duration-150"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                <LanguageSwitcher />
                {user && <NotificationBell />}
              </div>

              {/* Separator */}
              <div className="w-px h-5 bg-cream-300 dark:bg-vault-600 mx-1" />

              {/* Nav links */}
              {user && (
                <>
                  <Link href={`/${locale}/dashboard`} className={navLinkClass('dashboard')}>
                    <HomeIcon className="w-3.5 h-3.5" />
                    {t('dashboard')}
                  </Link>
                  <button type="button" onClick={() => handleNewNote()} className={navLinkClass('notes/new')}>
                    <PlusIcon className="w-3.5 h-3.5" />
                    {t('newNote')}
                  </button>
                  <button type="button" onClick={() => handleTodayNote()} className={navLinkClass('notes')}>
                    <BookOpenIcon className="w-3.5 h-3.5" />
                    {t('todayNote')}
                  </button>
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
                  <div className="w-px h-5 bg-cream-300 dark:bg-vault-600 mx-1" />

                  {/* User + logout */}
                  <div className="flex items-center gap-1">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-vault-300 bg-cream-200/80 dark:bg-vault-700/60 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap border border-cream-300/60 dark:border-vault-600/60">
                      <UserIcon className="w-3.5 h-3.5" />
                      {user.username}
                    </span>
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md text-gray-400 dark:text-vault-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150 font-medium"
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

            {/* Mobile: notification bell + hamburger always visible */}
            <div className="md:hidden flex items-center gap-1">
              {user && <NotificationBell />}
              <button
                className="p-1.5 rounded-md text-gray-500 dark:text-vault-300 hover:bg-cream-200/70 dark:hover:bg-vault-700/50 transition-all duration-150"
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Toggle menu"
              >
                {menuOpen ? <XIcon /> : <HamburgerIcon />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 bg-cream-50 dark:bg-vault-900 border-b border-cream-300/70 dark:border-vault-700/60 shadow-lg z-[60] overflow-y-auto max-h-[calc(100vh-56px)]">
          <div className="px-3 py-3 flex flex-col gap-1">

            {/* Controls row */}
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-gray-400 dark:text-vault-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-cream-200/70 dark:hover:bg-vault-700/50 transition-all duration-150"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <LanguageSwitcher />
            </div>

            <div className="h-px bg-cream-200 dark:bg-vault-700/60 mx-1 mb-1" />

            {user ? (
              <>
                <Link href={`/${locale}/dashboard`} className={navLinkClass('dashboard', true)} onClick={closeMenu}>
                  <HomeIcon className="w-4 h-4 shrink-0" />
                  {t('dashboard')}
                </Link>
                <button type="button" onClick={() => handleNewNote(closeMenu)} className={navLinkClass('notes/new', true)}>
                  <PlusIcon className="w-4 h-4 shrink-0" />
                  {t('newNote')}
                </button>
                <button type="button" onClick={() => handleTodayNote(closeMenu)} className={navLinkClass('notes', true)} disabled={journalLoading}>
                  <BookOpenIcon className="w-4 h-4 shrink-0" />
                  {t('todayNote')}
                </button>
                <Link href={`/${locale}/tasks`} className={navLinkClass('tasks', true)} onClick={closeMenu}>
                  <CheckSquareIcon className="w-4 h-4 shrink-0" />
                  {t('tasks')}
                </Link>
                <Link href={`/${locale}/calendar`} className={navLinkClass('calendar', true)} onClick={closeMenu}>
                  <CalendarIcon className="w-4 h-4 shrink-0" />
                  {t('calendar')}
                </Link>
                <Link href={`/${locale}/settings`} className={navLinkClass('settings', true)} onClick={closeMenu}>
                  <CogIcon className="w-4 h-4 shrink-0" />
                  {t('settings')}
                </Link>

                <div className="h-px bg-cream-200 dark:bg-vault-700/60 mx-1 my-1" />

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-vault-300">
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
                <Link href={`/${locale}/login`} className={navLinkClass('login', true)} onClick={closeMenu}>Login</Link>
                <Link href={`/${locale}/register`} className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400" onClick={closeMenu}>Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
