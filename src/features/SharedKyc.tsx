import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SharedEvent, User } from '../../server/store';
import type { ToolRecord } from '../core/types';
import type { MutationRequest } from '../core/actions';
import { kyc } from '../modules/kyc';
import { ToolView } from '../components/ToolView';
import { RecordDrawer } from '../components/RecordDrawer';
import { api, HttpError } from './api';
import { SandboxLookup } from './SandboxLookup';

interface Snapshot {
  records: ToolRecord[];
  activity: SharedEvent[];
  owners: string[];
}
export function SharedKyc() {
  const [user, setUser] = useState<User | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [email, setEmail] = useState('alex@example.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const pending = useRef<{ body: string; id: string } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([api<{ user: User }>('/session'), api<Snapshot>('/kyc')])
      .then(([session, data]) => {
        if (active) {
          setUser(session.user);
          setSnapshot(data);
        }
      })
      .catch((e) => {
        if (active && !(e instanceof HttpError && e.status === 401))
          setError(
            'Shared API unavailable. Start and configure the server; local demo tools still work.',
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setSnapshot(await api<Snapshot>('/kyc'));
      setNotice(
        'Shared data refreshed. Review changed details before explicitly using the refreshed version in an open form.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed.');
      if (e instanceof HttpError && e.status === 401) {
        setUser(null);
        setSnapshot(null);
        setSelected(null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await api<{ user: User }>('/login', { email, password });
      setPassword('');
      const data = await api<Snapshot>('/kyc');
      setUser(session.user);
      setSnapshot(data);
      pending.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/logout', {});
      setUser(null);
      setSnapshot(null);
      setSelected(null);
      pending.current = null;
    } catch {
      setError('Could not confirm sign-out. Retry to invalidate the server session.');
    } finally {
      setBusy(false);
    }
  }
  async function change(request: MutationRequest) {
    const normalized = { ...request, kind: request.kind ?? 'action' };
    const body = JSON.stringify(normalized);
    if (pending.current?.body !== body) pending.current = { body, id: crypto.randomUUID() };
    try {
      const result = await api<{ record: ToolRecord; event: SharedEvent }>('/kyc/changes', {
        requestId: pending.current.id,
        change: normalized,
      });
      setSnapshot(
        (current) =>
          current && {
            ...current,
            records: current.records.map((r) =>
              r.id === result.record.id && r.version < result.record.version ? result.record : r,
            ),
            activity: current.activity.some((e) => e.id === result.event.id)
              ? current.activity
              : [result.event, ...current.activity],
          },
      );
      pending.current = null;
      setNotice('Saved on server with authenticated history. Other users can refresh to see it.');
      return null;
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        setUser(null);
        setSnapshot(null);
        setSelected(null);
        pending.current = null;
      }
      return e instanceof HttpError
        ? e.message
        : 'Save response unavailable; outcome unknown. Retry unchanged input before closing or reloading to resolve its outcome.';
    }
  }
  const module = {
    ...kyc,
    title: 'Shared KYC sandbox',
    shortTitle: 'Shared KYC',
    owners: snapshot?.owners ?? [],
    notice:
      'Shared synthetic data on this server. Signed-in operators can change cases; viewers cannot. No provider verification, customer messaging, or production accounts.',
    actions: kyc.actions.map((action) => ({
      ...action,
      confirmation: action.confirmation
        .replaceAll('local demo', 'shared synthetic workspace')
        .replaceAll('local handoff', 'shared handoff'),
    })),
  };
  const record = snapshot?.records.find((r) => r.id === selected);
  return (
    <section className="custom-page">
      <p className="eyebrow">NARROW MULTI-USER FOUNDATION · ONE SYNTHETIC WORKSPACE</p>
      <p>
        The original KYC/Refunds/Flags pages remain browser-local. This separate KYC slice uses the
        server database. Local resets never reset shared records. Password demo accounts are not
        enterprise SSO.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!user ? (
        <>
          <h1>Sign in to shared KYC</h1>
          <p>
            Accounts: alex@example.test and jamie@example.test (operators), viewer@example.test
            (read-only). Passwords must be configured securely with server setup; there are no
            built-in passwords.
          </p>
          <form className="shared-login" onSubmit={login}>
            <label htmlFor="shared-email">Email</label>
            <input
              id="shared-email"
              type="email"
              autoComplete="username"
              value={email}
              required
              maxLength={200}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="shared-password">Password</label>
            <input
              id="shared-password"
              type="password"
              autoComplete="current-password"
              value={password}
              required
              maxLength={128}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="toolbar">
            <strong>
              {user.name} · {user.role}
            </strong>
            <button className="button button-secondary" onClick={refresh} disabled={busy}>
              Refresh shared data
            </button>
            <button className="button button-secondary" onClick={logout} disabled={busy}>
              Sign out
            </button>
          </div>
          <p>
            No live collaboration: refresh to see other people’s changes. Stale forms are rejected
            on the server, not silently overwritten.
          </p>
          {snapshot && (
            <ToolView
              key={user.id}
              module={module}
              records={snapshot.records}
              currentOwner={user.name}
              viewNamespace={`shared.${user.id}`}
              onSelect={(r) => setSelected(r.id)}
            />
          )}
          {record && snapshot && (
            <RecordDrawer
              key={record.id}
              module={module}
              record={record}
              activity={snapshot.activity.filter((e) => e.recordId === record.id)}
              persistence="shared"
              readOnly={user.role === 'viewer'}
              onClose={() => setSelected(null)}
              onAction={change}
              onRefresh={refresh}
            />
          )}
          <SandboxLookup
            onUnauthorized={() => {
              setUser(null);
              setSnapshot(null);
              setSelected(null);
              setError('Session expired. Sign in again.');
            }}
          />
        </>
      )}
    </section>
  );
}
