'use client';

import { Dispatch, SetStateAction, useCallback } from 'react';
import api from '@/lib/api';

interface ArchivableConfig {
  basePath: string;
  archiveSuffix?: string;
  archiveMethod?: 'patch' | 'put';
}

export function useArchivable<T extends { id: number; position: number }>(
  config: ArchivableConfig,
  setState: Dispatch<SetStateAction<T[]>>,
) {
  const { basePath, archiveSuffix = '', archiveMethod = 'patch' } = config;

  const archiveItem = useCallback(
    async (id: number, archiveNote?: string): Promise<void> => {
      await api[archiveMethod](`${basePath}/${id}${archiveSuffix}`, {
        is_archived: true,
        archive_note: archiveNote || null,
      });
      setState((prev) => prev.filter((item) => item.id !== id));
    },
    [basePath, archiveSuffix, archiveMethod, setState],
  );

  const restoreItem = useCallback(
    async (id: number): Promise<T> => {
      const res = await api[archiveMethod]<T>(`${basePath}/${id}${archiveSuffix}`, {
        is_archived: false,
        archive_note: null,
      });
      setState((prev) => [...prev, res.data].sort((a, b) => a.position - b.position));
      return res.data;
    },
    [basePath, archiveSuffix, archiveMethod, setState],
  );

  const fetchArchived = useCallback(async (): Promise<T[]> => {
    const res = await api.get<T[]>(basePath, { params: { archived_only: true } });
    return res.data;
  }, [basePath]);

  return { archiveItem, restoreItem, fetchArchived };
}
