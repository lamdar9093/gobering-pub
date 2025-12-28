import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

export function convertDateFormat(dbFormat: string): string {
  switch (dbFormat) {
    case "dd/MM/yyyy":
      return "dd/MM/yyyy";
    case "MM/dd/yyyy":
      return "MM/dd/yyyy";
    case "yyyy-MM-dd":
      return "yyyy-MM-dd";
    default:
      return "dd/MM/yyyy";
  }
}

export function convertTimeFormat(dbFormat: string): string {
  return dbFormat === "12h" ? "h:mm a" : "HH:mm";
}

export function convertDateTimeFormat(dateFormat: string, timeFormat: string): string {
  const datePart = convertDateFormat(dateFormat);
  const timePart = convertTimeFormat(timeFormat);
  return `${datePart} ${timePart}`;
}

export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string
): string {
  if (!date) return "";
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return "";
  
  return format(dateObj, formatStr, { locale: fr });
}

export function formatDateTime(
  date: Date | string | null | undefined,
  dateFormat: string,
  timeFormat: string
): string {
  if (!date) return "";
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return "";
  
  const formatStr = convertDateTimeFormat(dateFormat, timeFormat);
  return format(dateObj, formatStr, { locale: fr });
}

export function formatDateInTz(
  date: Date | string | null | undefined,
  formatStr: string,
  timeZone: string = "America/Toronto"
): string {
  if (!date) return "";
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return "";
  
  return formatInTimeZone(dateObj, timeZone, formatStr, { locale: fr });
}

export function formatDateTimeInTz(
  date: Date | string | null | undefined,
  dateFormat: string,
  timeFormat: string,
  timeZone: string = "America/Toronto"
): string {
  if (!date) return "";
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return "";
  
  const formatStr = convertDateTimeFormat(dateFormat, timeFormat);
  return formatInTimeZone(dateObj, timeZone, formatStr, { locale: fr });
}
