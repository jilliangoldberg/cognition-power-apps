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

export const dateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

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
