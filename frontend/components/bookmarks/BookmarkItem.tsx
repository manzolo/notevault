'use client';

import { useTranslations } from 'next-intl';
import { Bookmark } from '@/lib/types';
import Button from '@/components/common/Button';
import { PencilIcon, TrashIcon } from '@/components/common/Icons';

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

export default function BookmarkItem({ bookmark, onEdit, onDelete }: Props) {
  const t = useTranslations('bookmarks');

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <GlobeIcon />

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
        {bookmark.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {bookmark.tags.map((tag) => (
              <span key={tag.id} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-1.5 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 shrink-0">
        <Button size="sm" variant="secondary" onClick={() => onEdit(bookmark)}>
          <PencilIcon />
          {t('edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost-danger"
          title={t('delete')}
          onClick={() => { if (confirm(t('deleteConfirm'))) onDelete(bookmark.id); }}
        >
          <TrashIcon />
        </Button>
      </div>
    </div>
  );
}
