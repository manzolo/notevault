'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bookmark, VirtualBookmark } from '@/lib/types';
import BookmarkItem from './BookmarkItem';
import VirtualBookmarkItem from './VirtualBookmarkItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { ArchiveIcon, RestoreIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
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
  onArchive: (id: number, note?: string) => Promise<void>;
  onRestore: (id: number) => Promise<Bookmark>;
  fetchArchivedBookmarks: () => Promise<Bookmark[]>;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  virtualBookmarks?: VirtualBookmark[];
}

export default function BookmarkList({
  bookmarks, loading, onEdit, onDelete, onArchive, onRestore, fetchArchivedBookmarks,
  onReorder, setBookmarks, virtualBookmarks,
}: Props) {
  const t = useTranslations('bookmarks');
  const tc = useTranslations('common');
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [archivedBookmarks, setArchivedBookmarks] = useState<Bookmark[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

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
      setBookmarks(bookmarks);
    }
  };

  const handleToggleArchived = async () => {
    if (!showArchived && archivedBookmarks.length === 0) {
      setArchivedLoading(true);
      try {
        const items = await fetchArchivedBookmarks();
        setArchivedBookmarks(items);
      } finally {
        setArchivedLoading(false);
      }
    }
    setShowArchived((v) => !v);
  };

  const handleRestoreArchived = async (id: number) => {
    const ok = await confirm(tc('restoreConfirm'), { confirmLabel: tc('restore'), confirmVariant: 'secondary' });
    if (!ok) return;
    await onRestore(id);
    setArchivedBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleDeleteArchived = async (id: number) => {
    const ok = await confirm(tc('deleteConfirm'));
    if (!ok) return;
    await onDelete(id);
    setArchivedBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {confirmDialog}

      {bookmarks.length === 0 && !virtualBookmarks?.length && (
        <p className="text-sm text-gray-500 text-center py-4">{t('noBookmarks')}</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={bookmarks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div>
            {bookmarks.map((bm) => (
              <BookmarkItem
                key={`${bm.id}-${bm.updated_at}`}
                bookmark={bm}
                onEdit={onEdit}
                onDelete={onDelete}
                onArchive={async (id, note) => {
                  await onArchive(id, note);
                  if (showArchived) setArchivedBookmarks((prev) => [...prev, { ...bm, is_archived: true, archive_note: note || null }]);
                }}
              />
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

      {/* Archived section */}
      <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
        <button
          type="button"
          onClick={handleToggleArchived}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArchiveIcon className="h-3.5 w-3.5" />
          <span>{tc('archivedCount', { count: archivedBookmarks.length || '…' })}</span>
          <span className="ml-0.5">{showArchived ? '▲' : '▼'}</span>
        </button>

        {showArchived && (
          <div className="mt-2 space-y-1">
            {archivedLoading && <LoadingSpinner size="sm" />}
            {!archivedLoading && archivedBookmarks.length === 0 && (
              <p className="text-xs text-gray-400 py-1">{t('noBookmarks')}</p>
            )}
            {archivedBookmarks.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 opacity-70 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 truncate">{b.title || b.url}</p>
                  {b.archive_note && <p className="text-xs text-gray-400 italic truncate">{b.archive_note}</p>}
                </div>
                <button
                  type="button"
                  title={tc('restore')}
                  onClick={() => handleRestoreArchived(b.id)}
                  className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                  <RestoreIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={tc('deleteForever')}
                  onClick={() => handleDeleteArchived(b.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
