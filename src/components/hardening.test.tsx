import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { executeAction } from '../core/actions';
import { createFixtures } from '../core/fixtures';
import { randomId } from '../core/id';
import { STORAGE_KEY } from '../core/storage';
import { defaultFilters, loadViews, saveViews } from '../core/views';
import { kyc } from '../modules/kyc';
import { ActivityView } from './ActivityView';
import { RecordDrawer } from './RecordDrawer';
import { ToolView } from './ToolView';

describe('local workbench integrity', () => {
  it('generates unique UUIDs and applies decisions without secure-context randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const ids = Array.from({ length: 1000 }, randomId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      ids.every((id) =>
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(id),
      ),
    ).toBe(true);
    const data = createFixtures();
    const next = executeAction(data, {
      moduleId: 'kyc',
      recordId: data.records.kyc[0].id,
      expectedVersion: 1,
      actionId: 'approve',
      reason: 'Fictional verification completed.',
    });
    expect(next.records.kyc[0].status).toBe('Approved');
    expect(data.records.kyc[0].status).toBe('Needs review');
    expect(next.activity).toHaveLength(1);
  });

  it('clears cancelled reasons between decisions, notes and assignments', async () => {
    const user = userEvent.setup();
    const record = createFixtures().records.kyc[0];
    const save = vi.fn();
    render(
      <RecordDrawer
        module={kyc}
        record={record}
        activity={[]}
        onClose={() => {}}
        onAction={save}
      />,
    );
    for (const label of ['Approve case', 'Reject case', 'Add note', 'Reassign owner']) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(screen.getByRole('button', { name: /^Confirm/ })).toBeDisabled();
      await user.type(screen.getByRole('textbox'), 'Cancelled fictional explanation.');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
    }
    expect(save).not.toHaveBeenCalled();
  });

  it('clears only transient write warnings after storage recovers', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    expect(
      await screen.findByText(/Changes will last only until this page is reloaded/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: `Open ${createFixtures().records.kyc[0].name}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByLabelText(/Note/), 'Retained after temporary storage failure.');
    writes.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    await waitFor(() =>
      expect(
        screen.queryByText(/Changes will last only until this page is reloaded/),
      ).not.toBeInTheDocument(),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity[0].reason).toBe(
      'Retained after temporary storage failure.',
    );
  });

  it('ignores duplicate same-tick submissions, retains failed input, and clears cancelled errors', async () => {
    const user = userEvent.setup();
    let finish!: (error: string) => void;
    const save = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <RecordDrawer
        module={kyc}
        record={createFixtures().records.kyc[0]}
        activity={[]}
        onClose={() => {}}
        onAction={save}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByLabelText(/Note/), 'Fictional draft to retain on failure.');
    const form = screen.getByLabelText(/Note/).closest('form')!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await act(async () => finish('Fictional save failed.'));
    expect(screen.getByRole('alert')).toHaveTextContent('Fictional save failed.');
    expect(screen.getByLabelText(/Note/)).toHaveValue('Fictional draft to retain on failure.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Reject case' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never overwrites blocked saved data when temporary mutations succeed', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    localStorage.setItem(STORAGE_KEY, 'unreadable-original-data');
    render(<App />);
    await user.click(
      screen.getByRole('button', { name: `Open ${createFixtures().records.kyc[0].name}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByLabelText(/Note/), 'Temporary note without replacing saved work.');
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('unreadable-original-data');
    expect(screen.getByText(/without overwriting it/)).toBeInTheDocument();
  });

  it('keeps session-only views across navigation and deletion without crossing tools', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    await user.type(screen.getByLabelText('View name'), 'Temporary queue');
    await user.click(screen.getByRole('button', { name: 'Save view locally' }));
    await user.click(screen.getByRole('link', { name: /Refunds/ }));
    expect(screen.queryByRole('button', { name: 'Temporary queue' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /KYC review/ }));
    expect(screen.getByRole('button', { name: 'Temporary queue' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete view Temporary queue' }));
    await user.click(screen.getByRole('link', { name: /Refunds/ }));
    await user.click(screen.getByRole('link', { name: /KYC review/ }));
    expect(screen.queryByRole('button', { name: 'Temporary queue' })).not.toBeInTheDocument();
  });

  it('isolates temporary view caches by account and persists them on a later successful save', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const views = [{ name: 'Alex only', filters: { ...defaultFilters } }];
    expect(saveViews('kyc', views, 'shared.alex')).toBe(false);
    views[0].filters.owner = 'Changed after save';
    expect(loadViews(kyc, 'shared.alex').views[0].filters.owner).toBe('all');
    expect(loadViews(kyc, 'shared.jamie').views).toEqual([]);
    expect(loadViews(kyc).views).toEqual([]);
    writes.mockRestore();
    expect(saveViews('kyc', loadViews(kyc, 'shared.alex').views, 'shared.alex')).toBe(true);
    expect(loadViews(kyc, 'shared.alex').warning).toBe('');
  });

  it('opens a record from anywhere on its row exactly once', () => {
    const record = createFixtures().records.kyc[0];
    const onSelect = vi.fn();
    render(<ToolView module={kyc} records={[record]} onSelect={onSelect} />);
    const row = screen.getByRole('button', { name: `Open ${record.name}` }).closest('tr')!;
    fireEvent.click(row.querySelector('.row-arrow')!);
    fireEvent.click(within(row).getByText(record.status));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(record);
    fireEvent.click(screen.getByRole('button', { name: `Open ${record.name}` }));
    expect(onSelect).toHaveBeenCalledTimes(3);
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => record.id,
    } as Selection);
    fireEvent.click(row.querySelector('.row-arrow')!);
    expect(onSelect).toHaveBeenCalledTimes(3);
    selection.mockRestore();
  });

  it('updates age labels and 48h eligibility without interaction and cleans up timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const record = createFixtures().records.kyc[0];
    record.openedAt = new Date(Date.now() - 48 * 3_600_000 + 60_000).toISOString();
    const view = render(<ToolView module={kyc} records={[record]} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Open 48h/ }));
    expect(screen.queryByRole('button', { name: `Open ${record.name}` })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('button', { name: `Open ${record.name}` })).toBeInTheDocument();
    expect(screen.getByText('2d 0h')).toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows notes without inventing a state transition in local Activity', () => {
    const data = createFixtures();
    const next = executeAction(data, {
      kind: 'note',
      moduleId: 'kyc',
      recordId: data.records.kyc[0].id,
      expectedVersion: 1,
      reason: 'Fictional context only.',
    });
    render(<ActivityView activity={next.activity} />);
    const item = screen.getByText('Note added').closest('article')!;
    expect(within(item).getByText(data.records.kyc[0].name)).toBeInTheDocument();
    expect(item.querySelector('.state-change')).toBeNull();
    expect(item).not.toHaveTextContent('→');
  });
});
