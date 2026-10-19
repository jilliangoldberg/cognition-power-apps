import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';

it('provisions demo identities via the CLI without default passwords or implicit credential reset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workbench-setup-'));
  const path = join(dir, 'test.sqlite');
  const env = {
    ...process.env,
    WORKBENCH_DB: path,
    DEMO_ALEX_PASSWORD: randomBytes(24).toString('hex'),
    DEMO_JAMIE_PASSWORD: randomBytes(24).toString('hex'),
    DEMO_VIEWER_PASSWORD: randomBytes(24).toString('hex'),
  };
  const args = ['--import', 'tsx', 'server/index.ts', '--setup'];
  try {
    const output = execFileSync(process.execPath, args, { env, encoding: 'utf8' });
    expect(output).not.toContain(env.DEMO_ALEX_PASSWORD);
    execFileSync(process.execPath, args, {
      env: { ...env, DEMO_ALEX_PASSWORD: randomBytes(24).toString('hex') },
      stdio: 'pipe',
    });
    const db = new Store(path);
    try {
      expect(db.login('alex@example.test', env.DEMO_ALEX_PASSWORD).user.role).toBe('operator');
      expect(db.login('jamie@example.test', env.DEMO_JAMIE_PASSWORD).user.role).toBe('operator');
      expect(db.login('viewer@example.test', env.DEMO_VIEWER_PASSWORD).user.role).toBe('viewer');
      expect(db.snapshot().activity).toHaveLength(0);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});
