// src/lib/founder/windows.ts — Riyadh-calendar window arithmetic for the Founder Operating
// Center. Saudi Arabia has no DST: a fixed UTC+3 offset is correct year-round. Every window is
// half-open [start, end) and carries an explicit kind so "this month" and "last 30 days" can
// never be confused on a card.

export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
export const TIMEZONE = 'Asia/Riyadh';

export type WindowKind = 'day' | '7d' | '30d' | 'month' | 'custom';

export interface MetricWindow {
  kind: WindowKind;
  start: Date;
  end: Date;
  /** True when `end` is "now" rather than a completed boundary (the current day/month). */
  partial: boolean;
  labelAr: string;
}

export function toRiyadh(d: Date): Date {
  return new Date(d.getTime() + RIYADH_OFFSET_MS);
}

export function riyadhDateString(d: Date): string {
  return toRiyadh(d).toISOString().slice(0, 10);
}

/** Midnight (Riyadh) of the given Riyadh calendar date, as a UTC instant. */
export function riyadhMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+03:00`);
}

export function riyadhMidnightDaysAgo(daysAgo: number, now = new Date()): Date {
  const r = toRiyadh(now);
  r.setUTCHours(0, 0, 0, 0);
  r.setUTCDate(r.getUTCDate() - daysAgo);
  return new Date(r.getTime() - RIYADH_OFFSET_MS);
}

export function riyadhMonthStart(now = new Date(), monthsAgo = 0): Date {
  const r = toRiyadh(now);
  r.setUTCDate(1);
  r.setUTCHours(0, 0, 0, 0);
  r.setUTCMonth(r.getUTCMonth() - monthsAgo);
  return new Date(r.getTime() - RIYADH_OFFSET_MS);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

const fmt = (d: Date) => toRiyadh(d).toISOString().slice(0, 10);

export function windowFor(kind: WindowKind, now = new Date(), custom?: { start: string; end: string }): MetricWindow {
  switch (kind) {
    case 'day': {
      // The previous COMPLETED Riyadh day.
      const start = riyadhMidnightDaysAgo(1, now);
      const end = riyadhMidnightDaysAgo(0, now);
      return { kind, start, end, partial: false, labelAr: `يوم ${fmt(start)}` };
    }
    case '7d': {
      const end = now;
      const start = new Date(now.getTime() - 7 * 86_400_000);
      return { kind, start, end, partial: true, labelAr: 'آخر 7 أيام (168 ساعة متحركة)' };
    }
    case '30d': {
      const end = now;
      const start = new Date(now.getTime() - 30 * 86_400_000);
      return { kind, start, end, partial: true, labelAr: 'آخر 30 يومًا (متحركة)' };
    }
    case 'month': {
      const start = riyadhMonthStart(now);
      return { kind, start, end: now, partial: true, labelAr: `هذا الشهر من ${fmt(start)} حتى الآن` };
    }
    case 'custom': {
      const start = custom ? riyadhMidnight(custom.start) : riyadhMidnightDaysAgo(30, now);
      const end = custom ? addDays(riyadhMidnight(custom.end), 1) : now;
      return { kind, start, end, partial: end.getTime() > now.getTime(), labelAr: `من ${fmt(start)} إلى ${fmt(addDays(end, -1))}` };
    }
  }
}

/** The equal-length window immediately before `w` — the only comparison the register allows. */
export function previousEqualWindow(w: MetricWindow): MetricWindow {
  const len = w.end.getTime() - w.start.getTime();
  const start = new Date(w.start.getTime() - len);
  return { kind: w.kind, start, end: w.start, partial: false, labelAr: `الفترة السابقة المساوية (${fmt(start)} → ${fmt(addDays(w.start, -1))})` };
}

/** A completed Riyadh month window [first day 00:00, next month 00:00). */
export function monthWindow(monthStart: Date): MetricWindow {
  const r = toRiyadh(monthStart);
  const next = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 1) - RIYADH_OFFSET_MS);
  return { kind: 'month', start: monthStart, end: next, partial: false, labelAr: `شهر ${fmt(monthStart).slice(0, 7)}` };
}

export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);
}

export function formatRiyadh(d: Date | string | null | undefined, withTime = true): string {
  if (!d) return 'غير متاح';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return date.toLocaleString('ar-SA-u-nu-latn', { timeZone: TIMEZONE, hour12: false, ...(withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) });
}
