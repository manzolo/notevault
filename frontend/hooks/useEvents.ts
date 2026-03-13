'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { CalendarEvent, CalendarEventCreate, CalendarEventUpdate, CalendarEventWithNote } from '@/lib/types';

export function useEvents(noteId: number) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CalendarEvent[]>(`/api/notes/${noteId}/events`);
      setEvents(res.data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const createEvent = useCallback(async (data: CalendarEventCreate): Promise<CalendarEvent> => {
    const res = await api.post<CalendarEvent>(`/api/notes/${noteId}/events`, data);
    await fetchEvents();
    return res.data;
  }, [noteId, fetchEvents]);

  const updateEvent = useCallback(async (eventId: number, data: CalendarEventUpdate): Promise<CalendarEvent> => {
    const res = await api.put<CalendarEvent>(`/api/notes/${noteId}/events/${eventId}`, data);
    await fetchEvents();
    return res.data;
  }, [noteId, fetchEvents]);

  const deleteEvent = useCallback(async (eventId: number): Promise<void> => {
    await api.delete(`/api/notes/${noteId}/events/${eventId}`);
    await fetchEvents();
  }, [noteId, fetchEvents]);

  return { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent };
}

export function useAllEvents(month?: string) {
  const [events, setEvents] = useState<CalendarEventWithNote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = month ? { month } : {};
      const res = await api.get<CalendarEventWithNote[]>('/api/events', { params });
      setEvents(res.data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  return { events, loading, fetchEvents };
}
