import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'MMM d, yyyy');
}

export function formatRelative(dateString: string): string {
  const date = new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
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
    .replace(/`([^`]+)`/g, '$1')                    // `code`
    .replace(/```[\s\S]*?```/g, '')                 // code blocks
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
