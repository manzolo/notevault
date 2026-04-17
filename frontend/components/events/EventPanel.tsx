"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarEvent, CalendarEventCreate } from "@/lib/types";
import { useEvents } from "@/hooks/useEvents";
import { useConfirm } from "@/hooks/useConfirm";
import { ArchiveIcon, RestoreIcon, TrashIcon, BellIcon } from "@/components/common/Icons";
import EventFormModal from "./EventFormModal";
import { minutesLabel } from "@/components/events/RemindersSection";
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

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Compute the next occurrence of a recurring event that falls on or after now.
 *  Returns null if the rule is exhausted (UNTIL passed or COUNT reached). */
function nextOccurrence(rrule: string, startIso: string): Date | null {
  const params: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx !== -1) params[part.slice(0, idx)] = part.slice(idx + 1);
  });

  const freq = params["FREQ"];
  if (!freq) return null;

  const interval = parseInt(params["INTERVAL"] ?? "1", 10);
  const count = params["COUNT"] ? parseInt(params["COUNT"], 10) : null;
  let until: Date | null = null;
  if (params["UNTIL"]) {
    const u = params["UNTIL"];
    until = new Date(
      parseInt(u.slice(0, 4)), parseInt(u.slice(4, 6)) - 1, parseInt(u.slice(6, 8)), 23, 59, 59
    );
  }

  const now = new Date();
  const candidate = new Date(startIso);
  if (candidate >= now) return candidate;

  let steps = 0;
  while (candidate < now) {
    steps++;
    switch (freq) {
      case "DAILY": candidate.setDate(candidate.getDate() + interval); break;
      case "WEEKLY": candidate.setDate(candidate.getDate() + 7 * interval); break;
      case "MONTHLY": candidate.setMonth(candidate.getMonth() + interval); break;
      case "YEARLY": candidate.setFullYear(candidate.getFullYear() + interval); break;
      default: return null;
    }
    if (count !== null && steps >= count) return null;
    if (until && candidate > until) return null;
  }

  return candidate;
}

/** Format RRULE to a human readable localized text */
function formatRruleText(rrule: string, t: (key: string) => string): string {
  const params: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx !== -1) params[part.slice(0, idx)] = part.slice(idx + 1);
  });

  const freq = params["FREQ"];
  const interval = parseInt(params["INTERVAL"] ?? "1", 10);

  let base = "";
  if (freq === "DAILY") base = interval === 1 ? t("recurrenceDaily") : `${t("recurrenceEvery")} ${interval} ${t("recurrenceUnitDays")}`;
  else if (freq === "WEEKLY") base = interval === 1 ? t("recurrenceWeekly") : `${t("recurrenceEvery")} ${interval} ${t("recurrenceUnitWeeks")}`;
  else if (freq === "MONTHLY") base = interval === 1 ? (params["BYDAY"] ? t("recurrenceMonthlyWeekday") : t("recurrenceMonthlyDay")) : `${t("recurrenceEvery")} ${interval} ${t("recurrenceUnitMonths")}`;
  else if (freq === "YEARLY") base = interval === 1 ? t("recurrenceYearly") : `${t("recurrenceEvery")} ${interval} ${t("recurrenceUnitYears")}`;

  if (!base) return rrule;

  let endText = "";
  if (params["UNTIL"]) {
    const u = params["UNTIL"];
    const d = new Date(parseInt(u.slice(0, 4)), parseInt(u.slice(4, 6)) - 1, parseInt(u.slice(6, 8)));
    endText = ` (${t("recurrenceEndsOn")} ${d.toLocaleDateString()})`;
  } else if (params["COUNT"]) {
    endText = ` (${t("recurrenceEndsAfter")} ${params["COUNT"]} ${t("recurrenceEndsAfterUnit")})`;
  }

  return base + endText;
}

export default function EventPanel({ noteId, onCountChange, onEventsChange, onAdd }: Props) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const tr = useTranslations("reminders");
  const { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent, archiveEvent, restoreEvent, fetchArchivedEvents } = useEvents(noteId);
  const { confirm, confirmInput, dialog: confirmDialog } = useConfirm();
  const [archivedEvents, setArchivedEvents] = useState<CalendarEvent[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
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

  // For recurring events compute next occurrence; exhausted rules stay in past.
  const displayed = events.map((e) => {
    if (e.recurrence_rule) {
      const next = nextOccurrence(e.recurrence_rule, e.start_datetime);
      if (next) {
        const duration = e.end_datetime
          ? new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()
          : null;
        return {
          event: e,
          displayStart: next,
          displayEnd: duration !== null ? new Date(next.getTime() + duration) : null,
        };
      }
    }
    return {
      event: e,
      displayStart: new Date(e.start_datetime),
      displayEnd: e.end_datetime ? new Date(e.end_datetime) : null,
    };
  });

  const upcoming = displayed.filter(({ displayStart }) => displayStart >= now);
  const past = displayed.filter(({ displayStart }) => displayStart < now);

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    const ok = await confirm(t("deleteConfirm"));
    if (!ok) return;
    await deleteEvent(ev.id);
  };

  const handleArchiveEvent = async (ev: CalendarEvent) => {
    const { confirmed, value } = await confirmInput(tc("archiveConfirm"), {
      confirmLabel: tc("archive"),
      confirmVariant: "secondary",
      inputLabel: tc("archiveReason"),
    });
    if (!confirmed) return;
    await archiveEvent(ev.id, value || undefined);
    if (showArchived) setArchivedEvents((prev) => [...prev, { ...ev, is_archived: true, archive_note: value || null }]);
  };

  const handleToggleArchived = async () => {
    if (!showArchived && archivedEvents.length === 0) {
      setArchivedLoading(true);
      try {
        const items = await fetchArchivedEvents();
        setArchivedEvents(items);
      } finally {
        setArchivedLoading(false);
      }
    }
    setShowArchived((v) => !v);
  };

  const handleRestoreArchived = async (ev: CalendarEvent) => {
    const ok = await confirm(tc("restoreConfirm"), { confirmLabel: tc("restore"), confirmVariant: "secondary" });
    if (!ok) return;
    await restoreEvent(ev.id);
    setArchivedEvents((prev) => prev.filter((e) => e.id !== ev.id));
  };

  const handleDeleteArchived = async (ev: CalendarEvent) => {
    const ok = await confirm(tc("deleteConfirm"));
    if (!ok) return;
    await deleteEvent(ev.id);
    setArchivedEvents((prev) => prev.filter((e) => e.id !== ev.id));
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

  const renderEvent = (ev: CalendarEvent, displayStart?: Date, displayEnd?: Date | null) => (
    <div key={ev.id} className="border border-gray-200 dark:border-gray-700 border-l-2 border-l-violet-400/60 dark:border-l-violet-500/50 rounded-lg p-3 space-y-2 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
              {ev.title}
              {ev.recurrence_rule && (
                <span title={formatRruleText(ev.recurrence_rule, t)} className="inline-flex items-center gap-0.5 text-xs font-normal text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full shrink-0">
                  ↻ {t("recurring")}
                </span>
              )}
              {ev.reminders && ev.reminders.length > 0 && (
                <span title={ev.reminders.map(r => minutesLabel(r.minutes_before, tr)).join("\n")} className="inline-flex items-center text-indigo-400 dark:text-indigo-500 shrink-0 cursor-help">
                  <BellIcon className="h-3.5 w-3.5" />
                </span>
              )}
            </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {displayStart ? formatDate(displayStart) : formatDatetime(ev.start_datetime)}
            {(displayEnd ?? (ev.end_datetime ? new Date(ev.end_datetime) : null)) && ` → ${formatDate(displayEnd ?? new Date(ev.end_datetime!))}`}
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
          <Button variant="ghost" size="sm" title={tc("archive")} onClick={() => handleArchiveEvent(ev)}>
            <ArchiveIcon className="w-4 h-4" />
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
          {upcoming.map(({ event, displayStart, displayEnd }) => renderEvent(event, displayStart, displayEnd))}
          {past.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 select-none">
                {t("pastEvents")} ({past.length})
              </summary>
              <div className="mt-2 space-y-2 opacity-70">
                {past.map(({ event, displayStart, displayEnd }) => renderEvent(event, displayStart, displayEnd))}
              </div>
            </details>
          )}
        </div>
      )}
      {/* Archived events section */}
      <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
        <button
          type="button"
          onClick={handleToggleArchived}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArchiveIcon className="h-3.5 w-3.5" />
          <span>{tc("archivedCount", { count: archivedEvents.length || "…" })}</span>
          <span className="ml-0.5">{showArchived ? "▲" : "▼"}</span>
        </button>

        {showArchived && (
          <div className="mt-2 space-y-1">
            {archivedLoading && <p className="text-xs text-gray-400">Loading...</p>}
            {!archivedLoading && archivedEvents.length === 0 && (
              <p className="text-xs text-gray-400 py-1">{t("noEvents")}</p>
            )}
            {archivedEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 opacity-70 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{ev.title}</p>
                  {ev.archive_note && <p className="text-xs text-gray-400 italic truncate">{ev.archive_note}</p>}
                </div>
                <button
                  type="button"
                  title={tc("restore")}
                  onClick={() => handleRestoreArchived(ev)}
                  className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                  <RestoreIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={tc("deleteForever")}
                  onClick={() => handleDeleteArchived(ev)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <EventFormModal
          event={editingEvent}
          onSave={async (data) => {
            if (editingEvent) {
              return updateEvent(editingEvent.id, data);
            } else {
              return createEvent(data as CalendarEventCreate);
            }
          }}
          onClose={() => { setShowModal(false); setEditingEvent(undefined); }}
        />
      )}
    </div>
  );
}
