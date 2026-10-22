export function ageLabel(openedAt: string | undefined, now = new Date()): string {
  if (!openedAt) return 'Not recorded';
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(openedAt)) / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);

const timestampFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

export function dateTime(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return timestampFormat.format(new Date(value));
}

export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

export const countStatus = (records: { status: string }[], status: string) =>
  records.filter((r) => r.status === status).length;
