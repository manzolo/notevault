"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { CalendarEventWithNote, TaskWithNote } from "@/lib/types";
import { useAllEvents } from "@/hooks/useEvents";
import { useAllTasks } from "@/hooks/useTasks";
import { CalendarIcon } from "@/components/common/Icons";

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

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const { events, fetchEvents } = useAllEvents(monthStr);
  const { tasks: allTasks, fetchAllTasks } = useAllTasks();

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  // Filter tasks that have a due_date in the current month
  const tasks = allTasks.filter((task: TaskWithNote) => {
    if (!task.due_date) return false;
    const d = new Date(task.due_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  const grid = buildCalendarGrid(year, month);

  const eventsOnDay = (day: number): CalendarEventWithNote[] =>
    events.filter((e) => {
      const d = new Date(e.start_datetime);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const tasksOnDay = (day: number): TaskWithNote[] =>
    tasks.filter((task: TaskWithNote) => {
      if (!task.due_date) return false;
      const d = new Date(task.due_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            aria-label={t("prev")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg font-bold"
          >
            &#8249;
          </button>
          <span className="text-lg font-semibold text-gray-800 dark:text-white min-w-[160px] text-center">
            {MONTH_NAMES_EN[month]} {year}
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
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
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
              const totalItems = dayEvents.length + dayTasks.length;
              const MAX_PILLS = 2;
              const combined = [
                ...dayEvents.map((e) => ({ type: "event" as const, item: e })),
                ...dayTasks.map((t) => ({ type: "task" as const, item: t })),
              ];
              const shown = combined.slice(0, MAX_PILLS);
              const more = Math.max(0, totalItems - MAX_PILLS);

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
                  {shown.map(({ type, item }, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/${locale}/notes/${item.note_id}`)}
                      className={`w-full text-left text-xs truncate rounded px-1.5 py-0.5 ${
                        type === "event"
                          ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                          : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  ))}
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

      {events.length === 0 && tasks.length === 0 && (
        <p className="text-center text-gray-400 mt-6 text-sm">{t("noItems")}</p>
      )}
    </div>
  );
}
