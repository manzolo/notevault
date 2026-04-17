"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EventReminder } from "@/lib/types";
import api from "@/lib/api";

export interface PendingReminder {
  minutes_before: number;
  notify_in_app: boolean;
  notify_telegram: boolean;
  notify_email: boolean;
}

interface Props {
  eventId?: number; // undefined = new event
  pendingReminders: PendingReminder[];
  deletedReminderIds: number[];
  onPendingChange: (reminders: PendingReminder[]) => void;
  onDeletedChange: (ids: number[]) => void;
}

export const PRESETS = [10, 30, 60, 120, 1440, 10080];

export function minutesLabel(minutes: number, t: (k: string) => string): string {
  const map: Record<number, string> = {
    10: t("reminder10min"),
    30: t("reminder30min"),
    60: t("reminder1h"),
    120: t("reminder2h"),
    1440: t("reminder1d"),
    10080: t("reminder1w"),
  };
  if (map[minutes]) return map[minutes];
  if (minutes % 10080 === 0) return `${minutes / 10080} ${t("unitWeeks")}`;
  if (minutes % 1440 === 0) return `${minutes / 1440} ${t("unitDays")}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${t("unitHours")}`;
  return `${minutes} ${t("unitMinutes")}`;
}

function ChannelBadges({ r }: { r: Pick<PendingReminder, "notify_in_app" | "notify_telegram" | "notify_email"> }) {
  return (
    <span className="flex gap-1 text-xs">
      {r.notify_in_app && <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">app</span>}
      {r.notify_telegram && <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">TG</span>}
      {r.notify_email && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">mail</span>}
    </span>
  );
}

export default function RemindersSection({
  eventId,
  pendingReminders,
  deletedReminderIds,
  onPendingChange,
  onDeletedChange,
}: Props) {
  const t = useTranslations("reminders");
  const [existingReminders, setExistingReminders] = useState<EventReminder[]>([]);
  const [adding, setAdding] = useState(false);
  const [newMinutes, setNewMinutes] = useState(60);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"min" | "hours" | "days" | "weeks">("min");
  const unitMultiplier = { min: 1, hours: 60, days: 1440, weeks: 10080 } as const;
  const [newInApp, setNewInApp] = useState(true);
  const [newTelegram, setNewTelegram] = useState(false);
  const [newEmail, setNewEmail] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    api
      .get<EventReminder[]>(`/api/events/${eventId}/reminders`)
      .then((res) => setExistingReminders(res.data))
      .catch(() => {});
  }, [eventId]);

  const addPending = (minutes?: number) => {
    let mins: number;
    if (minutes !== undefined) {
      mins = minutes;
    } else if (customValue) {
      const val = parseInt(customValue, 10);
      if (!val || val <= 0) return;
      mins = val * unitMultiplier[customUnit];
    } else {
      mins = newMinutes;
    }
    if (!mins || mins <= 0) return;
    if (!newInApp && !newTelegram && !newEmail) return;
    onPendingChange([
      ...pendingReminders,
      { minutes_before: mins, notify_in_app: newInApp, notify_telegram: newTelegram, notify_email: newEmail },
    ]);
    setCustomValue("");
    setAdding(false);
  };

  const removePending = (idx: number) => {
    onPendingChange(pendingReminders.filter((_, i) => i !== idx));
  };

  const markDelete = (id: number) => {
    onDeletedChange([...deletedReminderIds, id]);
  };

  const visibleExisting = existingReminders.filter((r) => !deletedReminderIds.includes(r.id));
  const hasAny = visibleExisting.length > 0 || pendingReminders.length > 0;

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          🔔 {t("title")}
        </span>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            + {t("add")}
          </button>
        )}
      </div>

      {!hasAny && !adding && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{t("noReminders")}</p>
      )}

      {visibleExisting.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
          <span>{minutesLabel(r.minutes_before, t)}</span>
          <div className="flex items-center gap-2">
            <ChannelBadges r={r} />
            <button
              type="button"
              onClick={() => markDelete(r.id)}
              className="text-gray-400 hover:text-red-500 transition-colors text-xs w-5 h-5 flex items-center justify-center"
              title={t("remove")}
            >
              ×
            </button>
          </div>
        </div>
      ))}

      {pendingReminders.map((r, idx) => (
        <div key={`p-${idx}`} className="flex items-center justify-between text-sm text-indigo-600 dark:text-indigo-400">
          <span>
            {minutesLabel(r.minutes_before, t)}{" "}
            <span className="text-xs text-gray-400 dark:text-gray-500">(nuovo)</span>
          </span>
          <div className="flex items-center gap-2">
            <ChannelBadges r={r} />
            <button
              type="button"
              onClick={() => removePending(idx)}
              className="text-gray-400 hover:text-red-500 transition-colors text-xs w-5 h-5 flex items-center justify-center"
              title={t("remove")}
            >
              ×
            </button>
          </div>
        </div>
      ))}

      {adding && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
          {/* Preset pills */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setNewMinutes(m); setCustomValue(""); }}
                className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                  newMinutes === m && !customValue
                    ? "bg-indigo-600 text-white border-transparent"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400"
                }`}
              >
                {minutesLabel(m, t)}
              </button>
            ))}
          </div>

          {/* Custom input with unit selector */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPending()}
              placeholder={t("customMinutes")}
              className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            />
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300"
            >
              <option value="min">{t("unitMinutes")}</option>
              <option value="hours">{t("unitHours")}</option>
              <option value="days">{t("unitDays")}</option>
              <option value="weeks">{t("unitWeeks")}</option>
            </select>
          </div>

          {/* Channel checkboxes */}
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={newInApp} onChange={(e) => setNewInApp(e.target.checked)} className="accent-indigo-600" />
              <span className="text-gray-700 dark:text-gray-300">App</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={newTelegram} onChange={(e) => setNewTelegram(e.target.checked)} className="accent-sky-500" />
              <span className="text-gray-700 dark:text-gray-300">Telegram</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={newEmail} onChange={(e) => setNewEmail(e.target.checked)} className="accent-amber-500" />
              <span className="text-gray-700 dark:text-gray-300">Email</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addPending()}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md transition-colors"
            >
              {t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
