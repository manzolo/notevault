import { format, formatDistanceToNow, type Locale } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

const DATE_FNS_LOCALES: Record<string, Locale> = { it: itLocale };

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'MMM d, yyyy');
}

export function formatRelative(dateString: string, locale?: string): string {
  const date = new Date(dateString);
  const dateFnsLocale = locale ? DATE_FNS_LOCALES[locale] : undefined;
  return formatDistanceToNow(date, { addSuffix: true, locale: dateFnsLocale });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/** Strip common markdown syntax for plain-text previews */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\\\[/g, '[').replace(/\\\]/g, ']')   // unescape \[ \]
    .replace(/\[\[([^\]]+)\]\]/g, '$1')             // [[wiki]] → title
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')        // [text](url) → text
    .replace(/#{1,6}\s+/gm, '')                     // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')              // **bold**
    .replace(/\*([^*]+)\*/g, '$1')                  // *italic*
    .replace(/__([^_]+)__/g, '$1')                  // __bold__
    .replace(/_([^_]+)_/g, '$1')                    // _italic_
    .replace(/~~([^~]+)~~/g, '$1')                  // ~~strike~~
    .replace(/```[\s\S]*?```/g, '')                 // fenced code blocks (must be before inline)
    .replace(/`+([^`]*)`+/g, '$1')                  // inline code: `x`, ``x``, etc.
    .replace(/^[-*+]\s+/gm, '')                     // list items
    .replace(/^\d+\.\s+/gm, '')                     // ordered lists
    .replace(/^>\s+/gm, '')                         // blockquotes
    .replace(/\n+/g, ' ')
    .trim();
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/** Returns the local timezone offset as "+HH:MM" or "-HH:MM" */
function localOffset(): string {
  const off = -new Date().getTimezoneOffset(); // minutes ahead of UTC
  const sign = off >= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const m = String(Math.abs(off) % 60).padStart(2, '0');
  return `${sign}${h}:${m}`;
}

/** "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00+HH:MM" (start of day, local time) */
export function dateToLocalStart(date: string): string {
  return `${date}T00:00:00${localOffset()}`;
}

/** "YYYY-MM-DD" → "YYYY-MM-DDT23:59:59+HH:MM" (end of day, local time) */
export function dateToLocalEnd(date: string): string {
  return `${date}T23:59:59${localOffset()}`;
}
