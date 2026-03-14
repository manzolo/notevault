'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Attachment } from '@/lib/types';
import AttachmentItem from './AttachmentItem';
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
import { MimeCategory, CATEGORY_ORDER, groupAttachments } from '@/lib/attachmentUtils';

const COLLAPSE_THRESHOLD = 3;

interface Props {
  attachments: Attachment[];
  loading: boolean;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
  onEdit: (attachment: Attachment) => void;
  emlAttachmentsMap?: Record<number, number>;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setAttachments: (attachments: Attachment[]) => void;
}

export default function AttachmentGroupedList({
  attachments, loading, onPreview, onDownload, onDelete, onEdit, emlAttachmentsMap, onReorder, setAttachments,
}: Props) {
  const t = useTranslations('attachments');
  const [expanded, setExpanded] = useState<Set<MimeCategory>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent, category: MimeCategory, groups: Map<MimeCategory, Attachment[]>) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupItems = groups.get(category) ?? [];
    const oldIndex = groupItems.findIndex((a) => a.id === active.id);
    const newIndex = groupItems.findIndex((a) => a.id === over.id);
    const reorderedGroup = arrayMove(groupItems, oldIndex, newIndex);

    // Build new full attachment list preserving category order
    const newGroups = new Map(groups);
    newGroups.set(category, reorderedGroup);
    const newAttachments: Attachment[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = newGroups.get(cat);
      if (items) newAttachments.push(...items);
    }

    setAttachments(newAttachments);

    try {
      await onReorder(newAttachments.map((item, idx) => ({ id: item.id, position: idx })));
    } catch {
      setAttachments(attachments);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (attachments.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">{t('noAttachments')}</p>;
  }

  const groups = groupAttachments(attachments);
  const hasMultipleGroups = groups.size > 1;

  const toggleExpand = (cat: MimeCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => {
        const items = groups.get(cat)!;
        const isExpanded = expanded.has(cat);
        const hasMore = items.length > COLLAPSE_THRESHOLD;

        return (
          <div key={cat} className="group">
            {hasMultipleGroups && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t(`category_${cat}` as any)}
                </span>
                <span className="text-xs text-gray-300 dark:text-gray-600">({items.length})</span>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, cat, groups)}
            >
              <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                {/* First COLLAPSE_THRESHOLD items always visible */}
                {items.slice(0, COLLAPSE_THRESHOLD).map((att) => (
                  <AttachmentItem
                    key={att.id}
                    attachment={att}
                    onPreview={onPreview}
                    onDownload={onDownload}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
                  />
                ))}

                {/* Extra items: hover-expand (CSS) or permanently expanded */}
                {hasMore && (
                  <>
                    {isExpanded ? (
                      items.slice(COLLAPSE_THRESHOLD).map((att) => (
                        <AttachmentItem
                          key={att.id}
                          attachment={att}
                          onPreview={onPreview}
                          onDownload={onDownload}
                          onDelete={onDelete}
                          onEdit={onEdit}
                          emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
                        />
                      ))
                    ) : (
                      <div className="max-h-0 overflow-hidden group-hover:max-h-[9999px] transition-[max-height] duration-500 ease-in-out">
                        {items.slice(COLLAPSE_THRESHOLD).map((att) => (
                          <AttachmentItem
                            key={att.id}
                            attachment={att}
                            onPreview={onPreview}
                            onDownload={onDownload}
                            onDelete={onDelete}
                            onEdit={onEdit}
                            emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
                          />
                        ))}
                      </div>
                    )}

                    {!isExpanded && (
                      <button
                        onClick={() => toggleExpand(cat)}
                        className="group-hover:opacity-0 mt-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-opacity duration-200"
                      >
                        + {t('xMore', { count: items.length - COLLAPSE_THRESHOLD })}
                      </button>
                    )}
                  </>
                )}
              </SortableContext>
            </DndContext>
          </div>
        );
      })}
    </div>
  );
}
