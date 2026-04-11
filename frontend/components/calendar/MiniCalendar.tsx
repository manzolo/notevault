'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAllEvents } from '@/hooks/useEvents';
import { useAllTasks } from '@/hooks/useTasks';
import { CalendarEventWithNote, TaskWithNote } from '@/lib/types';

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

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchAllTasks(); }, [fetchAllTasks]);

  const tasks = allTasks.filter((task: TaskWithNote) => {
    if (!task.due_date) return false;
    const d = new Date(task.due_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const eventsOnDay = (day: number): boolean => {
    return events.some((e: CalendarEventWithNote) => {
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

  const tasksOnDay = (day: number): boolean => {
    return tasks.some((task: TaskWithNote) => {
      if (!task.due_date) return false;
      const d = new Date(task.due_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return selectedDate === iso;
  };

  const handleDayClick = (day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (selectedDate === iso) {
      onDayClick(null); // deselect
    } else {
      onDayClick(iso);
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
                const hasEvent = eventsOnDay(day);
                const hasTask = tasksOnDay(day);
                const today_ = isToday(day);
                const selected = isSelected(day);

                return (
                  <button
                    key={`${wi}-${di}`}
                    onClick={() => handleDayClick(day)}
                    className={`flex flex-col items-center py-0.5 rounded transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white'
                        : today_
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span className="text-[11px] leading-none font-medium">{day}</span>
                    {(hasEvent || hasTask) && (
                      <div className="flex gap-0.5 mt-0.5">
                        {hasEvent && (
                          <span
                            className={`w-1 h-1 rounded-full ${
                              selected ? 'bg-white' : 'bg-indigo-400 dark:bg-indigo-500'
                            }`}
                          />
                        )}
                        {hasTask && (
                          <span
                            className={`w-1 h-1 rounded-full ${
                              selected ? 'bg-white' : 'bg-amber-400 dark:bg-amber-500'
                            }`}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Legend */}
          {(events.length > 0 || tasks.length > 0) && (
            <div className="flex items-center gap-3 mt-2 px-0.5">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
