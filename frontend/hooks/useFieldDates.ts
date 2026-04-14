'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { FieldDateEntry } from '@/lib/types';

export function useFieldDates(month?: string) {
  const [fieldDates, setFieldDates] = useState<FieldDateEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFieldDates = useCallback(async () => {
    setLoading(true);
    try {
      const params = month ? { month } : {};
      const res = await api.get<FieldDateEntry[]>('/api/field-dates', { params });
      setFieldDates(res.data);
    } catch {
      setFieldDates([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  return { fieldDates, loading, fetchFieldDates };
}
