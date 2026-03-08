'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Attachment } from '@/lib/types';

export function useAttachments(noteId: number) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Attachment[]>(`/api/notes/${noteId}/attachments`);
      setAttachments(response.data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const uploadAttachment = useCallback(
    async (file: File, tagIds: number[] = [], description?: string): Promise<Attachment> => {
      const formData = new FormData();
      formData.append('file', file);
      tagIds.forEach((id) => formData.append('tag_ids', String(id)));
      if (description) formData.append('description', description);

      const response = await api.post<Attachment>(
        `/api/notes/${noteId}/attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setAttachments((prev) => [...prev, response.data]);
      return response.data;
    },
    [noteId],
  );

  const deleteAttachment = useCallback(
    async (attachmentId: number): Promise<void> => {
      await api.delete(`/api/notes/${noteId}/attachments/${attachmentId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    },
    [noteId],
  );

  const getStreamUrl = useCallback(
    (attachmentId: number): string =>
      `/api/notes/${noteId}/attachments/${attachmentId}/stream`,
    [noteId],
  );

  const previewAttachment = useCallback(
    async (attachmentId: number): Promise<string> => {
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/stream`,
        { responseType: 'blob' },
      );
      return URL.createObjectURL(response.data as Blob);
    },
    [noteId],
  );

  return {
    attachments,
    loading,
    fetchAttachments,
    uploadAttachment,
    deleteAttachment,
    getStreamUrl,
    previewAttachment,
  };
}
