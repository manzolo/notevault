'use client';

import { useState, KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Task } from '@/lib/types';
import { TrashIcon } from '@/components/common/Icons';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface TaskPanelProps {
  tasks: Task[];
  loading: boolean;
  onCreate: (title: string) => Promise<void>;
  onToggle: (id: number, isDone: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function TaskPanel({ tasks, loading, onCreate, onToggle, onDelete }: TaskPanelProps) {
  const t = useTranslations('tasks');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

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

      {/* Todo tasks */}
      {todo.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}

      {/* Done tasks */}
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

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(task.id, !task.is_done); }
    finally { setToggling(false); }
  };

  return (
    <div className="flex items-center gap-2 group py-0.5">
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
