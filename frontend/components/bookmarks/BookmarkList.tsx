'use client';

import { useTranslations } from 'next-intl';
import { Bookmark } from '@/lib/types';
import BookmarkItem from './BookmarkItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface Props {
  bookmarks: Bookmark[];
  loading: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: number) => void;
}

export default function BookmarkList({ bookmarks, loading, onEdit, onDelete }: Props) {
  const t = useTranslations('bookmarks');

  if (loading) return <LoadingSpinner />;

  if (bookmarks.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">{t('noBookmarks')}</p>;
  }

  return (
    <div>
      {bookmarks.map((bm) => (
        <BookmarkItem key={bm.id} bookmark={bm} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
