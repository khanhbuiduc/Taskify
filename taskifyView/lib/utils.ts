import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip HTML tags to plain text (e.g. for truncate or search). */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Due date/time: API returns "yyyy-MM-ddTHH:mm:ss". No time = end of day 23:59:59. */

/** Get date part "yyyy-MM-dd" from dueDate (ISO or "yyyy-MM-dd"). */
export function getDueDatePart(dueDate: string): string {
  if (!dueDate) return ''
  return dueDate.slice(0, 10)
}

/**
 * Get time part "HH:mm" for API. Returns undefined if whole day (no time: date-only, 00:00, or 23:59).
 */
export function getDueTimePart(dueDate: string): string | undefined {
  if (!dueDate || !dueDate.includes('T')) return undefined
  const time = dueDate.slice(11, 16) // "HH:mm"
  const sec = dueDate.slice(17, 19)   // "ss" or ""
  if (time === '23:59' && (sec === '' || sec === '59')) return undefined
  if (time === '00:00' && (sec === '' || sec === '00')) return undefined
  return time || undefined
}

/** True if dueDate has no specific time (whole day: date-only, 00:00, or 23:59). */
export function isWholeDay(dueDate: string): boolean {
  return getDueTimePart(dueDate) === undefined
}

/** Format due for display: date only if whole day, else date + time. */
export function formatDueDisplay(dueDate: string): string {
  if (!dueDate) return ''
  const d = new Date(dueDate)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (isWholeDay(dueDate)) return dateStr
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dateStr}, ${timeStr}`
}

const SANITIZE_ALLOWED_TAGS = ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'a', 'blockquote', 'code', 'pre', 'span', 'div']
const SANITIZE_ALLOWED_ATTR = ['href', 'target', 'rel', 'data-checked', 'class']

/** Server/SSR fallback: strip dangerous tags only (no jsdom). */
function sanitizeHtmlFallback(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<\/?(script|iframe|object|embed|form|input|button|on\w+)[^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sanitize HTML for safe display (XSS protection). Uses dynamic import of
 * isomorphic-dompurify to avoid ESM/CommonJS issues with jsdom on load.
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (!html || typeof html !== 'string') return ''
  if (typeof window === 'undefined') return sanitizeHtmlFallback(html)
  const DOMPurify = (await import('isomorphic-dompurify')).default
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: SANITIZE_ALLOWED_TAGS,
    ALLOWED_ATTR: SANITIZE_ALLOWED_ATTR,
  })
}
