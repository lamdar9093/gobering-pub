export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  
  return time;
}

export function formatTimeRange(startTime: string | null | undefined, endTime: string | null | undefined): string {
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  
  if (!start || !end) return '';
  
  return `${start} - ${end}`;
}
