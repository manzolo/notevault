'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Note, NoteCreate, NoteUpdate, NoteListResponse } from '@/lib/types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async (
    page = 1,
    perPage = 20,
    tagId?: number | null,
    createdAfter?: string | null,
    createdBefore?: string | null,
    categoryId?: number | null,
    pinnedOnly?: boolean,
    archivedOnly?: boolean,
    includeArchived?: boolean,
    recursive?: boolean,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, per_page: perPage };
      if (tagId != null) params.tag_id = tagId;
      if (createdAfter) params.created_after = createdAfter;
      if (createdBefore) params.created_before = createdBefore;
      if (categoryId != null) {
        params.category_id = categoryId;
      } else if (categoryId === null && !recursive) {
        params.unfiled = true;
      }
      if (pinnedOnly) params.pinned_only = true;
      if (archivedOnly) params.archived_only = true;
      if (includeArchived) params.include_archived = true;
      if (recursive) params.recursive = true;
      const response = await api.get<NoteListResponse>('/api/notes', { params });
      setNotes(response.data.items);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(async (data: NoteCreate): Promise<Note> => {
    const response = await api.post<Note>('/api/notes', data);
    return response.data;
  }, []);

  const updateNote = useCallback(async (id: number, data: NoteUpdate): Promise<Note> => {
    const response = await api.put<Note>(`/api/notes/${id}`, data);
    return response.data;
  }, []);

  const deleteNote = useCallback(async (id: number): Promise<void> => {
    await api.delete(`/api/notes/${id}`);
  }, []);

  const getNote = useCallback(async (id: number): Promise<Note> => {
    const response = await api.get<Note>(`/api/notes/${id}`);
    return response.data;
  }, []);

  return { notes, total, loading, error, fetchNotes, createNote, updateNote, deleteNote, getNote };
}
