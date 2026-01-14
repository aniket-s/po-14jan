/**
 * Date utility functions for safe date formatting and calculations
 */

/**
 * Safely formats a date string, handling null/undefined values
 * @param dateString - ISO date string or null/undefined
 * @param fallback - Optional fallback text (default: "Not set")
 * @returns Formatted date string or fallback
 */
export function formatDate(
  dateString: string | null | undefined,
  fallback: string = "Not set"
): string {
  if (!dateString) return fallback;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return fallback;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
  dateString: string | null | undefined
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
  if (days === null) return "Not set";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  return `${days} days remaining`;
}
