'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import SecretViewer from './SecretViewer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { ArchiveIcon, ChevronDownIcon, RestoreIcon, TrashIcon } from '@/components/common/Icons';
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

interface SecretListProps {
  secrets: Secret[];
  revealedSecrets: Map<number, SecretReveal>;
  countdown: Map<number, number>;
  loading: boolean;
  onReveal: (id: number) => void;
  onHide: (id: number) => void;
  onDelete: (id: number) => void;
  onArchive: (id: number, note?: string) => Promise<void>;
  onRestore: (id: number) => Promise<void>;
  onCopyDirect?: (id: number) => Promise<void>;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  fetchArchivedSecrets: () => Promise<Secret[]>;
  setSecrets: (secrets: Secret[]) => void;
  onArchivedCountChange?: (count: number) => void;
}

export default function SecretList({
  secrets, revealedSecrets, countdown, loading, onReveal, onHide, onDelete, onArchive, onRestore,
  onCopyDirect, onReorder, fetchArchivedSecrets, setSecrets, onArchivedCountChange,
}: SecretListProps) {
  const t = useTranslations('secrets');
  const tc = useTranslations('common');
  const { confirm, confirmInput, dialog: confirmDialog } = useConfirm();
  const [archivedSecrets, setArchivedSecrets] = useState<Secret[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const setArchivedSecretsAndNotify = (items: Secret[]) => {
    setArchivedSecrets(items);
    onArchivedCountChange?.(items.length);
  };

  useEffect(() => {
    fetchArchivedSecrets().then(setArchivedSecretsAndNotify).catch(() => onArchivedCountChange?.(0));
  }, []);

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

  const handleToggleArchived = () => setShowArchived((v) => !v);

  const handleRestoreArchived = async (id: number) => {
    const ok = await confirm(tc('restoreConfirm'), { confirmLabel: tc('restore'), confirmVariant: 'secondary' });
    if (!ok) return;
    await onRestore(id);
    setArchivedSecretsAndNotify(archivedSecrets.filter((s) => s.id !== id));
  };

  const handleDeleteArchived = async (id: number) => {
    const ok = await confirm(tc('deleteConfirm'));
    if (!ok) return;
    await onDelete(id);
    setArchivedSecretsAndNotify(archivedSecrets.filter((s) => s.id !== id));
  };

  if (loading) return <LoadingSpinner size="sm" />;

  return (
    <>
      {confirmDialog}
      {secrets.length === 0 && archivedSecrets.length === 0 && !showArchived && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noSecrets')}</p>
      )}

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
                onArchive={async (note) => {
                  await onArchive(secret.id, note);
                  setArchivedSecretsAndNotify([...archivedSecrets, { ...secret, is_archived: true, archive_note: note || null }]);
                }}
                onCopyDirect={onCopyDirect ? () => onCopyDirect(secret.id) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Archived section */}
      {archivedSecrets.length > 0 && <div className="mt-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          <button
            type="button"
            onClick={handleToggleArchived}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
          >
            <ArchiveIcon className="h-3 w-3" />
            <span>{tc('archivedCount', { count: archivedSecrets.length })}</span>
            <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        </div>

        {showArchived && (
          <div className="mt-2 space-y-1">
            {archivedLoading && <LoadingSpinner size="sm" />}
            {!archivedLoading && archivedSecrets.length === 0 && (
              <p className="text-xs text-gray-400 py-1">{t('noSecrets')}</p>
            )}
            {archivedSecrets.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 opacity-70 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.name}</p>
                  {s.archive_note && <p className="text-xs text-gray-400 italic truncate">{s.archive_note}</p>}
                </div>
                <button
                  type="button"
                  title={tc('restore')}
                  onClick={() => handleRestoreArchived(s.id)}
                  className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                  <RestoreIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={tc('deleteForever')}
                  onClick={() => handleDeleteArchived(s.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}
    </>
  );
}
