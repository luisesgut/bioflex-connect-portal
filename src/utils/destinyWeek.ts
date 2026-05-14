// Destiny weekly plan helpers — week starts Friday (DOW=5), ends Thursday.

export const getWeekStart = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay(); // 0=Sun..6=Sat
  const offset = (dow - 5 + 7) % 7;
  r.setDate(r.getDate() - offset);
  return r;
};

export const addWeeks = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
};

export const getWeekEndDate = (weekStart: Date): Date => {
  const r = new Date(weekStart);
  r.setDate(r.getDate() + 6);
  return r;
};

export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const getWeekRangeLabel = (weekStart: Date): string => {
  const end = getWeekEndDate(weekStart);
  const sm = MONTHS[weekStart.getMonth()];
  const em = MONTHS[end.getMonth()];
  if (weekStart.getMonth() === end.getMonth()) {
    return `${sm} ${weekStart.getDate()} - ${end.getDate()}`;
  }
  return `${sm} ${weekStart.getDate()} - ${em} ${end.getDate()}`;
};

export const isTuesday = (d: Date): boolean => d.getDay() === 2;

export const parseISODateLocal = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
