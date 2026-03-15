'use client';

import { useTranslations } from 'next-intl';
import { Bookmark, VirtualBookmark } from '@/lib/types';
import BookmarkItem from './BookmarkItem';
import VirtualBookmarkItem from './VirtualBookmarkItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

interface Props {
  bookmarks: Bookmark[];
  loading: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: number) => void;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  virtualBookmarks?: VirtualBookmark[];
}

export default function BookmarkList({ bookmarks, loading, onEdit, onDelete, onReorder, setBookmarks, virtualBookmarks }: Props) {
  const t = useTranslations('bookmarks');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = bookmarks.findIndex((b) => b.id === active.id);
    const newIndex = bookmarks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(bookmarks, oldIndex, newIndex);
    setBookmarks(reordered);

    try {
      await onReorder(reordered.map((item, idx) => ({ id: item.id, position: idx })));
    } catch {
      // revert on error
      setBookmarks(bookmarks);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (bookmarks.length === 0 && !virtualBookmarks?.length) {
    return <p className="text-sm text-gray-500 text-center py-4">{t('noBookmarks')}</p>;
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={bookmarks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div>
            {bookmarks.map((bm) => (
              <BookmarkItem key={`${bm.id}-${bm.updated_at}`} bookmark={bm} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {virtualBookmarks && virtualBookmarks.length > 0 && (
        <div>
          {virtualBookmarks.map((vbm) => (
            <VirtualBookmarkItem key={vbm.virtualKey} vbm={vbm} />
          ))}
        </div>
      )}
    </>
  );
}
