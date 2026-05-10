/**
 * Date utility functions for safe date formatting and calculations.
 *
 * App-wide display format: DD MMM YYYY (e.g. "09 Apr 2026"). Use formatDate()
 * for any user-facing date string. HTML <input type="date"> still uses ISO
 * YYYY-MM-DD natively — don't pass formatted strings to those inputs.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Safely formats a date string as "DD MMM YYYY", handling null/undefined values.
 * @param dateString - ISO date string or null/undefined
 * @param fallback - Optional fallback text (default: "Not set")
 * @returns Formatted date string like "09 Apr 2026" or fallback
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  fallback: string = 'Not set',
): string {
  if (!dateString) return fallback;

  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return fallback;

    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTHS_SHORT[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Calculates days remaining between now and target date
 * @param dateString - ISO date string or null/undefined
 * @returns Number of days remaining, or null if date is invalid
 */
export function calculateDaysRemaining(
  dateString: string | null | undefined,
): number | null {
  if (!dateString) return null;

  try {
    const targetDate = new Date(dateString);
    if (isNaN(targetDate.getTime())) return null;

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Formats days remaining as human-readable text
 * @param days - Number of days or null
 * @returns Formatted string like "5 days remaining" or "Not set"
 */
export function formatDaysRemaining(days: number | null): string {
  if (days === null) return 'Not set';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `${days} days remaining`;
}

/** Returns true when the given ISO date falls on a Wednesday in local time. */
export function isWednesday(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return false;
  return d.getDay() === 3;
}

/**
 * For a given ISO date, returns the nearest Wednesday strictly before and the
 * nearest Wednesday on-or-after, both as ISO YYYY-MM-DD strings. Returns
 * { previous: null, next: null } if the input is invalid.
 *
 * If the input itself is a Wednesday, `next` returns the same day and
 * `previous` returns the Wednesday one week earlier.
 */
export function nearestWednesdaysAround(
  dateString: string | null | undefined,
): { previous: string | null; next: string | null } {
  if (!dateString) return { previous: null, next: null };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return { previous: null, next: null };

  const day = d.getDay(); // 0..6, Sun..Sat. Wed = 3.
  // Days to add to reach the next Wednesday on or after d.
  const daysToNext = day <= 3 ? 3 - day : 10 - day;
  const next = new Date(d);
  next.setDate(d.getDate() + daysToNext);

  const previous = new Date(next);
  previous.setDate(next.getDate() - 7);

  const toIso = (x: Date) => {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return { previous: toIso(previous), next: toIso(next) };
}
