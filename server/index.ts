import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import express from 'express';
import { Store } from './store';
import { createApp } from './app';

const path = resolve(process.env.WORKBENCH_DB ?? '.workbench/workbench.sqlite');
const accounts = [
  ['alex', 'Alex Morgan', 'operator', 'DEMO_ALEX_PASSWORD'],
  ['jamie', 'Jamie Brooks', 'operator', 'DEMO_JAMIE_PASSWORD'],
  ['viewer', 'Demo Viewer', 'viewer', 'DEMO_VIEWER_PASSWORD'],
] as const;
if (process.argv.includes('--setup')) {
  for (const [, , , variable] of accounts) {
    const password = process.env[variable];
    if (!password || password.length < 12 || password.length > 128)
      throw new Error(
        `Set ${variable} to a unique 12–128 character password securely before setup.`,
      );
  }
  if (new Set(accounts.map(([, , , variable]) => process.env[variable])).size !== accounts.length)
    throw new Error('Use a different password for each demo account.');
}
if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN?.startsWith('https://'))
  throw new Error('Production requires an explicit HTTPS APP_ORIGIN and a TLS reverse proxy.');
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const store = new Store(path);
chmodSync(path, 0o600);
if (process.argv.includes('--setup')) {
  for (const [id, name, role, variable] of accounts) {
    const password = process.env[variable];
    if (!password) throw new Error(`Set ${variable} securely before setup.`);
    store.addUser({ id, name, email: `${id}@example.test`, role }, password);
  }
  store.close();
  console.log(
    'Demo accounts initialized; passwords are never printed. Existing accounts are unchanged.',
  );
} else {
  const app = createApp(store, {
    origin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    sandboxKey: process.env.STRIPE_TEST_KEY,
  });
  app.use(express.static(resolve('dist')));
  const server = app.listen(3001, '127.0.0.1', () =>
    console.log('Shared synthetic API listening on loopback port 3001.'),
  );
  const close = () =>
    server.close(() => {
      store.close();
      process.exit(0);
    });
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
