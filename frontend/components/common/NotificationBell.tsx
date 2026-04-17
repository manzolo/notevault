"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import api from "@/lib/api";
import { AppNotification } from "@/lib/types";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s fa`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return `${Math.floor(diff / 86400)}g fa`;
}

const SNOOZE_PRESETS: Array<{ key: string; minutes: number }> = [
  { key: "snooze10m", minutes: 10 },
  { key: "snooze30m", minutes: 30 },
  { key: "snooze1h", minutes: 60 },
  { key: "snooze3h", minutes: 180 },
  { key: "snooze8h", minutes: 480 },
  { key: "snooze1d", minutes: 1440 },
  { key: "snooze1w", minutes: 10080 },
];

function SnoozeMenu({
  notification,
  onSnooze,
  onClose,
}: {
  notification: AppNotification;
  onSnooze: (id: number, minutes: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("notifications");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[200] overflow-hidden py-1"
    >
      {SNOOZE_PRESETS.map(({ key, minutes }) => (
        <button
          key={key}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze(notification.id, minutes);
            onClose();
          }}
        >
          {t(key as keyof ReturnType<typeof useTranslations<"notifications">>)}
        </button>
      ))}
    </div>
  );
}

export default function NotificationBell() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const { unreadCount, notifications, loadingList, fetchNotifications, markRead, markAllRead, snoozeNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [snoozeMenuId, setSnoozeMenuId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSnoozeMenuId(null);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    setSnoozeMenuId(null);
    if (!open) fetchNotifications();
  };

  const handleSnooze = async (id: number, minutes: number) => {
    await snoozeNotification(id, minutes);
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    setSnoozeMenuId(null);
    if (n.event_id) {
      try {
        const { data } = await api.get(`/api/events/${n.event_id}`);
        router.push(data.note_id ? `/${locale}/notes/${data.note_id}` : `/${locale}/calendar`);
      } catch {
        router.push(`/${locale}/calendar`);
      }
    } else if (n.task_id) {
      try {
        const { data } = await api.get(`/api/tasks/${n.task_id}`);
        router.push(`/${locale}/notes/${data.note_id}`);
      } catch {
        router.push(`/${locale}/tasks`);
      }
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={t("title")}
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              {t("title")} {unreadCount > 0 && <span className="text-red-500">({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {loadingList && (
              <p className="text-xs text-gray-400 text-center py-6">{t("loading")}</p>
            )}
            {!loadingList && notifications.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">{t("empty")}</p>
            )}
            {!loadingList && notifications.map((n) => (
              <div
                key={n.id}
                className={`relative px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  !n.is_read ? "bg-indigo-50/60 dark:bg-indigo-900/10" : ""
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>
                    {n.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {/* Snooze button */}
                    <div className="relative">
                      <button
                        type="button"
                        title={t("snooze")}
                        className="p-0.5 rounded text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSnoozeMenuId(snoozeMenuId === n.id ? null : n.id);
                        }}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      {snoozeMenuId === n.id && (
                        <SnoozeMenu
                          notification={n}
                          onSnooze={handleSnooze}
                          onClose={() => setSnoozeMenuId(null)}
                        />
                      )}
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                </div>
                {n.body && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
