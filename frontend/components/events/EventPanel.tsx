"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarEvent, CalendarEventCreate } from "@/lib/types";
import { useEvents } from "@/hooks/useEvents";
import { useConfirm } from "@/hooks/useConfirm";
import EventFormModal from "./EventFormModal";
import Button from "@/components/common/Button";
import api from "@/lib/api";

interface Props {
  noteId: number;
  onCountChange?: (count: number) => void;
  onEventsChange?: (events: CalendarEvent[]) => void;
  onAdd?: React.MutableRefObject<(() => void) | null>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function EventPanel({ noteId, onCountChange, onEventsChange, onAdd }: Props) {
  const t = useTranslations("events");
  const { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent } = useEvents(noteId);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!loading) {
      onCountChange?.(events.length);
      onEventsChange?.(events);
    }
  }, [events, loading]);

  useEffect(() => {
    if (onAdd) {
      onAdd.current = () => { setEditingEvent(undefined); setShowModal(true); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.start_datetime) >= now);
  const past = events.filter((e) => new Date(e.start_datetime) < now);

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    const ok = await confirm(t("deleteConfirm"));
    if (!ok) return;
    await deleteEvent(ev.id);
  };

  const handleUpload = async (eventId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    await api.post(`/api/events/${eventId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    await fetchEvents();
  };

  const handleDeleteAttachment = async (eventId: number, attId: number) => {
    const ok = await confirm(t("deleteConfirm"));
    if (!ok) return;
    await api.delete(`/api/events/${eventId}/attachments/${attId}`);
    await fetchEvents();
  };

  const handleDownloadAttachment = async (eventId: number, att: { id: number; filename: string; mime_type: string }) => {
    try {
      const response = await api.get(`/api/events/${eventId}/attachments/${att.id}/stream`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: att.mime_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    }
  };

  const renderEvent = (ev: CalendarEvent) => (
    <div key={ev.id} className="border border-gray-200 dark:border-gray-700 border-l-2 border-l-violet-400/60 dark:border-l-violet-500/50 rounded-lg p-3 space-y-2 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{ev.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDatetime(ev.start_datetime)}
            {ev.end_datetime && ` → ${formatDatetime(ev.end_datetime)}`}
          </p>
          {ev.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{ev.description}</p>}
          {ev.url && (
            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate block">
              {ev.url}
            </a>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(ev); setShowModal(true); }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </Button>
          <Button variant="ghost-danger" size="sm" onClick={() => handleDeleteEvent(ev)}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Attachments */}
      {ev.attachments.length > 0 && (
        <div className="space-y-1 ml-2">
          {ev.attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <button
                type="button"
                onClick={() => handleDownloadAttachment(ev.id, att)}
                className="hover:underline text-indigo-600 dark:text-indigo-400 truncate max-w-xs text-left"
              >
                {att.filename}
              </button>
              <span className="text-gray-400">({formatSize(att.size_bytes)})</span>
              <button
                onClick={() => handleDeleteAttachment(ev.id, att.id)}
                className="ml-auto shrink-0 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete attachment"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          type="file"
          className="hidden"
          ref={(el) => { fileInputRefs.current[ev.id] = el; }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(ev.id, file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRefs.current[ev.id]?.click()}
          className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
        >
          + {t("addAttachment")}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("events")}</h2>
        <Button variant="secondary" size="sm" onClick={() => { setEditingEvent(undefined); setShowModal(true); }}>
          + {t("addEvent")}
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-2">
          {upcoming.length === 0 && past.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("noEvents")}</p>
          )}
          {upcoming.map(renderEvent)}
          {past.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 select-none">
                {t("pastEvents")} ({past.length})
              </summary>
              <div className="mt-2 space-y-2 opacity-70">
                {past.map(renderEvent)}
              </div>
            </details>
          )}
        </div>
      )}
      {showModal && (
        <EventFormModal
          event={editingEvent}
          onSave={async (data) => {
            if (editingEvent) {
              await updateEvent(editingEvent.id, data);
            } else {
              await createEvent(data as CalendarEventCreate);
            }
          }}
          onClose={() => { setShowModal(false); setEditingEvent(undefined); }}
        />
      )}
    </div>
  );
}
