import type { Tone } from '../core/types';

export function Badge({
  label,
  tone = 'neutral',
  dot = true,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="status-dot" />}
      {label}
    </span>
  );
}
