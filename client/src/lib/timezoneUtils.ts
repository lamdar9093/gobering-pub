import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format, parse, type Locale } from 'date-fns';
import { fr } from 'date-fns/locale';

export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function utcToLocal(utcDate: Date | string, timeZone?: string): Date {
  const tz = timeZone || getUserTimeZone();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, tz);
}

export function localToUtc(localDate: Date, timeZone?: string): Date {
  const tz = timeZone || getUserTimeZone();
  return fromZonedTime(localDate, tz);
}

export function localDateTimeToUtcISO(params: {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  timeZone?: string;
}): string {
  const { date, time, timeZone } = params;
  const tz = timeZone || getUserTimeZone();
  
  const localDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  const utcDate = fromZonedTime(localDateTime, tz);
  
  return utcDate.toISOString();
}

export function formatDateInTimeZone(
  date: Date | string,
  formatStr: string,
  timeZone?: string,
  locale?: Locale
): string {
  const tz = timeZone || getUserTimeZone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, tz, formatStr, { locale: locale || fr });
}

export function getTodayInTimeZone(timeZone?: string): Date {
  const tz = timeZone || getUserTimeZone();
  const now = new Date();
  const zonedNow = toZonedTime(now, tz);
  zonedNow.setHours(0, 0, 0, 0);
  return zonedNow;
}

export function getStartOfWeekInTimeZone(date: Date, timeZone?: string): Date {
  const tz = timeZone || getUserTimeZone();
  const zonedDate = toZonedTime(date, tz);
  const day = zonedDate.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(zonedDate);
  monday.setDate(zonedDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isSameDayInTimeZone(date1: Date | string, date2: Date | string, timeZone?: string): boolean {
  const tz = timeZone || getUserTimeZone();
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const zoned1 = toZonedTime(d1, tz);
  const zoned2 = toZonedTime(d2, tz);
  
  return (
    zoned1.getFullYear() === zoned2.getFullYear() &&
    zoned1.getMonth() === zoned2.getMonth() &&
    zoned1.getDate() === zoned2.getDate()
  );
}
