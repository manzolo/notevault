import { Secret, CalendarEvent, VirtualBookmark } from './types';

export function buildVirtualBookmarks(
  secrets: Secret[],
  events: CalendarEvent[]
): VirtualBookmark[] {
  const fromSecrets = secrets
    .filter((s) => !!s.url?.trim())
    .map((s) => ({
      virtualKey: `vs-${s.id}`,
      source: 'secret' as const,
      sourceId: s.id,
      sourceName: s.name,
      url: s.url!,
      description: s.username ?? undefined,
    }));

  const fromEvents = events
    .filter((e) => !!e.url?.trim())
    .map((e) => ({
      virtualKey: `ve-${e.id}`,
      source: 'event' as const,
      sourceId: e.id,
      sourceName: e.title,
      url: e.url!,
      description: e.description ?? undefined,
    }));

  return [...fromSecrets, ...fromEvents];
}
