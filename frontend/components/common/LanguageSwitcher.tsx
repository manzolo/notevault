'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    // Replace the current locale prefix with the new one
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchLocale('en')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          locale === 'en'
            ? 'bg-blue-600 text-white'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        EN
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => switchLocale('it')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          locale === 'it'
            ? 'bg-blue-600 text-white'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        IT
      </button>
    </div>
  );
}
