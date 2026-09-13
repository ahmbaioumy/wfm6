/**
 * Canonical Date & Calendar Utilities for Workforce Simulation Engine
 * 
 * Guarantees:
 * - Real calendar weekday resolution (e.g. 01/09/2026 is Tuesday, not Monday or index % 7).
 * - Multi-format support: DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, etc.
 * - Chronological date sorting using true UTC epoch timestamps.
 * - Accurate Business Operating Day mapping.
 */

import { ContractWeek } from '../types';

export const DAY_NAMES_SUN_FIRST = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const SHORT_DAY_NAMES_SUN_FIRST = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

export const DAY_NAMES_MON_FIRST = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const SHORT_DAY_NAMES_MON_FIRST = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

export interface ParsedDateComponents {
  year: number;
  month: number; // 1 to 12
  day: number;   // 1 to 31
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (JS Standard)
  dayName: string;   // 'Monday', 'Tuesday', etc.
  dayShort: string;  // 'Mon', 'Tue', etc.
  isoDate: string;   // 'YYYY-MM-DD'
  epochSeconds: number; // UTC midnight epoch seconds
}

/**
 * Normalizes time string to "HH:MM" format (24-hour)
 */
export function normalizeTimeString(timeStr: string): string {
  if (!timeStr) return '08:00';
  const trimmed = timeStr.trim();
  if (trimmed.length === 4 && !trimmed.includes(':') && /^\d{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}:${trimmed.slice(2)}`;
  }
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return `${Math.min(23, Math.max(0, h)).toString().padStart(2, '0')}:${Math.min(59, Math.max(0, m)).toString().padStart(2, '0')}`;
  }
  return trimmed || '08:00';
}

/**
 * Converts a time string (HH:MM) to minutes from midnight (0 - 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  const norm = normalizeTimeString(timeStr);
  const [h, m] = norm.split(':').map(v => parseInt(v, 10) || 0);
  return h * 60 + m;
}

/**
 * Converts minutes from midnight to HH:MM string format.
 */
export function minutesToTimeString(minutes: number): string {
  const normalized = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Parses date string with given format hint into structured date components.
 */
export function parseDateComponents(
  dateStr: string,
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): ParsedDateComponents {
  if (!dateStr || typeof dateStr !== 'string') {
    const fallback = new Date(Date.UTC(2026, 8, 1, 0, 0, 0));
    return {
      year: 2026,
      month: 9,
      day: 1,
      dayOfWeek: fallback.getUTCDay(),
      dayName: DAY_NAMES_SUN_FIRST[fallback.getUTCDay()],
      dayShort: SHORT_DAY_NAMES_SUN_FIRST[fallback.getUTCDay()],
      isoDate: '2026-09-01',
      epochSeconds: Math.floor(fallback.getTime() / 1000),
    };
  }

  const parts = dateStr.trim().split(/[-/.]/);
  let year = 2026;
  let month = 9; // 1-indexed
  let day = 1;

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10) || 2026;
      month = Math.max(1, Math.min(12, parseInt(parts[1], 10) || 1));
      day = Math.max(1, Math.min(31, parseInt(parts[2], 10) || 1));
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY or MM/DD/YYYY
      year = parseInt(parts[2], 10) || 2026;
      const p0 = parseInt(parts[0], 10) || 1;
      const p1 = parseInt(parts[1], 10) || 1;

      if (dateFormatHint === 'MDY') {
        month = Math.max(1, Math.min(12, p0));
        day = Math.max(1, Math.min(31, p1));
      } else if (dateFormatHint === 'DMY') {
        day = Math.max(1, Math.min(31, p0));
        month = Math.max(1, Math.min(12, p1));
      } else {
        // 'auto'
        if (p0 > 12) {
          day = p0;
          month = Math.max(1, Math.min(12, p1));
        } else if (p1 > 12) {
          month = Math.max(1, Math.min(12, p0));
          day = p1;
        } else {
          // Default to DMY for ambiguous numbers (e.g. 01/09/2026 -> 1st Sept)
          day = p0;
          month = Math.max(1, Math.min(12, p1));
        }
      }
    } else {
      // 2-digit year (e.g. 01/09/26)
      const p0 = parseInt(parts[0], 10) || 1;
      const p1 = parseInt(parts[1], 10) || 1;
      year = 2000 + (parseInt(parts[2], 10) || 26);

      if (dateFormatHint === 'MDY') {
        month = Math.max(1, Math.min(12, p0));
        day = Math.max(1, Math.min(31, p1));
      } else if (dateFormatHint === 'DMY') {
        day = Math.max(1, Math.min(31, p0));
        month = Math.max(1, Math.min(12, p1));
      } else {
        if (p0 > 12) {
          day = p0;
          month = Math.max(1, Math.min(12, p1));
        } else if (p1 > 12) {
          month = Math.max(1, Math.min(12, p0));
          day = p1;
        } else {
          day = p0;
          month = Math.max(1, Math.min(12, p1));
        }
      }
    }
  }

  // Create UTC date
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayOfWeek = utcDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayName = DAY_NAMES_SUN_FIRST[dayOfWeek];
  const dayShort = SHORT_DAY_NAMES_SUN_FIRST[dayOfWeek];
  const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const epochSeconds = Math.floor(utcDate.getTime() / 1000);

  return {
    year,
    month,
    day,
    dayOfWeek,
    dayName,
    dayShort,
    isoDate,
    epochSeconds,
  };
}

/**
 * Returns the real calendar weekday name for a date string.
 * Example: '01/09/2026' -> 'Tuesday'
 */
export function getDayNameFromDate(
  dateStr: string,
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): string {
  return parseDateComponents(dateStr, dateFormatHint).dayName;
}

/**
 * Returns the real calendar weekday short name for a date string.
 * Example: '01/09/2026' -> 'Tue'
 */
export function getDayShortFromDate(
  dateStr: string,
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): string {
  return parseDateComponents(dateStr, dateFormatHint).dayShort;
}

/**
 * Sorts date strings chronologically based on their true calendar epoch.
 */
export function sortDatesChronologically(
  dates: string[],
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): string[] {
  const parsed = dates.map(d => ({
    original: d,
    comp: parseDateComponents(d, dateFormatHint),
  }));

  parsed.sort((a, b) => a.comp.epochSeconds - b.comp.epochSeconds);
  return parsed.map(p => p.original);
}

/**
 * Checks if a date is a business operating day.
 * Matches against operatingDays list (which can contain 'Mon', 'Tue', 'Monday', 'Tuesday', etc.)
 */
export function isDateBusinessOperatingDay(
  dateStr: string,
  operatingDays?: string[],
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): boolean {
  if (!operatingDays || operatingDays.length === 0) return true; // Default: open all days

  const { dayName, dayShort } = parseDateComponents(dateStr, dateFormatHint);
  const normalizedSet = new Set(operatingDays.map(d => d.trim().toLowerCase()));

  return (
    normalizedSet.has(dayName.toLowerCase()) ||
    normalizedSet.has(dayShort.toLowerCase()) ||
    normalizedSet.has(dayShort.slice(0, 2).toLowerCase())
  );
}

/**
 * Checks if a date is marked as a company holiday.
 */
export function isDateHoliday(
  dateStr: string,
  holidayDates?: string[],
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): boolean {
  if (!holidayDates || holidayDates.length === 0) return false;

  const { isoDate } = parseDateComponents(dateStr, dateFormatHint);
  const normalizedHolidays = new Set(
    holidayDates.map(h => parseDateComponents(h, dateFormatHint).isoDate)
  );

  return normalizedHolidays.has(isoDate) || holidayDates.includes(dateStr);
}

/**
 * Groups a set of dates into true calendar contract weeks.
 * Supports configurable week start day (0 = Sunday, 1 = Monday, 6 = Saturday). Default: 1 (Monday).
 * Never uses array modulo or positional indexing.
 */
export function buildContractWeeks(
  dates: string[],
  weekStartsOn: number = 1, // 0 = Sun, 1 = Mon, 6 = Sat
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): ContractWeek[] {
  if (!dates || dates.length === 0) return [];

  // Sort unique dates chronologically
  const uniqueDates = Array.from(new Set(dates));
  const sortedDates = sortDatesChronologically(uniqueDates, dateFormatHint);

  // Group dates by week start epoch
  const weekMap = new Map<number, { startDate: string; dates: string[] }>();

  for (const dateStr of sortedDates) {
    const comp = parseDateComponents(dateStr, dateFormatHint);
    // JS getUTCDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfWeek = comp.dayOfWeek;
    const offsetFromWeekStart = (dayOfWeek - weekStartsOn + 7) % 7;
    const weekStartEpoch = comp.epochSeconds - offsetFromWeekStart * 86400;

    let weekEntry = weekMap.get(weekStartEpoch);
    if (!weekEntry) {
      const wStartDate = new Date(weekStartEpoch * 1000).toISOString().split('T')[0];
      weekEntry = { startDate: wStartDate, dates: [] };
      weekMap.set(weekStartEpoch, weekEntry);
    }
    weekEntry.dates.push(dateStr);
  }

  // Sort week groups chronologically
  const sortedEpochs = Array.from(weekMap.keys()).sort((a, b) => a - b);
  const result: ContractWeek[] = [];

  for (let idx = 0; idx < sortedEpochs.length; idx++) {
    const epoch = sortedEpochs[idx];
    const group = weekMap.get(epoch)!;
    const isFullWeek = group.dates.length === 7;
    const weekEndEpoch = epoch + 6 * 86400;
    const endDate = new Date(weekEndEpoch * 1000).toISOString().split('T')[0];

    result.push({
      weekIndex: idx,
      startDate: group.startDate,
      endDate,
      dates: group.dates,
      isFullWeek,
      type: isFullWeek ? 'FULL_WEEK' : 'PARTIAL_WEEK',
    });
  }

  return result;
}
