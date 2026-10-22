import type { CSSProperties } from 'react';

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  identity:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 9l2 2 4-4',
  refund: 'M3 10a9 9 0 1 1 1 8 M3 4v6h6 M12 7v10 M15 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9',
  flag: 'M4 22V3 M4 3c4-4 12 4 16 0v12c-4 4-12-4-16 0',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  chevron: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12 M18 6 6 18',
  check: 'M5 12l4 4L19 6',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  reset: 'M3 10a9 9 0 1 1 1 8 M3 4v6h6',
  box: 'M12 3 3 8l9 5 9-5-9-5z M3 8v9l9 5 9-5V8 M12 13v9',
  code: 'M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4z M8 12l3 3 5-6',
  clock: 'M12 6v6l4 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  card: 'M2 5h20v14H2z M2 10h20 M6 15h4',
  plus: 'M12 5v14 M5 12h14',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8z',
} as const;

export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className = '',
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
