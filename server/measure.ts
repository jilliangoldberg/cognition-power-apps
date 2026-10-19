import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store } from './store';
import { createApp } from './app';

// A reproducible small local measurement, not a load or hosting-cost benchmark.
const directory = mkdtempSync(join(tmpdir(), 'workbench-measure-'));
const store = new Store(join(directory, 'measure.sqlite'));
const password = randomBytes(24).toString('hex');
store.addUser(
  { id: 'alex', name: 'Alex Morgan', email: 'alex@example.test', role: 'operator' },
  password,
);
const app = createApp(store, { origin: 'http://localhost:5173' });
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.on('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No measurement address');
const url = `http://127.0.0.1:${address.port}/api`;
const headers = { 'Content-Type': 'application/json', 'X-Workbench-Request': '1' };
const startCpu = process.cpuUsage();
const elapsed = performance.now();
try {
  const loginStart = performance.now();
  const login = await fetch(`${url}/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'alex@example.test', password }),
  });
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const loginMs = performance.now() - loginStart;
  const timings: Record<string, number[]> = { reads: [], writes: [] };
  const record = store.snapshot().records[0];
  for (const [kind, count] of [
    ['reads', 100],
    ['writes', 20],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const start = performance.now();
      const response = await fetch(`${url}${kind === 'reads' ? '/kyc' : '/kyc/changes'}`, {
        method: kind === 'reads' ? 'GET' : 'POST',
        headers: { ...headers, Cookie: cookie },
        body:
          kind === 'reads'
            ? undefined
            : JSON.stringify({
                requestId: randomUUID(),
                change: {
                  kind: 'note',
                  moduleId: 'kyc',
                  recordId: record.id,
                  expectedVersion: record.version + i,
                  reason: 'Synthetic operating-cost measurement.',
                },
              }),
      });
      if (!response.ok) throw new Error('Measurement request failed.');
      await response.json();
      timings[kind].push(performance.now() - start);
    }
  }
  const cpu = process.cpuUsage(startCpu);
  console.log(
    JSON.stringify(
      {
        context:
          'One local process; synthetic fixtures; 100 sequential authenticated reads + 20 notes; no live sandbox; includes tsx runtime overhead',
        node: process.version,
        loginMs,
        elapsedMs: performance.now() - elapsed,
        cpuMs: (cpu.user + cpu.system) / 1000,
        rssMiB: process.memoryUsage().rss / 1024 / 1024,
        databaseAndWalBytes: readdirSync(directory).reduce(
          (n, name) => n + statSync(join(directory, name)).size,
          0,
        ),
        latencies: Object.fromEntries(
          Object.entries(timings).map(([kind, values]) => {
            values.sort((a, b) => a - b);
            return [
              kind,
              {
                count: values.length,
                p50Ms: values[Math.floor(values.length * 0.5)],
                p95Ms: values[Math.floor(values.length * 0.95)],
              },
            ];
          }),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  rmSync(directory, { recursive: true });
}
