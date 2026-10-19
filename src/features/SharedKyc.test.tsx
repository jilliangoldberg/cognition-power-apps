import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createFixtures } from '../core/fixtures';
import { SharedKyc } from './SharedKyc';

const operator = { id: 'alex', name: 'Alex Morgan', email: 'alex@example.test', role: 'operator' };
function mockWorkspace(
  onSave: (body: {
    requestId: string;
    change: { reason: string; expectedVersion: number };
  }) => Response | Promise<Response>,
) {
  let authenticated = false;
  let read: (() => Response | Promise<Response>) | undefined;
  const records = createFixtures().records.kyc;
  records[0].owner = 'Alex Morgan';
  const data = { records, activity: [], owners: ['Unassigned', 'Alex Morgan', 'Jamie Brooks'] };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    if (path === '/api/login') {
      authenticated = true;
      return Response.json({ user: operator });
    }
    if (!authenticated) return Response.json({ error: 'Sign in' }, { status: 401 });
    if (path === '/api/kyc') return read ? read() : Response.json(data);
    if (path.startsWith('/api/sandbox/'))
      return Response.json({ error: 'Session expired' }, { status: 401 });
    if (path === '/api/kyc/changes') return onSave(JSON.parse(String(init?.body)));
    return Response.json({ user: operator });
  });
  return {
    data,
    fetcher,
    setRead: (next: typeof read) => {
      read = next;
    },
  };
}
async function signInAndAddNote() {
  const user = userEvent.setup();
  render(<SharedKyc />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
  await user.type(screen.getByLabelText('Password'), 'synthetic-test-password-only');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await user.click(
    await screen.findByRole('button', { name: `Open ${createFixtures().records.kyc[0].name}` }),
  );
  await user.click(screen.getByRole('button', { name: 'Add note' }));
  await user.type(screen.getByLabelText(/Note/), 'Fictional follow-up retained in form.');
  return user;
}

describe('shared KYC asynchronous saves (mock HTTP)', () => {
  function deferred() {
    let resolve!: (response: Response) => void;
    const promise = new Promise<Response>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }
  function saved(record = createFixtures().records.kyc[0]) {
    return {
      record: { ...record, version: record.version + 1 },
      event: {
        id: 'event-saved',
        moduleId: 'kyc',
        recordId: record.id,
        recordName: record.name,
        kind: 'note',
        action: 'Note added',
        reason: 'Fictional follow-up retained in form.',
        at: new Date().toISOString(),
        before: record.status,
        after: record.status,
        actorId: 'alex',
        actorName: 'Alex Morgan',
      },
    };
  }
  it('serializes refresh/logout behind a save and blocks duplicate submissions', async () => {
    const gate = deferred();
    const save = vi.fn(() => gate.promise);
    const workspace = mockWorkspace(save);
    const user = await signInAndAddNote();
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(screen.getByRole('button', { name: 'Refresh shared data' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText(/Note/).closest('form')!);
    expect(save).toHaveBeenCalledTimes(1);
    const result = saved(workspace.data.records[0]);
    await act(async () => gate.resolve(Response.json(result)));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved on server');
    expect(screen.getByText(result.event.reason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh shared data' })).toBeEnabled();
  });
  it('retains the draft and sends no save when a refresh is already pending', async () => {
    const save = vi.fn(() => Response.json(saved()));
    const workspace = mockWorkspace(save);
    const user = await signInAndAddNote();
    const gate = deferred();
    workspace.setRead(() => gate.promise);
    await user.click(screen.getByRole('button', { name: 'Refresh latest case (keep input)' }));
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another shared request is in progress',
    );
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Note/)).toHaveValue('Fictional follow-up retained in form.');
    const records = workspace.data.records.map((r, i) => (i ? r : { ...r, version: 2 }));
    await act(async () => gate.resolve(Response.json({ ...workspace.data, records })));
    expect(screen.getByRole('button', { name: 'Use refreshed version 2' })).toBeInTheDocument();
  });
  it('does not restore trusted data or success notices from a response arriving after expiry', async () => {
    const workspace = mockWorkspace(() => Response.json(saved()));
    const user = await signInAndAddNote();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    const gate = deferred();
    workspace.setRead(() => gate.promise);
    await user.click(screen.getByRole('button', { name: 'Refresh shared data' }));
    await user.type(screen.getByLabelText('Sandbox PaymentIntent ID'), 'pi_example');
    await user.click(screen.getByRole('button', { name: 'Retrieve sandbox snapshot' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to shared KYC' }),
    ).toBeInTheDocument();
    await act(async () => gate.resolve(Response.json(workspace.data)));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
    expect(screen.queryByText(/Shared data refreshed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('saves with a valid request UUID when secure-context randomUUID is absent', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    let requestId = '';
    mockWorkspace((body) => {
      requestId = body.requestId;
      return Response.json(saved());
    });
    const user = await signInAndAddNote();
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved on server');
    expect(requestId).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  });
  it('keeps input on unknown outcomes and retries with the same request ID', async () => {
    const saves: { requestId: string; change: { reason: string; expectedVersion: number } }[] = [];
    const workspace = mockWorkspace(async (body) => {
      saves.push(body);
      if (saves.length === 1) throw new TypeError('network lost');
      return Response.json({
        record: { ...workspace.data.records[0], version: 2 },
        event: {
          id: 'event-1',
          moduleId: 'kyc',
          recordId: workspace.data.records[0].id,
          recordName: 'Jordan Ellis',
          kind: 'note',
          action: 'Note added',
          reason: body.change.reason,
          at: new Date().toISOString(),
          before: 'Needs review',
          after: 'Needs review',
          actorName: 'Alex Morgan',
        },
      });
    });
    const user = await signInAndAddNote();
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('outcome unknown');
    expect(screen.getByLabelText(/Note/)).toHaveValue('Fictional follow-up retained in form.');
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved on server');
    expect(saves).toHaveLength(2);
    expect(saves[0].requestId).toBe(saves[1].requestId);
    expect(screen.getByText(/Alex Morgan ·/, { selector: 'small' })).toBeInTheDocument();
  });
  it('never silently rebases a conflict and retains text through an explicit refresh/review', async () => {
    const saves: { requestId: string; change: { reason: string; expectedVersion: number } }[] = [];
    const workspace = mockWorkspace((body) => {
      saves.push(body);
      return Response.json({ error: 'Case changed. Refresh latest case.' }, { status: 409 });
    });
    const user = await signInAndAddNote();
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Case changed');
    workspace.data.records[0].version = 2;
    await user.click(screen.getByRole('button', { name: 'Refresh latest case (keep input)' }));
    expect(screen.getByLabelText(/Note/)).toHaveValue('Fictional follow-up retained in form.');
    expect(saves).toHaveLength(1);
    await user.click(await screen.findByRole('button', { name: 'Use refreshed version 2' }));
    expect(saves).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(saves[1].change.expectedVersion).toBe(2);
    expect(saves[1].requestId).not.toBe(saves[0].requestId);
  });
});
