'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useAllTasks } from '@/hooks/useTasks';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { TrashIcon } from '@/components/common/Icons';

type StatusFilter = 'all' | 'todo' | 'done';

export default function TasksPage() {
  const t = useTranslations('tasks');
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { tasks, loading, fetchAllTasks, toggleTask, deleteTask } = useAllTasks();
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!authLoading && !user) router.push(`/${locale}/login`);
  }, [user, authLoading, locale, router]);

  useEffect(() => {
    if (user) fetchAllTasks(filter === 'all' ? undefined : filter);
  }, [user, filter]);

  if (authLoading || !user) return null;

  const filters: StatusFilter[] = ['all', 'todo', 'done'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t('tasks')}</h1>
        <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t(f as 'all' | 'todo' | 'done')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : tasks.length === 0 ? (
        <p className="text-center py-12 text-gray-500 dark:text-gray-400">{t('noTasksFiltered')}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 group"
            >
              <input
                type="checkbox"
                checked={task.is_done}
                onChange={() => toggleTask(task.note_id, task.id, !task.is_done)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-indigo-500 cursor-pointer flex-shrink-0"
              />
              <span className={`flex-1 text-sm ${task.is_done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                {task.title}
              </span>
              <Link
                href={`/${locale}/notes/${task.note_id}`}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap hidden sm:block"
                title={task.note_title}
              >
                {task.note_title.length > 30 ? task.note_title.slice(0, 30) + '…' : task.note_title}
              </Link>
              {task.due_date && (
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {new Date(task.due_date).toLocaleDateString()}
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteTask(task.note_id, task.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
