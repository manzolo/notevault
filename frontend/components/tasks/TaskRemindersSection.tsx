"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { minutesLabel } from "@/components/events/RemindersSection";
import { useNotificationChannels } from "@/hooks/useNotificationChannels";
import { BellIcon, TelegramIcon, MailIcon } from "@/components/common/Icons";

const PRESETS = [10, 30, 60, 120, 1440, 10080];

export interface TaskRemindersSectionHandle {
  getAndFlush: () => void;
}

interface Props {
  taskId: number;
  hasDueDate: boolean;
}

function ChannelIcons({ inApp, telegram, email }: { inApp: boolean; telegram: boolean; email: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {inApp    && <BellIcon     className="h-3 w-3 text-indigo-400" />}
      {telegram && <TelegramIcon className="h-3 w-3 text-sky-400" />}
      {email    && <MailIcon     className="h-3 w-3 text-amber-400" />}
    </span>
  );
}

const TaskRemindersSection = forwardRef<TaskRemindersSectionHandle, Props>(function TaskRemindersSection({ taskId, hasDueDate }, ref) {
  const t = useTranslations("reminders");
  const tTask = useTranslations("tasks");
  const availableChannels = useNotificationChannels();
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
  const channelDefaultsApplied = useRef(false);
  const addFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channelDefaultsApplied.current) return;
    if (availableChannels.telegram || availableChannels.email) {
      channelDefaultsApplied.current = true;
      setNotifyTelegram(availableChannels.telegram);
      setNotifyEmail(availableChannels.email);
    }
  }, [availableChannels]);

  useImperativeHandle(ref, () => ({
    getAndFlush: () => {
      const val = parseInt(customValue, 10);
      if (val > 0) handleCustomSubmit();
    },
  }));

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
      await fetchReminders();
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
    { label: "App",      active: notifyInApp,    set: setNotifyInApp,    Icon: BellIcon,     activeClass: "bg-indigo-600 border-indigo-600 text-white", show: true },
    { label: "Telegram", active: notifyTelegram, set: setNotifyTelegram, Icon: TelegramIcon, activeClass: "bg-sky-500 border-sky-500 text-white",    show: availableChannels.telegram },
    { label: "Email",    active: notifyEmail,    set: setNotifyEmail,    Icon: MailIcon,     activeClass: "bg-amber-500 border-amber-500 text-white", show: availableChannels.email },
  ];

  return (
    <div className="ml-6 mt-1 mb-2 w-fit max-w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <BellIcon className="h-3.5 w-3.5 text-indigo-500" /> {t("title")}
      </div>

      <div className="px-3 py-2 space-y-2">
        {!hasDueDate && (
          <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            ⚠️ {tTask("reminderNoDueDate")}
          </p>
        )}

        {hasDueDate && (
          <>
            {/* Channel toggles */}
            <div ref={addFormRef} className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {channels.filter((c) => c.show).map(({ label, active, set, Icon, activeClass }) => (
                  <button key={label} type="button" onClick={() => set((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium transition-all ${
                      active ? activeClass : "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}>
                    <Icon className="h-3 w-3" />{label}
                  </button>
                ))}
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((m) => (
                  <button key={m} type="button" disabled={creating} onClick={() => addWith(m)}
                    className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-40">
                    {minutesLabel(m, t)}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="flex items-center gap-1.5">
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
                  className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-gray-900 dark:text-white placeholder-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-gray-700 dark:text-gray-300">
                  <option value="min">{t("unitMinutes")}</option>
                  <option value="hours">{t("unitHours")}</option>
                  <option value="days">{t("unitDays")}</option>
                  <option value="weeks">{t("unitWeeks")}</option>
                </select>
              </div>

              {error && <p className="text-red-500">{error}</p>}
            </div>
          </>
        )}

        {/* Existing reminders */}
        {loading && <p className="text-gray-400">{t("noReminders")}</p>}
        {reminders.length === 0 && !loading && hasDueDate && (
          <p className="text-gray-400 dark:text-gray-500">{t("noReminders")}</p>
        )}
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700/60 border border-gray-100 dark:border-gray-700">
            <span className="text-gray-700 dark:text-gray-300 font-medium">{minutesLabel(r.minutes_before, t)}</span>
            <div className="flex items-center gap-2">
              <ChannelIcons inApp={r.notify_in_app} telegram={r.notify_telegram} email={r.notify_email} />
              <button type="button" onClick={() => deleteReminder(r.id)}
                className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors w-4 h-4 flex items-center justify-center leading-none"
                title={t("remove")}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default TaskRemindersSection;
