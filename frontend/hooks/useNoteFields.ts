'use client';

import { useCallback, useState } from 'react';
import api from '@/lib/api';
import { NoteField, NoteFieldCreate, NoteFieldUpdate } from '@/lib/types';

export function useNoteFields(noteId: number) {
  const [fields, setFields] = useState<NoteField[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<NoteField[]>(`/api/notes/${noteId}/fields`);
      setFields(response.data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const createField = useCallback(
    async (data: NoteFieldCreate): Promise<NoteField> => {
      const response = await api.post<NoteField>(`/api/notes/${noteId}/fields`, data);
      setFields((prev) => [...prev, response.data].sort((a, b) => a.position - b.position || a.id - b.id));
      return response.data;
    },
    [noteId],
  );

  const updateField = useCallback(
    async (fieldId: number, data: NoteFieldUpdate): Promise<NoteField> => {
      const response = await api.put<NoteField>(`/api/notes/${noteId}/fields/${fieldId}`, data);
      setFields((prev) => prev.map((f) => (f.id === fieldId ? response.data : f)));
      return response.data;
    },
    [noteId],
  );

  const deleteField = useCallback(
    async (fieldId: number): Promise<void> => {
      await api.delete(`/api/notes/${noteId}/fields/${fieldId}`);
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    },
    [noteId],
  );

  const reorderFields = useCallback(
    async (items: { id: number; position: number }[]): Promise<void> => {
      await api.patch(`/api/notes/${noteId}/fields/reorder`, items);
    },
    [noteId],
  );

  return {
    fields,
    setFields,
    loading,
    fetchFields,
    createField,
    updateField,
    deleteField,
    reorderFields,
  };
}
