'use client';

import { useCallback } from 'react';
import api from '@/lib/api';

export function useAttachmentParsers(noteId: number) {
  const parseZip = useCallback(
    async (
      attachmentId: number,
      password?: string,
    ): Promise<{
      entries: { name: string; size: number; compressed_size: number; is_dir: boolean; content_type: string }[];
      encrypted: boolean;
    }> => {
      const params: Record<string, string> = {};
      if (password) params.password = password;
      const response = await api.get(`/api/notes/${noteId}/attachments/${attachmentId}/zip`, { params });
      return response.data;
    },
    [noteId],
  );

  const previewZipEntry = useCallback(
    async (attachmentId: number, entryPath: string, password?: string): Promise<string> => {
      const params: Record<string, string> = { path: entryPath };
      if (password) params.password = password;
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/zip/entry`,
        { params, responseType: 'blob' },
      );
      return URL.createObjectURL(response.data as Blob);
    },
    [noteId],
  );

  const downloadZipEntry = useCallback(
    async (attachmentId: number, entryPath: string, filename: string, password?: string): Promise<void> => {
      const params: Record<string, string> = { path: entryPath };
      if (password) params.password = password;
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/zip/entry`,
        { params, responseType: 'blob' },
      );
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [noteId],
  );

  const previewZipEmlPart = useCallback(
    async (attachmentId: number, entryPath: string, partIndex: number, password?: string): Promise<string> => {
      const params: Record<string, string> = { path: entryPath, part_index: String(partIndex) };
      if (password) params.password = password;
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/zip/entry/eml/part`,
        { params, responseType: 'blob' },
      );
      return URL.createObjectURL(response.data as Blob);
    },
    [noteId],
  );

  const downloadZipEmlPart = useCallback(
    async (attachmentId: number, entryPath: string, partIndex: number, filename: string, password?: string): Promise<void> => {
      const params: Record<string, string> = { path: entryPath, part_index: String(partIndex) };
      if (password) params.password = password;
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/zip/entry/eml/part`,
        { params, responseType: 'blob' },
      );
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [noteId],
  );

  const parseZipEml = useCallback(
    async (
      attachmentId: number,
      entryPath: string,
      password?: string,
    ): Promise<{
      headers: Record<string, string>;
      body_text: string | null;
      body_html: string | null;
      attachments: { index: number; filename: string; content_type: string; size: number }[];
    }> => {
      const params: Record<string, string> = { path: entryPath };
      if (password) params.password = password;
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/zip/entry/eml`,
        { params },
      );
      return response.data;
    },
    [noteId],
  );

  const parseEml = useCallback(
    async (attachmentId: number): Promise<{
      headers: Record<string, string>;
      body_text: string | null;
      body_html: string | null;
      attachments: { index: number; filename: string; content_type: string; size: number }[];
    }> => {
      const response = await api.get(`/api/notes/${noteId}/attachments/${attachmentId}/eml`);
      return response.data;
    },
    [noteId],
  );

  const previewEmlPart = useCallback(
    async (attachmentId: number, partIndex: number): Promise<string> => {
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/eml/part/${partIndex}`,
        { responseType: 'blob' },
      );
      return URL.createObjectURL(response.data as Blob);
    },
    [noteId],
  );

  const downloadEmlPart = useCallback(
    async (attachmentId: number, partIndex: number, filename: string): Promise<void> => {
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachmentId}/eml/part/${partIndex}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [noteId],
  );

  return {
    parseZip,
    previewZipEntry,
    downloadZipEntry,
    parseZipEml,
    previewZipEmlPart,
    downloadZipEmlPart,
    parseEml,
    previewEmlPart,
    downloadEmlPart,
  };
}
