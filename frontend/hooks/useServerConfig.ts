import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface ServerConfig {
  max_upload_bytes: number;
}

const FALLBACK: ServerConfig = { max_upload_bytes: 10 * 1024 * 1024 };

// Module-level cache: fetched once per page load, shared across all instances.
let cached: ServerConfig | null = null;
let fetchPromise: Promise<ServerConfig> | null = null;

function fetchConfig(): Promise<ServerConfig> {
  if (!fetchPromise) {
    fetchPromise = api
      .get<ServerConfig>('/api/config')
      .then((r) => {
        cached = r.data;
        return r.data;
      })
      .catch(() => {
        fetchPromise = null; // allow retry on next mount
        return FALLBACK;
      });
  }
  return fetchPromise;
}

export function useServerConfig(): ServerConfig {
  const [config, setConfig] = useState<ServerConfig>(cached ?? FALLBACK);

  useEffect(() => {
    if (cached) return;
    fetchConfig().then(setConfig);
  }, []);

  return config;
}
