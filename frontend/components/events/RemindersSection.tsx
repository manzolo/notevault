"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { EventReminder } from "@/lib/types";
import { BellIcon, TelegramIcon, MailIcon } from "@/components/common/Icons";
import api from "@/lib/api";

export interface PendingReminder {
  minutes_before: number;
  notify_in_app: boolean;
  notify_telegram: boolean;
  notify_email: boolean;
}

export interface RemindersSectionHandle {
  /** Returns the pending custom input as a reminder (if valid) and clears the input. */
  getAndFlush: () => PendingReminder | null;
}

interface Props {
  eventId?: number;
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

function ChannelIcons({ inApp, telegram, email }: { inApp: boolean; telegram: boolean; email: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {inApp    && <BellIcon     className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />}
      {telegram && <TelegramIcon className="h-3 w-3 text-sky-500 dark:text-sky-400" />}
      {email    && <MailIcon     className="h-3 w-3 text-amber-500 dark:text-amber-400" />}
    </span>
  );
}

const RemindersSection = forwardRef<RemindersSectionHandle, Props>(function RemindersSection({
  eventId,
  pendingReminders,
  deletedReminderIds,
  onPendingChange,
  onDeletedChange,
}, ref) {
  const t = useTranslations("reminders");
  const [existingReminders, setExistingReminders] = useState<EventReminder[]>([]);
  const [adding, setAdding] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"min" | "hours" | "days" | "weeks">("min");
  const unitMultiplier = { min: 1, hours: 60, days: 1440, weeks: 10080 } as const;
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const addFormRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getAndFlush: () => {
      const val = parseInt(customValue, 10);
      if (!val || val <= 0) return null;
      if (!notifyInApp && !notifyTelegram && !notifyEmail) return null;
      const mins = val * unitMultiplier[customUnit];
      setCustomValue("");
      setAdding(false);
      return { minutes_before: mins, notify_in_app: notifyInApp, notify_telegram: notifyTelegram, notify_email: notifyEmail };
    },
  }));

  useEffect(() => {
    if (!eventId) return;
    api.get<EventReminder[]>(`/api/events/${eventId}/reminders`)
      .then((res) => setExistingReminders(res.data))
      .catch(() => {});
  }, [eventId]);

  const addWith = (minutes: number) => {
    if (!notifyInApp && !notifyTelegram && !notifyEmail) return;
    onPendingChange([
      ...pendingReminders,
      { minutes_before: minutes, notify_in_app: notifyInApp, notify_telegram: notifyTelegram, notify_email: notifyEmail },
    ]);
    setCustomValue("");
    setAdding(false);
  };

  const handleCustomSubmit = () => {
    const val = parseInt(customValue, 10);
    if (!val || val <= 0) return;
    addWith(val * unitMultiplier[customUnit]);
  };

  const removePending = (idx: number) => onPendingChange(pendingReminders.filter((_, i) => i !== idx));
  const markDelete   = (id: number)  => onDeletedChange([...deletedReminderIds, id]);

  const visibleExisting = existingReminders.filter((r) => !deletedReminderIds.includes(r.id));
  const hasAny = visibleExisting.length > 0 || pendingReminders.length > 0;

  const channels = [
    { label: "App",      active: notifyInApp,      set: setNotifyInApp,      Icon: BellIcon,     activeClass: "bg-indigo-600 border-indigo-600 text-white" },
    { label: "Telegram", active: notifyTelegram,   set: setNotifyTelegram,   Icon: TelegramIcon, activeClass: "bg-sky-500 border-sky-500 text-white" },
    { label: "Email",    active: notifyEmail,      set: setNotifyEmail,      Icon: MailIcon,     activeClass: "bg-amber-500 border-amber-500 text-white" },
  ];

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 uppercase tracking-wide">
          <BellIcon className="h-3.5 w-3.5" /> {t("title")}
        </span>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            + {t("add")}
          </button>
        )}
      </div>

      {/* Existing reminder rows */}
      {!hasAny && !adding && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{t("noReminders")}</p>
      )}
      {visibleExisting.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
          <span>{minutesLabel(r.minutes_before, t)}</span>
          <div className="flex items-center gap-2">
            <ChannelIcons inApp={r.notify_in_app} telegram={r.notify_telegram} email={r.notify_email} />
            <button type="button" onClick={() => markDelete(r.id)}
              className="text-gray-400 hover:text-red-500 transition-colors w-4 h-4 flex items-center justify-center"
              title={t("remove")}>×</button>
          </div>
        </div>
      ))}
      {pendingReminders.map((r, idx) => (
        <div key={`p-${idx}`} className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
          <span className="flex items-center gap-1">
            {minutesLabel(r.minutes_before, t)}
            <span className="text-gray-400 dark:text-gray-500 font-normal">(+)</span>
          </span>
          <div className="flex items-center gap-2">
            <ChannelIcons inApp={r.notify_in_app} telegram={r.notify_telegram} email={r.notify_email} />
            <button type="button" onClick={() => removePending(idx)}
              className="text-gray-400 hover:text-red-500 transition-colors w-4 h-4 flex items-center justify-center"
              title={t("remove")}>×</button>
          </div>
        </div>
      ))}

      {/* Add form */}
      {adding && (
        <div ref={addFormRef} className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
          {/* Channel icon-pill toggles */}
          <div className="flex gap-1.5">
            {channels.map(({ label, active, set, Icon, activeClass }) => (
              <button key={label} type="button" onClick={() => set((v) => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium transition-colors ${
                  active ? activeClass : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400"
                }`}>
                <Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>

          {/* Presets + custom in one wrapping row */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {PRESETS.map((m) => (
              <button key={m} type="button" onClick={() => addWith(m)}
                className="px-2 py-0.5 rounded-full text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {minutesLabel(m, t)}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input type="number" min="1" value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                onBlur={(e) => {
                  const related = e.relatedTarget as Node | null;
                  if (customValue && parseInt(customValue, 10) > 0 && (!related || !addFormRef.current?.contains(related))) {
                    handleCustomSubmit();
                  }
                }}
                placeholder={t("customMinutes")}
                className="w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white" />
              <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-700 dark:text-gray-300">
                <option value="min">{t("unitMinutes")}</option>
                <option value="hours">{t("unitHours")}</option>
                <option value="days">{t("unitDays")}</option>
                <option value="weeks">{t("unitWeeks")}</option>
              </select>
              <button type="button" onClick={() => { setAdding(false); setCustomValue(""); }}
                className="px-1.5 py-0.5 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RemindersSection;
