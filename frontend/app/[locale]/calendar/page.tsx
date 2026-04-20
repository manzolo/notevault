"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { CalendarEventWithNote, FieldDateEntry, TaskWithNote } from "@/lib/types";
import { useAllEvents } from "@/hooks/useEvents";
import { useAllTasks } from "@/hooks/useTasks";
import { useFieldDates } from "@/hooks/useFieldDates";
import { useJournalDates } from "@/hooks/useJournalDates";
import { useNotes } from "@/hooks/useNotes";
import { BookOpenIcon, CalendarIcon } from "@/components/common/Icons";

function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[][] = [];
  let day = 1;
  const startOffset = firstDay;

  for (let row = 0; row < 6; row++) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      if (cellIndex < startOffset || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day++);
      }
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }
  return grid;
}


export default function CalendarPage() {
  const t = useTranslations("calendar");
  const tEvents = useTranslations("events");
  const tTasks = useTranslations("tasks");
  const tFields = useTranslations("fields");
  const tJournal = useTranslations("journal");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const localeStr = locale === "it" ? "it-IT" : "en-US";

  const { events, fetchEvents } = useAllEvents(monthStr);
  const { tasks: allTasks, fetchAllTasks } = useAllTasks();
  const { fieldDates, fetchFieldDates } = useFieldDates(monthStr);
  const { journalDates, fetchJournalDates } = useJournalDates(monthStr);
  const { createDailyNote } = useNotes();

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    fetchFieldDates();
  }, [fetchFieldDates]);

  useEffect(() => {
    fetchJournalDates();
  }, [fetchJournalDates]);

  // Filter tasks that have a due_date in the current month
  const tasks = allTasks.filter((task: TaskWithNote) => {
    if (task.is_done || !task.due_date) return false;
    const d = new Date(task.due_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  const grid = buildCalendarGrid(year, month);

  const eventsOnDay = (day: number): CalendarEventWithNote[] =>
    events.filter((e) => {
      const start = new Date(e.start_datetime);
      const end = e.end_datetime ? new Date(e.end_datetime) : start;
      if (e.recurrence_rule) {
        // Recurring events: compare by UTC date (RRULE generates on UTC calendar date)
        const curUTC = Date.UTC(year, month, day);
        const startDayUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
        const endDayUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999);
        return curUTC >= startDayUTC && curUTC <= endDayUTC;
      }
      const current = new Date(year, month, day, 0, 0, 0);
      const eventStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
      const eventEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
      return current >= eventStartDay && current <= eventEndDay;
    });

  const tasksOnDay = (day: number): TaskWithNote[] =>
    tasks.filter((task: TaskWithNote) => {
      if (!task.due_date) return false;
      const d = new Date(task.due_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const fieldDatesOnDay = (day: number): FieldDateEntry[] =>
    fieldDates.filter((f: FieldDateEntry) => {
      if (!f.field_date) return false;
      const [y, m, d] = f.field_date.split("-").map(Number);
      return y === year && m === month + 1 && d === day;
    });

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const toISODate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const journalOnDay = (day: number) => journalDates.includes(toISODate(day));

  const handleJournalOpen = async (journalDate: string) => {
    const daily = await createDailyNote(journalDate, locale);
    router.push(`/${locale}/notes/${daily.note_id}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          {(year !== today.getFullYear() || month !== today.getMonth()) && (
            <button
              onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="text-xs px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium"
            >
              {t("today")}
            </button>
          )}
          <button
            onClick={prev}
            aria-label={t("prev")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg font-bold"
          >
            &#8249;
          </button>
          <span className="text-lg font-semibold text-gray-800 dark:text-white min-w-[160px] text-center capitalize">
            {new Date(year, month, 1).toLocaleString(localeStr, { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={next}
            aria-label={t("next")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg font-bold"
          >
            &#8250;
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: 7 }, (_, i) =>
            new Date(2024, 0, 7 + i).toLocaleString(localeStr, { weekday: "short" })
          ).map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize">
              {d}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {grid.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
          >
            {week.map((day, di) => {
              const dayEvents = day ? eventsOnDay(day) : [];
              const dayTasks = day ? tasksOnDay(day) : [];
              const dayFdates = day ? fieldDatesOnDay(day) : [];
              const hasJournal = day ? journalOnDay(day) : false;
              const MAX_PILLS = 3;
              const combined = [
                ...dayEvents.map((e) => ({ type: "event" as const, item: e })),
                ...dayTasks.map((t) => ({ type: "task" as const, item: t })),
                ...dayFdates.map((f) => ({ type: "field" as const, item: f })),
              ];
              const shown = combined.slice(0, MAX_PILLS);
              const more = Math.max(0, combined.length - MAX_PILLS);

              return (
                <div
                  key={di}
                  className={`min-h-[90px] p-1.5 flex flex-col gap-1 ${
                    day ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"
                  }`}
                >
                  {day && (
                    <span
                      className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full self-end ${
                        isToday(day)
                          ? "bg-indigo-600 text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {day}
                    </span>
                  )}
                  {hasJournal && day && (
                    <button
                      onClick={() => handleJournalOpen(toISODate(day))}
                      className="w-full text-left rounded border-l-2 border-cyan-500 px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 overflow-hidden shadow-sm"
                      title={`${tJournal("badge")} — ${toISODate(day)}`}
                    >
                      <div className="flex items-center gap-1 text-xs truncate font-medium">
                        <BookOpenIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{tJournal("badge")}</span>
                      </div>
                      <div className="text-[10px] truncate opacity-70">{toISODate(day)}</div>
                    </button>
                  )}
                  {shown.map(({ type, item }, i) => {
                    if (type === "field") {
                      const f = item as FieldDateEntry;
                      const label = f.value ? `${f.key}: ${f.value}` : f.key;
                      return (
                        <button
                          key={i}
                          onClick={() => router.push(`/${locale}/notes/${f.note_id}`)}
                          className="w-full text-left rounded px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 overflow-hidden"
                          title={`${label} — ${f.note_title}`}
                        >
                          <div className="text-xs truncate">{label}</div>
                          {f.note_title && <div className="text-[10px] truncate opacity-60">{f.note_title}</div>}
                        </button>
                      );
                    }
                    const ev = item as CalendarEventWithNote;
                    const timeStr = type === "event"
                      ? new Date(ev.start_datetime).toLocaleTimeString(localeStr, { hour: "2-digit", minute: "2-digit" })
                      : null;
                    const noteTitle = type === "event" ? ev.note_title : (item as TaskWithNote).note_title;
                    return (
                      <button
                        key={i}
                        onClick={() => router.push(`/${locale}/notes/${item.note_id}`)}
                        className={`w-full text-left rounded px-1.5 py-0.5 overflow-hidden ${
                          type === "event"
                            ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                            : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                        }`}
                        title={timeStr ? `${item.title} — ${timeStr}` : item.title}
                      >
                        <div className="text-xs truncate">{timeStr ? `${timeStr} ${item.title}` : item.title}</div>
                        {noteTitle && <div className="text-[10px] truncate opacity-60">{noteTitle}</div>}
                      </button>
                    );
                  })}
                  {more > 0 && (
                    <span className="text-xs text-gray-400 pl-1">
                      +{more} {t("more")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      {(events.length > 0 || tasks.length > 0 || fieldDates.length > 0 || journalDates.length > 0) && (
        <div className="flex items-center gap-4 mt-4 px-1 flex-wrap">
          {events.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 dark:bg-indigo-500 inline-block" />
              {tEvents("events")}
            </span>
          )}
          {tasks.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-amber-500 inline-block" />
              {tTasks("tasks")}
            </span>
          )}
          {fieldDates.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
              {tFields("fieldDates")}
            </span>
          )}
          {journalDates.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 inline-block" />
              {tJournal("badge")}
            </span>
          )}
        </div>
      )}

      {events.length === 0 && tasks.length === 0 && fieldDates.length === 0 && journalDates.length === 0 && (
        <p className="text-center text-gray-400 mt-6 text-sm">{t("noItems")}</p>
      )}
    </div>
  );
}
