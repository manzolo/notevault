'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Bookmark } from '@/lib/types';
import Button from '@/components/common/Button';
import { PencilIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';
import { useServerConfig } from '@/hooks/useServerConfig';
import { getCached, setCached } from '@/lib/faviconCache';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: number) => void;
}

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

function DragHandle(props: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 shrink-0 select-none px-0.5"
      title="Drag to reorder"
    >
      ⠿
    </span>
  );
}

export default function BookmarkItem({ bookmark, onEdit, onDelete }: Props) {
  const t = useTranslations('bookmarks');
  const { confirm, dialog } = useConfirm();
  const { favicon_fetch_enabled } = useServerConfig();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bookmark.id });

  const favicon = getFaviconUrl(bookmark.url);
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

  const handleDelete = async () => {
    if (await confirm(t('deleteConfirm'))) onDelete(bookmark.id);
  };

  return (
    <>
      {dialog}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
      >
        <DragHandle {...attributes} {...listeners} />

        {showFavicon && !skipImg ? (
          <img
            src={favicon.faviconUrl}
            alt=""
            width={20}
            height={20}
            className="w-5 h-5 rounded-sm shrink-0 mt-0.5"
            onLoad={() => setCached(favicon.domain, true)}
            onError={() => {
              setCached(favicon.domain, false);
              setImgError(true);
            }}
          />
        ) : (
          <GlobeIcon />
        )}

        <div className="flex-1 min-w-0">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
          >
            {bookmark.title || bookmark.url}
          </a>
          {bookmark.title && (
            <p className="text-xs text-gray-400 truncate">{bookmark.url}</p>
          )}
          {bookmark.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{bookmark.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {bookmark.tags.map((tag) => (
              <span key={tag.id} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-1.5 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
            <DateInfoTooltip createdAt={bookmark.created_at} updatedAt={bookmark.updated_at} />
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="secondary" onClick={() => onEdit(bookmark)}>
            <PencilIcon />
            <span className="hidden sm:inline">{t('edit')}</span>
          </Button>
          <Button size="sm" variant="ghost-danger" title={t('delete')} onClick={handleDelete}>
            <TrashIcon />
          </Button>
        </div>
      </div>
    </>
  );
}
