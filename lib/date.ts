export function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function regenerationDraftDates(startDate: string, endDate: string, today = localDateInputValue()) {
  if (startDate >= today) return { startDate, endDate, movedForward: false };
  const duration = Math.floor((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000) + 1;
  const days = Number.isFinite(duration) ? Math.min(31, Math.max(1, duration)) : 7;
  return { startDate: today, endDate: addCalendarDays(today, days - 1), movedForward: true };
}
