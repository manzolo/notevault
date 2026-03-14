'use client';

import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import SecretViewer from './SecretViewer';
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

interface SecretListProps {
  secrets: Secret[];
  revealedSecrets: Map<number, SecretReveal>;
  countdown: Map<number, number>;
  loading: boolean;
  onReveal: (id: number) => void;
  onHide: (id: number) => void;
  onDelete: (id: number) => void;
  onCopyDirect?: (id: number) => Promise<void>;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setSecrets: (secrets: Secret[]) => void;
}

export default function SecretList({
  secrets, revealedSecrets, countdown, loading, onReveal, onHide, onDelete, onCopyDirect, onReorder, setSecrets,
}: SecretListProps) {
  const t = useTranslations('secrets');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = secrets.findIndex((s) => s.id === active.id);
    const newIndex = secrets.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(secrets, oldIndex, newIndex);
    setSecrets(reordered);

    try {
      await onReorder(reordered.map((item, idx) => ({ id: item.id, position: idx })));
    } catch {
      setSecrets(secrets);
    }
  };

  if (loading) return <LoadingSpinner size="sm" />;
  if (secrets.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('noSecrets')}</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={secrets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {secrets.map((secret) => (
            <SecretViewer
              key={secret.id}
              secret={secret}
              revealed={revealedSecrets.get(secret.id)}
              countdownSeconds={countdown.get(secret.id)}
              onReveal={() => onReveal(secret.id)}
              onHide={() => onHide(secret.id)}
              onDelete={() => onDelete(secret.id)}
              onCopyDirect={onCopyDirect ? () => onCopyDirect(secret.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
