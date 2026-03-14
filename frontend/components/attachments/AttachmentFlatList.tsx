'use client';

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

export default function AttachmentFlatList({
  attachments, loading, onPreview, onDownload, onDelete, onEdit, emlAttachmentsMap, onReorder, setAttachments,
}: Props) {
  const t = useTranslations('attachments');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = attachments.findIndex((a) => a.id === active.id);
    const newIndex = attachments.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(attachments, oldIndex, newIndex);
    setAttachments(reordered);

    try {
      await onReorder(reordered.map((item, idx) => ({ id: item.id, position: idx })));
    } catch {
      setAttachments(attachments);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (attachments.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">{t('noAttachments')}</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={attachments.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div>
          {attachments.map((att) => (
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
      </SortableContext>
    </DndContext>
  );
}
