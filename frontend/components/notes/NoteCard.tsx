'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Note } from '@/lib/types';
import { formatRelative, truncate } from '@/lib/utils';
import Button from '@/components/common/Button';

interface NoteCardProps {
  note: Note;
  onDelete: (id: number) => void;
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const locale = useLocale();
  const t = useTranslations('notes');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {note.is_pinned && (
              <span className="text-blue-600 text-xs font-medium">📌 {t('pinned')}</span>
            )}
            <Link
              href={`/${locale}/notes/${note.id}`}
              className="text-gray-900 font-semibold hover:text-blue-600 truncate block"
            >
              {note.title}
            </Link>
          </div>
          <p className="text-sm text-gray-500 mb-2">{truncate(note.content, 120)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {note.tags.map((tag) => (
              <span key={tag.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
            <span className="text-xs text-gray-400">{formatRelative(note.updated_at)}</span>
          </div>
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
