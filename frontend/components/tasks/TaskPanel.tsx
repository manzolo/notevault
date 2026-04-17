'use client';

import { useRef, useState, KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Task } from '@/lib/types';
import { ArchiveIcon, BellIcon, RestoreIcon, TrashIcon } from '@/components/common/Icons';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import DateTimePicker from '@/components/common/DateTimePicker';
import { useConfirm } from '@/hooks/useConfirm';
import TaskRemindersSection, { TaskRemindersSectionHandle } from '@/components/tasks/TaskRemindersSection';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskPanelProps {
  tasks: Task[];
  loading: boolean;
  onCreate: (title: string, dueDate?: string) => Promise<void>;
  onToggle: (id: number, isDone: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, data: Partial<Task>) => Promise<void>;
  onArchive: (id: number, note?: string) => Promise<void>;
  onRestore: (id: number) => Promise<Task>;
  fetchArchivedTasks: () => Promise<Task[]>;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setTasks: (tasks: Task[]) => void;
}

export default function TaskPanel({
  tasks, loading, onCreate, onToggle, onDelete, onUpdate, onArchive, onRestore, fetchArchivedTasks, onReorder, setTasks,
}: TaskPanelProps) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await onCreate(title, newDueDate ?? undefined);
      setNewTitle('');
      setNewDueDate(null);
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const todo = tasks.filter((t) => !t.is_done);
    const done = tasks.filter((t) => t.is_done);

    const oldIndex = todo.findIndex((t) => t.id === active.id);
    if (oldIndex === -1) return;
    const newIndex = todo.findIndex((t) => t.id === over.id);
    if (newIndex === -1) return;

    const reorderedTodo = arrayMove(todo, oldIndex, newIndex);
    const newTasks = [...reorderedTodo, ...done];
    setTasks(newTasks);

    try {
      await onReorder(reorderedTodo.map((item, idx) => ({ id: item.id, position: idx })));
    } catch {
      setTasks(tasks);
    }
  };

  const handleToggleArchived = async () => {
    if (!showArchived && archivedTasks.length === 0) {
      setArchivedLoading(true);
      try {
        const items = await fetchArchivedTasks();
        setArchivedTasks(items);
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
    setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDeleteArchived = async (id: number) => {
    const ok = await confirm(tc('deleteConfirm'));
    if (!ok) return;
    await onDelete(id);
    setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  if (loading) return <LoadingSpinner size="sm" />;

  const todo = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  return (
    <>
    {confirmDialog}
    <div className="space-y-2">
      {tasks.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-1">{t('noTasks')}</p>
      )}

      {/* Todo tasks — sortable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={todo.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {todo.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}
              onArchive={async (note) => {
                await onArchive(task.id, note);
                if (showArchived) setArchivedTasks((prev) => [...prev, { ...task, is_archived: true, archive_note: note || null }]);
              }} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Done tasks — not sortable */}
      {done.length > 0 && (
        <div className="pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 pt-2">{t('done')} ({done.length})</p>
          {done.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}
              onArchive={async (note) => {
                await onArchive(task.id, note);
                if (showArchived) setArchivedTasks((prev) => [...prev, { ...task, is_archived: true, archive_note: note || null }]);
              }} />
          ))}
        </div>
      )}

      {/* Add task input */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('addPlaceholder')}
          className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 placeholder-gray-300 dark:placeholder-gray-600 transition-colors"
        />
        <DateTimePicker
          value={newDueDate}
          onChange={setNewDueDate}
          placeholder={t('dueDate')}
          triggerClassName="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors px-1.5 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/40"
        />
        {newTitle.trim() && (
          <Button variant="ghost" size="sm" onClick={handleAdd} loading={adding}>
            {t('add')}
          </Button>
        )}
      </div>

      {/* Archived section */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
        <button
          type="button"
          onClick={handleToggleArchived}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArchiveIcon className="h-3.5 w-3.5" />
          <span>{tc('archivedCount', { count: archivedTasks.length || '…' })}</span>
          <span className="ml-0.5">{showArchived ? '▲' : '▼'}</span>
        </button>

        {showArchived && (
          <div className="mt-2 space-y-1">
            {archivedLoading && <LoadingSpinner size="sm" />}
            {!archivedLoading && archivedTasks.length === 0 && (
              <p className="text-xs text-gray-400 py-1">{t('noTasks')}</p>
            )}
            {archivedTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 opacity-70 group">
                <span className={`flex-1 text-sm ${task.is_done ? 'line-through text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {task.title}
                </span>
                {task.archive_note && (
                  <span className="text-xs text-gray-400 italic truncate max-w-[120px]" title={task.archive_note}>
                    {task.archive_note}
                  </span>
                )}
                <button
                  type="button"
                  title={tc('restore')}
                  onClick={() => handleRestoreArchived(task.id)}
                  className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                  <RestoreIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={tc('deleteForever')}
                  onClick={() => handleDeleteArchived(task.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function TaskRow({ task, onToggle, onDelete, onUpdate, onArchive }: {
  task: Task;
  onToggle: (id: number, isDone: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, data: Partial<Task>) => Promise<void>;
  onArchive?: (note?: string) => void;
}) {
  const tc = useTranslations('common');
  const t = useTranslations('tasks');
  const { confirmInput, dialog: archiveDialog } = useConfirm();
  const [toggling, setToggling] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const reminderRef = useRef<TaskRemindersSectionHandle>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(task.id, !task.is_done); }
    finally { setToggling(false); }
  };

  const handleDateChange = async (iso: string | null) => {
    await onUpdate(task.id, { due_date: iso });
  };

  const isPastDue = task.due_date && !task.is_done && new Date(task.due_date) < new Date();

  const handleArchive = async () => {
    if (!onArchive) return;
    const { confirmed, value } = await confirmInput(tc('archiveConfirm'), {
      confirmLabel: tc('archive'),
      confirmVariant: 'secondary',
      inputLabel: tc('archiveReason'),
    });
    if (confirmed) onArchive(value || undefined);
  };

  return (
    <>
    {archiveDialog}
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 group py-0.5"
    >
      {!task.is_done && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 shrink-0 select-none px-0.5"
          title="Drag to reorder"
        >
          ⠿
        </span>
      )}
      <input
        type="checkbox"
        checked={task.is_done}
        onChange={handleToggle}
        disabled={toggling}
        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-indigo-500 cursor-pointer flex-shrink-0"
      />
      <span className={`flex-1 text-sm ${task.is_done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
        {task.title}
      </span>

      {/* Due date */}
      <DateTimePicker
        value={task.due_date ?? null}
        onChange={handleDateChange}
        placeholder={t('setDueDate')}
        iconOnly={!task.due_date}
        disabled={task.is_done}
        triggerClassName={
          task.due_date
            ? `text-xs whitespace-nowrap transition-colors disabled:cursor-default ${isPastDue ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400'}`
            : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-400 dark:text-gray-600 dark:hover:text-indigo-400 transition-opacity disabled:cursor-default'
        }
      />

      {onArchive && (
        <button
          type="button"
          onClick={handleArchive}
          title={tc('archive')}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-amber-500 transition-opacity"
        >
          <ArchiveIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {task.id && !task.is_done && (
        <button
          type="button"
          onClick={() => {
            if (showReminders) reminderRef.current?.getAndFlush();
            setShowReminders((v) => !v);
          }}
          title={t('reminders')}
          className={`transition-opacity text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 ${
            showReminders ? 'opacity-100 text-indigo-500 dark:text-indigo-400' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <BellIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {!task.is_done && (
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
    {showReminders && task.id && (
      <TaskRemindersSection ref={reminderRef} taskId={task.id} hasDueDate={!!task.due_date} />
    )}
    </>
  );
}
