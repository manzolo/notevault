'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { VirtualBookmark } from '@/lib/types';
import { LockClosedIcon, CalendarIcon } from '@/components/common/Icons';
import { useServerConfig } from '@/hooks/useServerConfig';
import { getCached, setCached } from '@/lib/faviconCache';

function GlobeIcon() {
  return (
    <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function getFaviconUrl(url: string): { domain: string; faviconUrl: string } | null {
  try {
    const origin = new URL(url).origin;
    return { domain: origin, faviconUrl: `${origin}/favicon.ico` };
  } catch {
    return null;
  }
}

interface Props {
  vbm: VirtualBookmark;
}

export default function VirtualBookmarkItem({ vbm }: Props) {
  const t = useTranslations('bookmarks');
  const { favicon_fetch_enabled } = useServerConfig();

  const favicon = getFaviconUrl(vbm.url);
  const cached = favicon ? getCached(favicon.domain) : null;
  const [imgError, setImgError] = useState<boolean>(
    cached !== null ? !cached.ok : false
  );

  const showFavicon = favicon_fetch_enabled && favicon !== null && !imgError;
  const skipImg = cached?.ok === false;

  useEffect(() => {
    if (favicon && cached !== null) {
      setImgError(!cached.ok);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favicon?.domain]);

  const badgeClass =
    vbm.source === 'secret'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';

  const badgeLabel = vbm.source === 'secret' ? t('sourceSecret') : t('sourceEvent');
  const BadgeIcon = vbm.source === 'secret' ? LockClosedIcon : CalendarIcon;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      {/* Source badge instead of drag handle */}
      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${badgeClass}`}>
        <BadgeIcon className="w-3 h-3" />
        {badgeLabel}
      </span>

      {showFavicon && !skipImg ? (
        <img
          src={favicon!.faviconUrl}
          alt=""
          width={20}
          height={20}
          className="w-5 h-5 rounded-sm shrink-0 mt-0.5"
          onLoad={() => setCached(favicon!.domain, true)}
          onError={() => {
            setCached(favicon!.domain, false);
            setImgError(true);
          }}
        />
      ) : (
        <GlobeIcon />
      )}

      <div className="flex-1 min-w-0">
        <a
          href={vbm.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
        >
          {vbm.sourceName}
        </a>
        <p className="text-xs text-gray-400 truncate">{vbm.url}</p>
        {vbm.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{vbm.description}</p>
        )}
      </div>
    </div>
  );
}
