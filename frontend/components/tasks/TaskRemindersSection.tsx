"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { minutesLabel } from "@/components/events/RemindersSection";

const PRESETS = [10, 30, 60, 120, 1440, 10080];

interface Props {
  taskId: number;
  hasDueDate: boolean;
}

function ChannelBadges({ inApp, telegram, email }: { inApp: boolean; telegram: boolean; email: boolean }) {
  return (
    <span className="flex gap-1 text-xs">
      {inApp && <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">app</span>}
      {telegram && <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">TG</span>}
      {email && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">mail</span>}
    </span>
  );
}

export default function TaskRemindersSection({ taskId, hasDueDate }: Props) {
  const t = useTranslations("reminders");
  const tTask = useTranslations("tasks");
  const { reminders, loading, fetchReminders, createReminder, deleteReminder } = useTaskReminders(taskId);

  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"min" | "hours" | "days" | "weeks">("min");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);

  useEffect(() => {
    if (!didFetch.current) {
      didFetch.current = true;
      fetchReminders();
    }
  }, [fetchReminders]);

  const handlePreset = async (minutes: number) => {
    if (!notifyInApp && !notifyTelegram && !notifyEmail) {
      setError("Select at least one notification channel.");
      return;
    }
    setSelectedMinutes(minutes);
    await submitCreate(minutes);
  };

  const unitMultiplier = { min: 1, hours: 60, days: 1440, weeks: 10080 } as const;

  const handleCustomSubmit = async () => {
    const val = parseInt(customValue, 10);
    if (!val || val <= 0) {
      setError("Enter a valid number.");
      return;
    }
    const mins = val * unitMultiplier[customUnit];
    setSelectedMinutes(mins);
    await submitCreate(mins);
    setCustomValue("");
  };

  const submitCreate = async (minutes: number) => {
    if (!notifyInApp && !notifyTelegram && !notifyEmail) {
      setError("Select at least one notification channel.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      await createReminder({
        minutes_before: minutes,
        notify_in_app: notifyInApp,
        notify_telegram: notifyTelegram,
        notify_email: notifyEmail,
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to add reminder.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ml-6 mr-1 mt-1 mb-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 space-y-2.5 text-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
        🔔 {t("title")}
      </div>

      {!hasDueDate && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          ⚠️ {tTask("reminderNoDueDate")}
        </p>
      )}

      {hasDueDate && (
        <>
          {/* Channel toggles */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "App", active: notifyInApp, set: setNotifyInApp, activeClass: "bg-indigo-600 text-white" },
              { label: "TG", active: notifyTelegram, set: setNotifyTelegram, activeClass: "bg-sky-500 text-white" },
              { label: "Mail", active: notifyEmail, set: setNotifyEmail, activeClass: "bg-amber-500 text-white" },
            ].map(({ label, active, set, activeClass }) => (
              <button
                key={label}
                type="button"
                onClick={() => set((v) => !v)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? activeClass + " border-transparent"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Preset pills + custom input */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={creating}
                onClick={() => handlePreset(m)}
                className="px-2 py-0.5 rounded-full text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
              >
                {minutesLabel(m, t)}
              </button>
            ))}
            {/* Custom input with unit selector */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder={t("customMinutes")}
                className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-600 dark:text-gray-300"
              >
                <option value="min">{t("unitMinutes")}</option>
                <option value="hours">{t("unitHours")}</option>
                <option value="days">{t("unitDays")}</option>
                <option value="weeks">{t("unitWeeks")}</option>
              </select>
              <button
                type="button"
                disabled={creating || !customValue}
                onClick={handleCustomSubmit}
                className="px-2 py-0.5 rounded text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors"
              >
                ▶
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}

      {/* Existing reminders */}
      {loading && <p className="text-xs text-gray-400">{t("noReminders")}</p>}
      {reminders.length === 0 && !loading && hasDueDate && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{t("noReminders")}</p>
      )}
      {reminders.map((r) => (
        <div key={r.id} className="flex items-center justify-between border-t border-indigo-100 dark:border-indigo-900/30 pt-1.5">
          <span className="text-xs text-gray-700 dark:text-gray-300">{minutesLabel(r.minutes_before, t)}</span>
          <div className="flex items-center gap-2">
            <ChannelBadges inApp={r.notify_in_app} telegram={r.notify_telegram} email={r.notify_email} />
            <button
              type="button"
              onClick={() => deleteReminder(r.id)}
              className="text-gray-400 hover:text-red-500 transition-colors text-xs w-5 h-5 flex items-center justify-center"
              title={t("remove")}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
