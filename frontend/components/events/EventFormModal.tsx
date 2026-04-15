"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarEvent, CalendarEventCreate, CalendarEventUpdate } from "@/lib/types";
import Button from "@/components/common/Button";

interface Props {
  event?: CalendarEvent;
  onSave: (data: CalendarEventCreate | CalendarEventUpdate) => Promise<void>;
  onClose: () => void;
}

type RecurrenceType = "none" | "daily" | "weekly" | "monthly_day" | "monthly_weekday" | "yearly";
type EndsType = "never" | "on_date" | "after_count";

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function toDatePart(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimePart(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Build RRULE string from UI state */
function buildRrule(
  type: RecurrenceType,
  startDate: string,
  weekdays: string[],
  endsType: EndsType,
  endsDate: string,
  endsCount: string,
  interval: string,
): string | undefined {
  if (type === "none" || !startDate) return undefined;

  const d = new Date(startDate + "T00:00");
  const dayName = WEEKDAY_CODES[d.getDay()];
  const weekOfMonth = Math.ceil(d.getDate() / 7);

  let rule = "";
  switch (type) {
    case "daily":
      rule = "FREQ=DAILY";
      break;
    case "weekly": {
      const days = weekdays.length > 0 ? weekdays : [dayName];
      rule = `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
      break;
    }
    case "monthly_day":
      rule = `FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`;
      break;
    case "monthly_weekday":
      rule = `FREQ=MONTHLY;BYDAY=${weekOfMonth}${dayName}`;
      break;
    case "yearly":
      rule = `FREQ=YEARLY;BYMONTH=${d.getMonth() + 1};BYMONTHDAY=${d.getDate()}`;
      break;
  }

  const intervalNum = parseInt(interval, 10);
  if (!isNaN(intervalNum) && intervalNum > 1) rule += `;INTERVAL=${intervalNum}`;

  if (endsType === "on_date" && endsDate) {
    const until = endsDate.replace(/-/g, "") + "T235959Z";
    rule += `;UNTIL=${until}`;
  } else if (endsType === "after_count" && endsCount) {
    rule += `;COUNT=${endsCount}`;
  }

  return rule;
}

/** Parse RRULE string back into UI state */
function parseRrule(rrule?: string): {
  type: RecurrenceType;
  weekdays: string[];
  endsType: EndsType;
  endsDate: string;
  endsCount: string;
  interval: string;
} {
  const empty = { type: "none" as RecurrenceType, weekdays: [], endsType: "never" as EndsType, endsDate: "", endsCount: "", interval: "1" };
  if (!rrule) return empty;

  const params: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx !== -1) params[part.slice(0, idx)] = part.slice(idx + 1);
  });

  let type: RecurrenceType = "none";
  const freq = params["FREQ"];
  if (freq === "DAILY") type = "daily";
  else if (freq === "WEEKLY") type = "weekly";
  else if (freq === "MONTHLY") type = params["BYDAY"] ? "monthly_weekday" : "monthly_day";
  else if (freq === "YEARLY") type = "yearly";

  const weekdays: string[] = [];
  if (params["BYDAY"] && freq === "WEEKLY") {
    params["BYDAY"].split(",").forEach((d) => weekdays.push(d.replace(/\d/g, "")));
  }

  let endsType: EndsType = "never";
  let endsDate = "";
  let endsCount = "";
  if (params["UNTIL"]) {
    endsType = "on_date";
    const u = params["UNTIL"].replace(/T.*/, "");
    endsDate = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
  } else if (params["COUNT"]) {
    endsType = "after_count";
    endsCount = params["COUNT"];
  }

  const interval = params["INTERVAL"] ?? "1";

  return { type, weekdays, endsType, endsDate, endsCount, interval };
}

/** Human-readable label for monthly_weekday based on start date */
function monthlyWeekdayLabel(startDate: string, t: (k: string) => string): string {
  if (!startDate) return "";
  const d = new Date(startDate + "T00:00");
  const weekOfMonth = Math.ceil(d.getDate() / 7);
  const dayNames = [
    t("wdSunday"), t("wdMonday"), t("wdTuesday"), t("wdWednesday"),
    t("wdThursday"), t("wdFriday"), t("wdSaturday"),
  ];
  const ordinals = [t("ordinal1"), t("ordinal2"), t("ordinal3"), t("ordinal4"), t("ordinal5")];
  return `${ordinals[weekOfMonth - 1] ?? weekOfMonth} ${dayNames[d.getDay()]}`;
}

export default function EventFormModal({ event, onSave, onClose }: Props) {
  const t = useTranslations("events");
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startDate, setStartDate] = useState(toDatePart(event?.start_datetime));
  const [startTime, setStartTime] = useState(toTimePart(event?.start_datetime));
  const [endDate, setEndDate] = useState(toDatePart(event?.end_datetime));
  const [endTime, setEndTime] = useState(toTimePart(event?.end_datetime));
  const [url, setUrl] = useState(event?.url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Recurrence state
  const parsedRrule = parseRrule(event?.recurrence_rule);
  const [recType, setRecType] = useState<RecurrenceType>(parsedRrule.type);
  const [recWeekdays, setRecWeekdays] = useState<string[]>(parsedRrule.weekdays);
  const [recEndsType, setRecEndsType] = useState<EndsType>(parsedRrule.endsType);
  const [recEndsDate, setRecEndsDate] = useState(parsedRrule.endsDate);
  const [recEndsCount, setRecEndsCount] = useState(parsedRrule.endsCount);
  const [recInterval, setRecInterval] = useState(parsedRrule.interval);

  const toggleWeekday = (code: string) => {
    setRecWeekdays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    setSaving(true);
    setError("");
    try {
      // Default to noon to avoid UTC day-boundary shifts (e.g. UTC+2 midnight = prev day UTC)
      const startT = startTime || "12:00";
      let endD = endDate;
      let endT = endTime;

      if (endDate && !endTime) endT = "23:59";

      const rrule = buildRrule(recType, startDate, recWeekdays, recEndsType, recEndsDate, recEndsCount, recInterval);

      const data: CalendarEventCreate = {
        title: title.trim(),
        description: description.trim() || undefined,
        start_datetime: new Date(`${startDate}T${startT}:00`).toISOString(),
        end_datetime: endD && endT ? new Date(`${endD}T${endT}:00`).toISOString() : undefined,
        url: url.trim() || undefined,
        recurrence_rule: rrule,
      };
      await onSave(data);
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]";
  const selectClass =
    "border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

  const weekdayLabels: { code: string; label: string }[] = [
    { code: "MO", label: t("wdMon") },
    { code: "TU", label: t("wdTue") },
    { code: "WE", label: t("wdWed") },
    { code: "TH", label: t("wdThu") },
    { code: "FR", label: t("wdFri") },
    { code: "SA", label: t("wdSat") },
    { code: "SU", label: t("wdSun") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {event ? t("editEvent") : t("addEvent")}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("title")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {/* Start / End datetimes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("startDatetime")}</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={inputClass}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  step="900"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("endDatetime")}</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="900"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("url")}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              className={inputClass}
            />
          </div>

          {/* Recurrence */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">{t("recurrence")}</label>
              <select
                value={recType}
                onChange={(e) => { setRecType(e.target.value as RecurrenceType); setRecInterval("1"); }}
                className={selectClass}
              >
                <option value="none">{t("recurrenceNone")}</option>
                <option value="daily">{t("recurrenceDaily")}</option>
                <option value="weekly">{t("recurrenceWeekly")}</option>
                <option value="monthly_day">{t("recurrenceMonthlyDay")}</option>
                <option value="monthly_weekday">{t("recurrenceMonthlyWeekday")}</option>
                <option value="yearly">{t("recurrenceYearly")}</option>
              </select>
            </div>

            {/* Interval */}
            {recType !== "none" && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="shrink-0">{t("recurrenceEvery")}</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={recInterval}
                  onChange={(e) => setRecInterval(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-16 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                />
                <span className="shrink-0 text-gray-500 dark:text-gray-400">
                  {recType === "daily" && t("recurrenceUnitDays")}
                  {recType === "weekly" && t("recurrenceUnitWeeks")}
                  {(recType === "monthly_day" || recType === "monthly_weekday") && t("recurrenceUnitMonths")}
                  {recType === "yearly" && t("recurrenceUnitYears")}
                </span>
              </div>
            )}

            {/* Weekly: day checkboxes */}
            {recType === "weekly" && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t("recurrenceWeekdays")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {weekdayLabels.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleWeekday(code)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        recWeekdays.includes(code)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly by weekday: computed label */}
            {recType === "monthly_weekday" && startDate && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("recurrenceEvery")} <span className="font-medium">{monthlyWeekdayLabel(startDate, t)}</span>
              </p>
            )}

            {/* Yearly: computed label */}
            {recType === "yearly" && startDate && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("recurrenceEvery")}{" "}
                {parseInt(recInterval, 10) > 1 && <span className="font-medium">{recInterval} </span>}
                {t("recurrenceUnitYears")}{" "}{t("recurrenceIntervalOn")}{" "}
                <span className="font-medium">{new Date(startDate + "T00:00").toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span>
              </p>
            )}

            {/* Ends section */}
            {recType !== "none" && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("recurrenceEnds")}</p>
                <div className="flex flex-col gap-1.5">
                  {(["never", "on_date", "after_count"] as EndsType[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="recEndsType"
                        value={opt}
                        checked={recEndsType === opt}
                        onChange={() => setRecEndsType(opt)}
                        className="accent-indigo-600"
                      />
                      {opt === "never" && t("recurrenceEndsNever")}
                      {opt === "on_date" && (
                        <span className="flex items-center gap-2">
                          {t("recurrenceEndsOn")}
                          {recEndsType === "on_date" && (
                            <input
                              type="date"
                              value={recEndsDate}
                              onChange={(e) => setRecEndsDate(e.target.value)}
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                            />
                          )}
                        </span>
                      )}
                      {opt === "after_count" && (
                        <span className="flex items-center gap-2">
                          {t("recurrenceEndsAfter")}
                          {recEndsType === "after_count" && (
                            <input
                              type="number"
                              min="1"
                              max="999"
                              value={recEndsCount}
                              onChange={(e) => setRecEndsCount(e.target.value)}
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-16 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          )}
                          {t("recurrenceEndsAfterUnit")}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>{t("cancel")}</Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "..." : t("save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
