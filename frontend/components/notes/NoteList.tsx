'use client';

'use client';

import { useTranslations } from 'next-intl';
import { Category, MatchingAttachment, MatchingBookmark, Note } from '@/lib/types';
import NoteCard from './NoteCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface MatchInfo {
  attachment: boolean;
  bookmark: boolean;
}

interface NoteListProps {
  notes: Note[];
  loading: boolean;
  onDelete: (id: number) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onArchive?: (id: number, archived: boolean) => void;
  categories?: Category[];
  filterActive?: boolean;
  matchMap?: Map<number, MatchInfo>;
  matchingAttachmentsMap?: Map<number, MatchingAttachment[]>;
  matchingBookmarksMap?: Map<number, MatchingBookmark[]>;
  onPreviewAttachment?: (noteId: number, attachment: MatchingAttachment) => void;
}

function findCategoryName(cats: Category[], id: number): string | undefined {
  for (const cat of cats) {
    if (cat.id === id) return cat.name;
    const found = findCategoryName(cat.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

export default function NoteList({ notes, loading, onDelete, onPin, onArchive, categories, filterActive, matchMap, matchingAttachmentsMap, matchingBookmarksMap, onPreviewAttachment }: NoteListProps) {
  const t = useTranslations('notes');

  if (loading) return <LoadingSpinner className="py-12" />;
  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">{filterActive ? t('noNotesInFolder') : t('noNotes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const match = matchMap?.get(note.id);
        const categoryName = (categories && note.category_id)
          ? findCategoryName(categories, note.category_id)
          : undefined;
        return (
          <NoteCard
            key={note.id}
            note={note}
            onDelete={onDelete}
            onPin={onPin}
            onArchive={onArchive}
            categoryName={categoryName}
            matchInAttachment={match?.attachment ?? false}
            matchInBookmark={match?.bookmark ?? false}
            matchingAttachments={matchingAttachmentsMap?.get(note.id)}
            matchingBookmarks={matchingBookmarksMap?.get(note.id)}
            onPreviewAttachment={onPreviewAttachment}
          />
        );
      })}
    </div>
  );
}
