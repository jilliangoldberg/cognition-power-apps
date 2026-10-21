import { describe, expect, it } from 'vitest';
import { ageLabel, countStatus, dateTime, initials, money } from './format';

describe('shared timestamp formatting v1-compatible call surface', () => {
  it('shows explicit UTC and year rather than silently using the viewer timezone', () => {
    expect(dateTime('2026-10-19T06:00:00Z')).toBe('Oct 19, 2026, 6:00 AM UTC');
    expect(dateTime('2026-10-19T08:00:00+02:00')).toBe(dateTime('2026-10-19T06:00:00Z'));
    expect(dateTime('2025-12-31T23:30:00-02:00')).toBe('Jan 1, 2026, 1:30 AM UTC');
  });

  it.each([undefined, '', 'not-a-timestamp', '2026-99-99T25:00:00Z'])(
    'does not render an invalid or missing timestamp (%s) as a source assertion',
    (input) => expect(dateTime(input)).toBe('Not recorded'),
  );

  it('leaves existing non-timestamp helper outputs unchanged', () => {
    expect(money(24995)).toBe('$249.95');
    expect(initials('Demo Operator')).toBe('DO');
    expect(countStatus([{ status: 'Pending' }, { status: 'Approved' }], 'Pending')).toBe(1);
    expect(ageLabel('2026-10-18T00:00:00Z', new Date('2026-10-19T06:00:00Z'))).toBe('1d 6h');
    expect(ageLabel(undefined)).toBe('Not recorded');
  });
});
