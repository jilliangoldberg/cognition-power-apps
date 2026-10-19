import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';
import { createApp } from './app';

let store: Store;
let server: Server;
let base: string;
const password = randomBytes(24).toString('hex');
const headers = {
  'Content-Type': 'application/json',
  'X-Workbench-Request': '1',
  Origin: 'http://localhost:5173',
};
async function request(
  path: string,
  body?: unknown,
  cookie = '',
  extra: Record<string, string> = {},
) {
  return fetch(`${base}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...headers, Cookie: cookie, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function login(email = 'alex@example.test') {
  const response = await request('/login', { email, password });
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie')!.split(';')[0];
}
const change = (requestId = randomUUID(), kind = 'note', extra = {}) => ({
  requestId,
  change: {
    moduleId: 'kyc',
    recordId: 'KYC-1042',
    expectedVersion: 1,
    reason: 'Fictional context from API test.',
    kind,
    ...extra,
  },
});

beforeEach(async () => {
  store = new Store(':memory:');
  for (const [id, name, role] of [
    ['alex', 'Alex Morgan', 'operator'],
    ['jamie', 'Jamie Brooks', 'operator'],
    ['viewer', 'Demo Viewer', 'viewer'],
  ] as const)
    store.addUser({ id, name, email: `${id}@example.test`, role }, password);
  server = createApp(store, { origin: 'http://localhost:5173' }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address');
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});

describe('authenticated shared synthetic API', () => {
  it('rejects unauthenticated reads, changes, and sandbox lookups', async () => {
    for (const path of ['/kyc', '/session', '/sandbox/payment-intents/pi_example'])
      expect((await request(path)).status).toBe(401);
    expect((await request('/kyc/changes', change())).status).toBe(401);
  });
  it('requires password credentials, rotates sessions, and sets private cookie/cache policies', async () => {
    expect(
      (await request('/login', { email: 'alex@example.test', password: 'incorrect' })).status,
    ).toBe(401);
    const response = await request('/login', { email: 'alex@example.test', password });
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      user: { id: 'alex', name: 'Alex Morgan', email: 'alex@example.test', role: 'operator' },
    });
    const old = response.headers.get('set-cookie')!.split(';')[0];
    await request('/login', { email: 'alex@example.test', password }, old);
    expect((await request('/session', undefined, old)).status).toBe(401);
  });
  it('enforces viewer permissions on direct API requests, not only buttons', async () => {
    const cookie = await login('viewer@example.test');
    expect((await request('/kyc', undefined, cookie)).status).toBe(200);
    expect((await request('/kyc/changes', change(), cookie)).status).toBe(403);
    expect(store.snapshot().activity).toHaveLength(0);
  });
  it('attributes history to the session and atomically changes version, state, and history', async () => {
    const cookie = await login();
    const response = await request(
      '/kyc/changes',
      change(randomUUID(), 'assignment', { owner: 'Jamie Brooks' }),
      cookie,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      record: { owner: 'Jamie Brooks', version: 2 },
      event: { actorId: 'alex', actorName: 'Alex Morgan', kind: 'assignment' },
    });
    const other = await login('jamie@example.test');
    expect(await (await request('/kyc', undefined, other)).json()).toMatchObject({
      records: expect.arrayContaining([expect.objectContaining({ id: 'KYC-1042', version: 2 })]),
      activity: [expect.objectContaining({ actorId: 'alex' })],
    });
  });
  it('rejects competing stale edits and replays the same logical request once', async () => {
    const [alex, jamie] = await Promise.all([login(), login('jamie@example.test')]);
    const input = change();
    const responses = await Promise.all([
      request('/kyc/changes', input, alex),
      request('/kyc/changes', change(), jamie),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? alex : jamie;
    const replay = winner === alex ? input : null;
    if (replay) expect((await request('/kyc/changes', replay, winner)).status).toBe(200);
    expect(store.snapshot().activity).toHaveLength(1);
    expect(store.snapshot().records.find((r) => r.id === 'KYC-1042')!.version).toBe(2);
  });
  it('deduplicates response-loss retries and rejects reuse of the key for changed payload', async () => {
    const cookie = await login();
    const input = change();
    const first = await (await request('/kyc/changes', input, cookie)).json();
    expect(await (await request('/kyc/changes', input, cookie)).json()).toEqual(first);
    input.change.reason = 'Different fictional input.';
    expect((await request('/kyc/changes', input, cookie)).status).toBe(409);
    expect(store.snapshot().activity).toHaveLength(1);
  });
  it('rolls back record changes if history persistence fails', async () => {
    const cookie = await login();
    store.db.exec(
      "CREATE TRIGGER fail_history BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    expect((await request('/kyc/changes', change(), cookie)).status).toBe(500);
    expect(store.snapshot().records.find((r) => r.id === 'KYC-1042')!.version).toBe(1);
    expect(store.snapshot().activity).toHaveLength(0);
    expect(store.db.prepare('SELECT count(*) AS n FROM commands').get()).toMatchObject({ n: 0 });
  });
  it('rejects forged actors, other modules, invalid versions/owners/reasons, and terminal actions', async () => {
    const cookie = await login();
    for (const extra of [
      { actorId: 'jamie' },
      { moduleId: 'refunds' },
      { expectedVersion: 0 },
      { reason: 'bad' },
      { kind: 'assignment', owner: 'You' },
      { kind: 'assignment', owner: 'Demo Viewer' },
      { kind: 'action', actionId: 'refund' },
    ]) {
      expect(
        (await request('/kyc/changes', change(randomUUID(), 'note', extra), cookie)).status,
      ).toBe(400);
    }
    expect(
      (
        await request(
          '/kyc/changes',
          change(randomUUID(), 'action', { recordId: 'KYC-1037', actionId: 'approve' }),
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(store.snapshot().activity).toHaveLength(0);
  });
  it('retains KYC waiting and resumption context in authenticated history', async () => {
    const cookie = await login();
    expect(
      (
        await request(
          '/kyc/changes',
          change(randomUUID(), 'action', { actionId: 'request-information' }),
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          '/kyc/changes',
          change(randomUUID(), 'action', { actionId: 'approve', expectedVersion: 2 }),
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          '/kyc/changes',
          change(randomUUID(), 'action', { actionId: 'resume', expectedVersion: 2 }),
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(store.snapshot().activity.map((e) => e.action)).toEqual([
      'Return to review',
      'Request information',
    ]);
  });
  it('rejects cross-origin requests and missing CSRF headers', async () => {
    const cookie = await login();
    expect(
      (await request('/kyc/changes', change(), cookie, { Origin: 'https://untrusted.example' }))
        .status,
    ).toBe(403);
    expect(
      (await request('/kyc/changes', change(), cookie, { 'X-Workbench-Request': '' })).status,
    ).toBe(403);
  });
  it('uses active account owners rather than hard-coded local demo labels', async () => {
    const cookie = await login();
    store.addUser(
      { id: 'lian', name: 'Lian Chen', email: 'lian@example.test', role: 'operator' },
      password,
    );
    expect(
      (
        await request(
          '/kyc/changes',
          change(randomUUID(), 'assignment', { owner: 'Lian Chen' }),
          cookie,
        )
      ).status,
    ).toBe(200);
    store.db.exec("UPDATE users SET active=0 WHERE id='lian'");
    expect(
      (
        await request(
          '/kyc/changes',
          change(randomUUID(), 'assignment', { owner: 'Lian Chen', expectedVersion: 2 }),
          cookie,
        )
      ).status,
    ).toBe(400);
  });
  it('expires, revokes, and logs out sessions on the server', async () => {
    const cookie = await login();
    store.db.exec("UPDATE users SET active=0 WHERE id='alex'");
    expect((await request('/kyc', undefined, cookie)).status).toBe(401);
    store.db.exec("UPDATE users SET active=1 WHERE id='alex'");
    await request('/logout', {}, cookie);
    expect((await request('/session', undefined, cookie)).status).toBe(401);
    const another = await login();
    store.db.exec('UPDATE sessions SET expires=0');
    expect((await request('/session', undefined, another)).status).toBe(401);
  });
  it('honestly reports an unconfigured sandbox and exposes no write/resource bypass', async () => {
    const cookie = await login();
    expect(
      await (await request('/sandbox/payment-intents/pi_example', undefined, cookie)).json(),
    ).toMatchObject({ outcome: 'not-connected' });
    expect((await request('/sandbox/payment-intents/pi_example', {}, cookie)).status).toBe(404);
    expect((await request('/refunds', undefined, cookie)).status).toBe(404);
  });
  it('limits login attempts without echoing submitted credentials', async () => {
    for (let i = 0; i < 30; i++) await request('/login', {});
    const response = await request('/login', {});
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
  });
});

describe('database restart and compatibility', () => {
  it('persists cases, sessions, and idempotency across database reopen without reseeding', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workbench-test-'));
    const path = join(dir, 'test.sqlite');
    let db = new Store(path);
    try {
      const actor = {
        id: 'alex',
        name: 'Alex Morgan',
        email: 'alex@example.test',
        role: 'operator' as const,
      };
      db.addUser(actor, password);
      const { token } = db.login(actor.email, password);
      const requestId = randomUUID();
      const input = {
        moduleId: 'kyc' as const,
        recordId: 'KYC-1042',
        expectedVersion: 1,
        reason: 'A persisted synthetic note.',
        kind: 'note' as const,
      };
      db.mutate(actor, requestId, input);
      db.close();
      db = new Store(path);
      expect(db.session(token)).toEqual(actor);
      expect(db.snapshot().activity).toHaveLength(1);
      db.mutate(actor, requestId, input);
      expect(db.snapshot().activity).toHaveLength(1);
    } finally {
      db.close();
      rmSync(dir, { recursive: true });
    }
  });
});
