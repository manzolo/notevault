'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Task, TaskCreate, TaskUpdate, TaskWithNote } from '@/lib/types';

export function useTasks(noteId: number) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Task[]>(`/api/notes/${noteId}/tasks`);
      setTasks(res.data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const createTask = useCallback(async (data: TaskCreate): Promise<Task> => {
    const res = await api.post<Task>(`/api/notes/${noteId}/tasks`, data);
    setTasks((prev) => [...prev, res.data]);
    return res.data;
  }, [noteId]);

  const updateTask = useCallback(async (taskId: number, data: TaskUpdate): Promise<Task> => {
    const res = await api.put<Task>(`/api/notes/${noteId}/tasks/${taskId}`, data);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? res.data : t)));
    return res.data;
  }, [noteId]);

  const deleteTask = useCallback(async (taskId: number): Promise<void> => {
    await api.delete(`/api/notes/${noteId}/tasks/${taskId}`);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, [noteId]);

  const reorderTasks = useCallback(async (items: { id: number; position: number }[]): Promise<void> => {
    await api.patch(`/api/notes/${noteId}/tasks/reorder`, items);
  }, [noteId]);

  return { tasks, setTasks, loading, fetchTasks, createTask, updateTask, deleteTask, reorderTasks };
}

export function useAllTasks() {
  const [tasks, setTasks] = useState<TaskWithNote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllTasks = useCallback(async (statusFilter?: 'todo' | 'done' | 'all') => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get<TaskWithNote[]>('/api/tasks', { params });
      setTasks(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleTask = useCallback(async (noteId: number, taskId: number, isDone: boolean): Promise<void> => {
    const res = await api.put<TaskWithNote>(`/api/notes/${noteId}/tasks/${taskId}`, { is_done: isDone });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...res.data, note_title: t.note_title } : t)));
  }, []);

  const deleteTask = useCallback(async (noteId: number, taskId: number): Promise<void> => {
    await api.delete(`/api/notes/${noteId}/tasks/${taskId}`);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  return { tasks, loading, fetchAllTasks, toggleTask, deleteTask };
}
