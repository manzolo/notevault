'use client';

import { useState, KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Task } from '@/lib/types';
import { TrashIcon } from '@/components/common/Icons';
import Button from '@/components/common/Button';
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
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskPanelProps {
  tasks: Task[];
  loading: boolean;
  onCreate: (title: string) => Promise<void>;
  onToggle: (id: number, isDone: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setTasks: (tasks: Task[]) => void;
}

export default function TaskPanel({ tasks, loading, onCreate, onToggle, onDelete, onReorder, setTasks }: TaskPanelProps) {
  const t = useTranslations('tasks');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await onCreate(title);
      setNewTitle('');
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

    // Only allow reordering within todo tasks (done tasks are in a separate section)
    const todo = tasks.filter((t) => !t.is_done);
    const done = tasks.filter((t) => t.is_done);

    const oldIndex = todo.findIndex((t) => t.id === active.id);
    if (oldIndex === -1) return; // dragging a done task — skip
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

  if (loading) return <LoadingSpinner size="sm" />;

  const todo = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  return (
    <div className="space-y-3">
      {/* Add task input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('addPlaceholder')}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button variant="secondary" size="sm" onClick={handleAdd} loading={adding} disabled={!newTitle.trim()}>
          {t('add')}
        </Button>
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noTasks')}</p>
      )}

      {/* Todo tasks — sortable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={todo.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {todo.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Done tasks — not sortable */}
      {done.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{t('done')} ({done.length})</p>
          {done.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: {
  task: Task;
  onToggle: (id: number, isDone: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(task.id, !task.is_done); }
    finally { setToggling(false); }
  };

  return (
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
      {task.due_date && (
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      )}
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
