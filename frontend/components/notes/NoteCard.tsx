'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Note } from '@/lib/types';
import { formatRelative, truncate } from '@/lib/utils';
import Button from '@/components/common/Button';

interface NoteCardProps {
  note: Note;
  onDelete: (id: number) => void;
  matchInAttachment?: boolean;
}

function PaperclipIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

export default function NoteCard({ note, onDelete, matchInAttachment }: NoteCardProps) {
  const locale = useLocale();
  const t = useTranslations('notes');
  const tSearch = useTranslations('search');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {note.is_pinned && (
              <span className="text-blue-600 text-xs font-medium">📌 {t('pinned')}</span>
            )}
            <Link
              href={`/${locale}/notes/${note.id}`}
              className="text-gray-900 dark:text-gray-100 font-semibold hover:text-blue-600 truncate block"
            >
              {note.title}
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{truncate(note.content, 120)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {note.tags.map((tag) => (
              <span key={tag.id} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
            <span className="text-xs text-gray-400">{formatRelative(note.updated_at)}</span>
          </div>
          {matchInAttachment && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <PaperclipIcon />
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                {tSearch('foundInAttachment')}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(t('deleteConfirm'))) onDelete(note.id);
          }}
        >
          {t('delete')}
        </Button>
      </div>
    </div>
  );
}
