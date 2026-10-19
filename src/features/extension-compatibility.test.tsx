import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordDrawer } from '../components/RecordDrawer';
import { createFixtures } from '../core/fixtures';
import { dateTime } from '../core/format';
import { STORAGE_KEY } from '../core/storage';
import { modules } from '../modules';
import App from '../App';
import { Investigation } from './Investigation';

const clock = new Date('2026-10-19T06:00:00Z');

describe('shared formatter upgrade across local modules and custom Investigation', () => {
  it.each(modules)(
    'uses the upgraded timestamp in the $id drawer without changing domain data',
    (module) => {
      const record = createFixtures(clock).records[module.id][0];
      const snapshot = structuredClone(record);
      render(
        <RecordDrawer
          module={module}
          record={record}
          activity={[]}
          onClose={vi.fn()}
          onAction={() => null}
        />,
      );
      expect(
        within(screen.getByRole('dialog')).getByText(
          `Version ${record.version} · Updated ${dateTime(record.updatedAt)}`,
        ),
      ).toHaveTextContent('2026');
      expect(
        screen.getByText(`Version ${record.version} · Updated ${dateTime(record.updatedAt)}`),
      ).toHaveTextContent('UTC');
      expect(record).toEqual(snapshot);
    },
  );

  it('uses the same shared timestamp for event and retrieval times in Investigation', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(clock);
      render(<Investigation />);
      fireEvent.click(screen.getByRole('button', { name: 'Investigate' }));
      expect(screen.getAllByText(`Last attempted: ${dateTime(clock.toISOString())}`)).toHaveLength(
        3,
      );
      expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(
        'Oct 19, 2026, 4:00 AM UTC',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not migrate or rewrite v2 saved work when rendering the upgraded custom page', () => {
    const data = createFixtures(clock);
    data.records.refunds[0].owner = 'Preserved local label';
    const raw = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, raw);
    window.location.hash = '#investigation';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Investigate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate retry Reconciliation reports' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(data.schemaVersion).toBe(2);
  });
});
