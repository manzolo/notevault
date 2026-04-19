'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Attachment } from '@/lib/types';
import { useArchivable } from '@/hooks/useArchivable';
import { useAttachmentParsers } from '@/hooks/useAttachmentParsers';

export function useAttachments(noteId: number) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttachments = useCallback(async (): Promise<Attachment[] | null> => {
    setLoading(true);
    try {
      const response = await api.get<Attachment[]>(`/api/notes/${noteId}/attachments`);
      setAttachments(response.data);
      return response.data;
    } catch {
      return null;
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
      if (file.lastModified) formData.append('file_modified_at', String(file.lastModified));

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
        { responseType: 'blob', params: { _t: Date.now() } },
      );
      return URL.createObjectURL(response.data as Blob);
    },
    [noteId],
  );

  const updateAttachment = useCallback(
    async (attachmentId: number, data: { filename?: string; description?: string; tag_ids?: number[] }): Promise<Attachment> => {
      const response = await api.patch<Attachment>(`/api/notes/${noteId}/attachments/${attachmentId}`, data);
      setAttachments((prev) => prev.map((a) => (a.id === attachmentId ? response.data : a)));
      return response.data;
    },
    [noteId],
  );

  const reorderAttachments = useCallback(
    async (items: { id: number; position: number }[]): Promise<void> => {
      await api.patch(`/api/notes/${noteId}/attachments/reorder`, items);
    },
    [noteId],
  );

  const fetchTextContent = useCallback(
    async (attachmentId: number): Promise<string> => {
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/stream`,
        { responseType: 'blob', params: { _t: Date.now() } },
      );
      return (response.data as Blob).text();
    },
    [noteId],
  );

  const updateAttachmentContent = useCallback(
    async (attachmentId: number, content: string): Promise<Attachment> => {
      const response = await api.put<Attachment>(
        `/api/notes/${noteId}/attachments/${attachmentId}/content`,
        { content },
      );
      setAttachments((prev) => prev.map((a) => (a.id === attachmentId ? response.data : a)));
      return response.data;
    },
    [noteId],
  );

  const {
    archiveItem: archiveAttachment,
    restoreItem: restoreAttachment,
    fetchArchived: fetchArchivedAttachments,
  } = useArchivable<Attachment>(
    { basePath: `/api/notes/${noteId}/attachments`, archiveMethod: 'patch' },
    setAttachments,
  );

  const parsers = useAttachmentParsers(noteId);

  return {
    attachments,
    setAttachments,
    loading,
    fetchAttachments,
    reorderAttachments,
    uploadAttachment,
    deleteAttachment,
    getStreamUrl,
    previewAttachment,
    fetchTextContent,
    updateAttachment,
    updateAttachmentContent,
    archiveAttachment,
    restoreAttachment,
    fetchArchivedAttachments,
    ...parsers,
  };
}
