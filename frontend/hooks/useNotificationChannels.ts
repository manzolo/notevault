"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface NotificationChannels {
  telegram: boolean;
  email: boolean;
}

let cachedChannels: NotificationChannels | null = null;

export function useNotificationChannels() {
  const [channels, setChannels] = useState<NotificationChannels>(
    cachedChannels ?? { telegram: false, email: false }
  );

  useEffect(() => {
    if (cachedChannels) return;
    api.get<NotificationChannels>("/api/notifications/channels")
      .then((res) => {
        cachedChannels = res.data;
        setChannels(res.data);
      })
      .catch(() => {});
  }, []);

  return channels;
}
