import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createFixtures } from '../src/core/fixtures';
import { executeAction, type MutationRequest } from '../src/core/actions';
import type { Activity, DemoState, ToolRecord } from '../src/core/types';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'operator' | 'viewer';
}
export interface SharedEvent extends Activity {
  actorId: string;
  actorName: string;
  requestId: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const passwordHash = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString('hex');

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000',
    );
    const version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number })
      .user_version;
    if (version > 1) {
      this.db.close();
      throw new Error('Unsupported database version; original database preserved.');
    }
    if (version === 0) {
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('operator','viewer')), salt TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
        CREATE TABLE cases(id TEXT PRIMARY KEY, version INTEGER NOT NULL, record TEXT NOT NULL);
        CREATE TABLE history(id INTEGER PRIMARY KEY, event TEXT NOT NULL);
        CREATE TABLE commands(actor_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor_id, request_id));
        PRAGMA user_version=1;`);
      try {
        for (const record of createFixtures().records.kyc) {
          const seeded = {
            ...record,
            owner: record.owner === 'You' ? 'Alex Morgan' : record.owner,
          };
          this.db
            .prepare('INSERT INTO cases VALUES(?,?,?)')
            .run(record.id, record.version, JSON.stringify(seeded));
        }
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
  }
  close() {
    this.db.close();
  }
  addUser(user: User, password: string) {
    if (password.length < 12 || password.length > 128)
      throw new Error('Demo passwords must be 12–128 characters.');
    const salt = randomBytes(16).toString('hex');
    this.db
      .prepare(
        'INSERT INTO users(id,name,email,role,salt,hash) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
      )
      .run(
        user.id,
        user.name,
        user.email.toLowerCase(),
        user.role,
        salt,
        passwordHash(password, salt),
      );
  }
  login(email: string, password: string): { token: string; user: User } {
    const row = this.db
      .prepare('SELECT * FROM users WHERE email=? AND active=1')
      .get(email.toLowerCase()) as (User & { salt: string; hash: string }) | undefined;
    const actual = passwordHash(password, row?.salt ?? 'unknown-demo-user');
    if (!row || !timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(row.hash, 'hex')))
      throw new ApiError(401, 'Email or password is incorrect.');
    const token = randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    this.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(digest(token), row.id, Date.now() + 8 * 3_600_000);
    return { token, user: { id: row.id, name: row.name, email: row.email, role: row.role } };
  }
  session(token: string): User {
    const user = this.db
      .prepare(
        'SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>? AND u.active=1',
      )
      .get(digest(token), Date.now()) as User | undefined;
    if (!user) throw new ApiError(401, 'Sign in to the shared synthetic workspace.');
    return user;
  }
  logout(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
  }
  owners(): string[] {
    return [
      'Unassigned',
      ...(
        this.db
          .prepare("SELECT name FROM users WHERE active=1 AND role='operator' ORDER BY name")
          .all() as { name: string }[]
      ).map((user) => user.name),
    ];
  }
  snapshot() {
    return {
      records: (
        this.db.prepare('SELECT record FROM cases ORDER BY id DESC').all() as { record: string }[]
      ).map((row) => JSON.parse(row.record) as ToolRecord),
      activity: (
        this.db.prepare('SELECT event FROM history ORDER BY id DESC').all() as { event: string }[]
      ).map((row) => JSON.parse(row.event) as SharedEvent),
      owners: this.owners(),
    };
  }
  mutate(actor: User, requestId: string, request: MutationRequest) {
    if (actor.role !== 'operator')
      throw new ApiError(403, 'Viewer accounts cannot change shared records.');
    const fingerprint = digest(JSON.stringify(request));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.db
        .prepare('SELECT fingerprint,result FROM commands WHERE actor_id=? AND request_id=?')
        .get(actor.id, requestId) as { fingerprint: string; result: string } | undefined;
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ApiError(409, 'This request ID was already used for different input.');
        this.db.exec('COMMIT');
        return JSON.parse(previous.result) as { record: ToolRecord; event: SharedEvent };
      }
      const row = this.db.prepare('SELECT record FROM cases WHERE id=?').get(request.recordId) as
        | { record: string }
        | undefined;
      if (!row) throw new ApiError(404, 'Case not found.');
      const record = JSON.parse(row.record) as ToolRecord;
      if (record.version !== request.expectedVersion)
        throw new ApiError(
          409,
          'Case changed. Refresh latest case, review its details, then explicitly use the refreshed version; your input is retained.',
        );
      if (request.kind === 'assignment' && !this.owners().includes(request.owner))
        throw new ApiError(400, 'Choose an active operator or Unassigned.');
      const state: DemoState = {
        schemaVersion: 2,
        records: { kyc: [record], refunds: [], flags: [] },
        activity: [],
      };
      let next: DemoState;
      try {
        next = executeAction(state, request, new Date(), this.owners());
      } catch (error) {
        throw new ApiError(400, error instanceof Error ? error.message : 'Invalid change.');
      }
      const updated = next.records.kyc[0];
      const event: SharedEvent = {
        ...next.activity[0],
        actorId: actor.id,
        actorName: actor.name,
        requestId,
      };
      const changed = this.db
        .prepare('UPDATE cases SET version=?,record=? WHERE id=? AND version=?')
        .run(updated.version, JSON.stringify(updated), updated.id, request.expectedVersion);
      if (Number(changed.changes) !== 1)
        throw new ApiError(409, 'Case changed. Refresh before retrying.');
      this.db.prepare('INSERT INTO history(event) VALUES(?)').run(JSON.stringify(event));
      const result = { record: updated, event };
      this.db
        .prepare('INSERT INTO commands VALUES(?,?,?,?)')
        .run(actor.id, requestId, fingerprint, JSON.stringify(result));
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
