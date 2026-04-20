'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAllEvents } from '@/hooks/useEvents';
import { useAllTasks } from '@/hooks/useTasks';
import { useFieldDates } from '@/hooks/useFieldDates';
import { useJournalDates } from '@/hooks/useJournalDates';
import { useNotes } from '@/hooks/useNotes';
import { CalendarEventWithNote, FieldDateEntry, TaskWithNote } from '@/lib/types';

interface MiniCalendarProps {
  selectedDate: string | null; // YYYY-MM-DD or null
  onDayClick: (date: string | null) => void;
}

function buildGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[][] = [];
  let day = 1;
  for (let row = 0; row < 6; row++) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      week.push(cellIndex < firstDay || day > daysInMonth ? null : day++);
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }
  return grid;
}

export default function MiniCalendar({ selectedDate, onDayClick }: MiniCalendarProps) {
  const t = useTranslations('calendar');
  const tEvents = useTranslations('events');
  const tTasks = useTranslations('tasks');
  const tFields = useTranslations('fields');
  const tJournal = useTranslations('journal');
  const locale = useLocale();
  const router = useRouter();

  const today = new Date();
  const [current, setCurrent] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  // picker: null = day grid, 'month' = month/year picker
  const [pickerOpen, setPickerOpen] = useState(false);
  // year being browsed inside the picker (may differ from current year)
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  const year = current.getFullYear();
  const month = current.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const { events, fetchEvents } = useAllEvents(monthStr);
  const { tasks: allTasks, fetchAllTasks } = useAllTasks();
  const { fieldDates, fetchFieldDates } = useFieldDates(monthStr);
  const { journalDates, fetchJournalDates } = useJournalDates(monthStr);
  const { createDailyNote } = useNotes();
  const [journalActionLoading, setJournalActionLoading] = useState(false);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchAllTasks(); }, [fetchAllTasks]);
  useEffect(() => { fetchFieldDates(); }, [fetchFieldDates]);
  useEffect(() => { fetchJournalDates(); }, [fetchJournalDates]);

  const tasks = allTasks.filter((task: TaskWithNote) => {
    if (!task.due_date) return false;
    const d = new Date(task.due_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const eventsOnDay = (day: number): CalendarEventWithNote[] => {
    return events.filter((e: CalendarEventWithNote) => {
      const start = new Date(e.start_datetime);
      const end = e.end_datetime ? new Date(e.end_datetime) : start;
      if (e.recurrence_rule) {
        // Recurring events: compare by UTC date (RRULE generates on UTC calendar date)
        const curUTC = Date.UTC(year, month, day);
        const startDayUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
        const endDayUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999);
        return curUTC >= startDayUTC && curUTC <= endDayUTC;
      }
      const cur = new Date(year, month, day, 0, 0, 0);
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
      return cur >= startDay && cur <= endDay;
    });
  };

  const tasksOnDay = (day: number): TaskWithNote[] => {
    return tasks.filter((task: TaskWithNote) => {
      if (!task.due_date) return false;
      const d = new Date(task.due_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const fieldDatesOnDay = (day: number): FieldDateEntry[] => {
    return fieldDates.filter((f: FieldDateEntry) => {
      if (!f.field_date) return false;
      // Parse as local date to avoid UTC offset shifting the day
      const [y, m, d] = f.field_date.split('-').map(Number);
      return y === year && m === month + 1 && d === day;
    });
  };

  const dayTooltip = (dayEvents: CalendarEventWithNote[], dayTasks: TaskWithNote[], dayFieldDates: FieldDateEntry[]): string => {
    const lines: string[] = [];
    for (const e of dayEvents) {
      lines.push(`📅 ${e.title}`);
      if (e.description) lines.push(`   ${e.description}`);
      if (e.note_title) lines.push(`   📝 ${e.note_title}`);
    }
    for (const task of dayTasks) {
      lines.push(`◆ ${task.title}`);
      if (task.note_title) lines.push(`   📝 ${task.note_title}`);
    }
    for (const fd of dayFieldDates) {
      lines.push(`🔧 ${fd.key}${fd.value ? ': ' + fd.value : ''}`);
      lines.push(`   📝 ${fd.note_title}`);
    }
    return lines.join('\n');
  };

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const toISODate = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const isSelected = (day: number) => selectedDate === toISODate(day);

  const journalOnDay = (day: number) => journalDates.includes(toISODate(day));
  const selectedDayHasJournal = selectedDate ? journalDates.includes(selectedDate) : false;

  const handleDayClick = (day: number) => {
    const iso = toISODate(day);
    if (selectedDate === iso) {
      onDayClick(null);
    } else {
      onDayClick(iso);
    }
  };

  const handleSelectedJournalAction = async () => {
    if (!selectedDate || journalActionLoading) return;
    setJournalActionLoading(true);
    try {
      const daily = await createDailyNote(selectedDate, locale);
      router.push(`/${locale}/notes/${daily.note_id}`);
    } finally {
      setJournalActionLoading(false);
    }
  };

  const handleOpenPicker = () => {
    setPickerYear(year);
    setPickerOpen(true);
  };

  const handlePickMonth = (m: number) => {
    setCurrent(new Date(pickerYear, m, 1));
    setPickerOpen(false);
  };

  const grid = buildGrid(year, month);

  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  });

  // Short month names for the picker grid
  const shortMonths = Array.from({ length: 12 }, (_, i) =>
    new Date(2024, i, 1).toLocaleString(undefined, { month: 'short' })
  );

  // Day headers starting Sunday
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleString(undefined, { weekday: 'narrow' })
  );

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => pickerOpen ? setPickerYear(y => y - 1) : setCurrent(new Date(year, month - 1, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label={pickerOpen ? String(pickerYear - 1) : t('prev')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleOpenPicker}
            className="text-xs font-semibold text-gray-700 dark:text-gray-200 capitalize hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title={t('pickMonth')}
          >
            {pickerOpen ? pickerYear : monthLabel}
          </button>
          {!pickerOpen && (year !== today.getFullYear() || month !== today.getMonth()) && (
            <button
              onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium"
              aria-label={t('today')}
            >
              {t('today')}
            </button>
          )}
          {pickerOpen && (
            <button
              onClick={() => setPickerOpen(false)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => pickerOpen ? setPickerYear(y => y + 1) : setCurrent(new Date(year, month + 1, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label={pickerOpen ? String(pickerYear + 1) : t('next')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {pickerOpen ? (
        /* ── Month picker ── */
        <div className="grid grid-cols-3 gap-1 py-1">
          {shortMonths.map((name, i) => {
            const isCurrentMonth = pickerYear === year && i === month;
            const isTodayMonth = pickerYear === today.getFullYear() && i === today.getMonth();
            return (
              <button
                key={i}
                onClick={() => handlePickMonth(i)}
                className={`text-[11px] py-1.5 rounded font-medium transition-colors capitalize ${
                  isCurrentMonth
                    ? 'bg-indigo-600 text-white'
                    : isTodayMonth
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {dayHeaders.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.flatMap((week, wi) =>
              week.map((day, di) => {
                if (!day) {
                  return <div key={`${wi}-${di}`} />;
                }
                const dayEvents = eventsOnDay(day);
                const dayTasks = tasksOnDay(day);
                const dayFdates = fieldDatesOnDay(day);
                const hasEvent = dayEvents.length > 0;
                const hasTask = dayTasks.length > 0;
                const hasFieldDate = dayFdates.length > 0;
                const hasJournal = journalOnDay(day);
                const today_ = isToday(day);
                const selected = isSelected(day);
                const tooltip = (hasEvent || hasTask || hasFieldDate)
                  ? dayTooltip(dayEvents, dayTasks, dayFdates)
                  : hasJournal
                  ? tJournal('badge')
                  : undefined;

                return (
                  <button
                    key={`${wi}-${di}`}
                    onClick={() => handleDayClick(day)}
                    title={tooltip}
                    className={`flex flex-col items-center py-0.5 rounded transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white'
                        : today_
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span className="text-[11px] leading-none font-medium">{day}</span>
                    {(hasEvent || hasTask || hasFieldDate || hasJournal) && (
                      <div className="flex gap-0.5 mt-0.5">
                        {hasEvent && (
                          <span className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-indigo-400 dark:bg-indigo-500'}`} />
                        )}
                        {hasTask && (
                          <span className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-amber-400 dark:bg-amber-500'}`} />
                        )}
                        {hasFieldDate && (
                          <span className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-emerald-500 dark:bg-emerald-400'}`} />
                        )}
                        {hasJournal && (
                          <span data-testid={`journal-dot-${day}`} className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-cyan-500 dark:bg-cyan-400'}`} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Legend */}
          {(events.length > 0 || tasks.length > 0 || fieldDates.length > 0 || journalDates.length > 0) && (
            <div className="flex items-center gap-3 mt-2 px-0.5 flex-wrap">
              {events.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 inline-block" />
                  {tEvents('events')}
                </span>
              )}
              {tasks.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 inline-block" />
                  {tTasks('tasks')}
                </span>
              )}
              {fieldDates.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
                  {tFields('fieldDates')}
                </span>
              )}
              {journalDates.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 inline-block" />
                  {tJournal('badge')}
                </span>
              )}
            </div>
          )}
          {selectedDate && (
            <button
              type="button"
              onClick={handleSelectedJournalAction}
              disabled={journalActionLoading}
              className="mt-2 w-full rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-2 text-left text-[11px] font-medium text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
            >
              <span className="block text-[10px] uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
                {selectedDate}
              </span>
              <span className="block mt-0.5">
                {selectedDayHasJournal ? tJournal('openSelected') : tJournal('createSelected')}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
