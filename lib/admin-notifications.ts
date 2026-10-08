import type { Notification } from './contracts';

export type NotificationCategory = 'appeals' | 'reports' | 'system' | 'feedback';
export function notificationCategory(notification: Pick<Notification, 'href' | 'title'>): NotificationCategory {
  const category = new URL(notification.href || '/', 'https://travelmate.local').searchParams.get('category');
  if (category === 'appeals' || category === 'reports' || category === 'system' || category === 'feedback') return category;
  const title = notification.title.toLowerCase();
  if (title.includes('appeal')) return 'appeals';
  if (title.includes('feedback')) return 'feedback';
  if (title.includes('report')) return 'reports';
  return 'system';
}
export function notificationTarget(notification: Pick<Notification, 'href' | 'title'>): 'reports' | 'health' | 'feedback' {
  const category = notificationCategory(notification);
  return category === 'feedback' ? 'feedback' : category === 'system' ? 'health' : 'reports';
}
export function notificationDateGroup(date: string, now = new Date()): 'Today' | 'Yesterday' | 'Earlier' {
  const localDay = (value: Date) => new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  const day = localDay(new Date(date));
  return day === localDay(now) ? 'Today' : day === localDay(new Date(now.getTime() - 86400000)) ? 'Yesterday' : 'Earlier';
}

export function notificationFeedbackId(notification: Pick<Notification, 'href' | 'title'>): string | undefined {
  if (notificationCategory(notification) !== 'feedback') return undefined;
  const id = new URL(notification.href || '/', 'https://travelmate.local').searchParams.get('feedbackId');
  return id && id.length <= 200 ? id : undefined;
}
