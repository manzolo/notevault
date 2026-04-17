"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { minutesLabel } from "@/components/events/RemindersSection";
import { BellIcon, TelegramIcon, MailIcon } from "@/components/common/Icons";

const PRESETS = [10, 30, 60, 120, 1440, 10080];

interface Props {
  taskId: number;
  hasDueDate: boolean;
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

export default function TaskRemindersSection({ taskId, hasDueDate }: Props) {
  const t = useTranslations("reminders");
  const tTask = useTranslations("tasks");
  const { reminders, loading, fetchReminders, createReminder, deleteReminder } = useTaskReminders(taskId);

  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"min" | "hours" | "days" | "weeks">("min");
  const unitMultiplier = { min: 1, hours: 60, days: 1440, weeks: 10080 } as const;
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);
  const addFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!didFetch.current) {
      didFetch.current = true;
      fetchReminders();
    }
  }, [fetchReminders]);

  const addWith = async (minutes: number) => {
    if (!notifyInApp && !notifyTelegram && !notifyEmail) {
      setError(t("noChannelSelected") ?? "Select at least one channel.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      await createReminder({ minutes_before: minutes, notify_in_app: notifyInApp, notify_telegram: notifyTelegram, notify_email: notifyEmail });
      setCustomValue("");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to add reminder.");
    } finally {
      setCreating(false);
    }
  };

  const handleCustomSubmit = async () => {
    const val = parseInt(customValue, 10);
    if (!val || val <= 0) { setError("Enter a valid number."); return; }
    await addWith(val * unitMultiplier[customUnit]);
  };

  const channels = [
    { label: "App",      active: notifyInApp,    set: setNotifyInApp,    Icon: BellIcon,     activeClass: "bg-indigo-600 border-indigo-600 text-white" },
    { label: "Telegram", active: notifyTelegram, set: setNotifyTelegram, Icon: TelegramIcon, activeClass: "bg-sky-500 border-sky-500 text-white" },
    { label: "Email",    active: notifyEmail,    set: setNotifyEmail,    Icon: MailIcon,     activeClass: "bg-amber-500 border-amber-500 text-white" },
  ];

  return (
    <div className="ml-6 mr-1 mt-1 mb-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 space-y-2 text-xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
        <BellIcon className="h-3 w-3" /> {t("title")}
      </div>

      {!hasDueDate && (
        <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
          ⚠️ {tTask("reminderNoDueDate")}
        </p>
      )}

      {hasDueDate && (
        <>
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
          <div ref={addFormRef} className="flex flex-wrap gap-1.5 items-center">
            {PRESETS.map((m) => (
              <button key={m} type="button" disabled={creating} onClick={() => addWith(m)}
                className="px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50">
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
                className="w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-700 dark:text-gray-300">
                <option value="min">{t("unitMinutes")}</option>
                <option value="hours">{t("unitHours")}</option>
                <option value="days">{t("unitDays")}</option>
                <option value="weeks">{t("unitWeeks")}</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-500">{error}</p>}
        </>
      )}

      {/* Existing reminders */}
      {loading && <p className="text-gray-400">{t("noReminders")}</p>}
      {reminders.length === 0 && !loading && hasDueDate && (
        <p className="text-gray-400 dark:text-gray-500">{t("noReminders")}</p>
      )}
      {reminders.map((r) => (
        <div key={r.id} className="flex items-center justify-between border-t border-indigo-100 dark:border-indigo-900/30 pt-1.5">
          <span className="text-gray-700 dark:text-gray-300">{minutesLabel(r.minutes_before, t)}</span>
          <div className="flex items-center gap-2">
            <ChannelIcons inApp={r.notify_in_app} telegram={r.notify_telegram} email={r.notify_email} />
            <button type="button" onClick={() => deleteReminder(r.id)}
              className="text-gray-400 hover:text-red-500 transition-colors w-4 h-4 flex items-center justify-center"
              title={t("remove")}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
