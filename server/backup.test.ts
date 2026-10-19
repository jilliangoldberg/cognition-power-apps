import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';

it('backs up a WAL database and restores its committed data without overwriting existing files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workbench-backup-'));
  const path = join(dir, 'source.sqlite');
  const target = join(dir, 'backup.sqlite');
  const store = new Store(path);
  try {
    const user = {
      id: 'alex',
      name: 'Alex Morgan',
      email: 'alex@example.test',
      role: 'operator' as const,
    };
    store.addUser(user, randomBytes(24).toString('hex'));
    store.mutate(user, randomUUID(), {
      kind: 'note',
      moduleId: 'kyc',
      recordId: 'KYC-1042',
      expectedVersion: 1,
      reason: 'Backup test synthetic note.',
    });
    const args = ['--import', 'tsx', 'server/backup.ts', target];
    const options = { env: { ...process.env, WORKBENCH_DB: path }, stdio: 'pipe' as const };
    execFileSync(process.execPath, args, options);
    expect(() => execFileSync(process.execPath, args, options)).toThrow();
    const restored = new Store(target);
    try {
      expect(restored.snapshot()).toEqual(store.snapshot());
    } finally {
      restored.close();
    }
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
