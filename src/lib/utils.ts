import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a "YYYY-MM-DD" date string as local time instead of UTC.
 * Prevents the off-by-one-day bug in negative UTC offset timezones.
 */
export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function parseLocalizedNumber(
  value: string,
  useCommaDecimal?: boolean,
): number {
  if (!value) return 0;

  let str = String(value).trim();
  if (!str) return 0;

  str = str.replace(/[¤$\u20AC£¥\s]/g, "");

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const isCommaDecimal = useCommaDecimal ?? (lastComma > lastDot);

  if (isCommaDecimal) {
    str = str.replace(/\./g, "");
    str = str.replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(str);
  return Number.isNaN(parsed) ? 0 : parsed;
}
