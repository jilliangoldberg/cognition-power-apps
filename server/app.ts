import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { ApiError, Store, type User } from './store';
import { createSandbox } from './sandbox';

const target = {
  moduleId: z.literal('kyc'),
  recordId: z.string().regex(/^KYC-\d+$/),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(5).max(500),
};
const command = z.discriminatedUnion('kind', [
  z.object({ ...target, kind: z.literal('assignment'), owner: z.string().max(100) }).strict(),
  z.object({ ...target, kind: z.literal('note') }).strict(),
  z
    .object({
      ...target,
      kind: z.literal('action'),
      actionId: z.enum(['approve', 'reject', 'escalate', 'resume', 'request-information']),
    })
    .strict(),
]);
const mutation = z.object({ requestId: z.string().uuid(), change: command }).strict();
const credentials = z
  .object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(128) })
  .strict();
const cookieName = 'workbench_session';
const tokenOf = (cookie = '') =>
  cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) ?? '';

export function createApp(
  store: Store,
  options: {
    origin: string;
    sandboxKey?: string;
    fetcher?: typeof fetch;
    allowInsecureLocalhost?: boolean;
  },
) {
  const app = express();
  app.disable('x-powered-by');
  const lookup = createSandbox(options.sandboxKey, options.fetcher);
  const url = new URL(options.origin);
  const origin = url.origin;
  const secure = url.protocol === 'https:';
  if (
    !secure &&
    !(
      options.allowInsecureLocalhost &&
      process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    throw new Error(
      'HTTPS is required. Plain HTTP needs explicit loopback-only development opt-in.',
    );
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
    path: '/api',
    maxAge: 8 * 3_600_000,
  };
  const requests = new Map<string, { count: number; until: number }>();
  app.use('/api', (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (
      !secure &&
      (!['localhost', '127.0.0.1'].includes(req.hostname) ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? ''))
    ) {
      res.status(403).json({ error: 'Plain HTTP is restricted to local development.' });
      return;
    }
    if (
      (req.get('Origin') && req.get('Origin') !== origin) ||
      (!['GET', 'HEAD'].includes(req.method) && req.get('X-Workbench-Request') !== '1')
    ) {
      res.status(403).json({ error: 'Same-origin JSON requests are required.' });
      return;
    }
    if (req.method === 'POST' && !req.is('application/json')) {
      res.status(415).json({ error: 'JSON required.' });
      return;
    }
    if (req.path === '/login' || req.path.startsWith('/sandbox/')) {
      const now = Date.now();
      for (const [key, value] of requests) if (value.until < now) requests.delete(key);
      const key = `${req.ip}/${req.path === '/login' ? 'login' : 'sandbox'}`;
      const budget = requests.get(key) ?? { count: 0, until: now + 15 * 60_000 };
      if (++budget.count > 30) {
        res
          .set('Retry-After', String(Math.ceil((budget.until - now) / 1000)))
          .status(429)
          .json({ error: 'Request budget exceeded. Try later.' });
        return;
      }
      requests.set(key, budget);
    }
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.post('/api/login', (req, res) => {
    const input = credentials.parse(req.body);
    const { token, user } = store.login(input.email, input.password);
    const old = tokenOf(req.headers.cookie);
    if (old) store.logout(old);
    res.cookie(cookieName, token, cookieOptions).json({ user });
  });
  app.use('/api', (req, res, next) => {
    try {
      res.locals.user = store.session(tokenOf(req.headers.cookie));
      next();
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/session', (_req, res) => res.json({ user: res.locals.user }));
  app.post('/api/logout', (req, res) => {
    store.logout(tokenOf(req.headers.cookie));
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });
  app.get('/api/kyc', (_req, res) => res.json(store.snapshot()));
  app.post('/api/kyc/changes', (req, res) => {
    const user = res.locals.user as User;
    if (user.role !== 'operator')
      throw new ApiError(403, 'Viewer accounts cannot change shared records.');
    const input = mutation.parse(req.body);
    res.json(store.mutate(user, input.requestId, input.change));
  });
  app.get('/api/sandbox/payment-intents/:id', async (req, res) => {
    if (!/^pi_[A-Za-z0-9]{1,100}$/.test(req.params.id))
      throw new ApiError(400, 'Use a bounded PaymentIntent ID beginning pi_.');
    res.json(await lookup(req.params.id));
  });
  app.use('/api', (_req, res) =>
    res
      .status(404)
      .json({ error: 'Unknown API resource. No other tools or environments are exposed.' }),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    void _next;
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : error?.type === 'entity.too.large'
            ? 413
            : 500;
    res.status(status).json({
      error:
        error instanceof ApiError
          ? error.message
          : status === 400
            ? 'Invalid request. Check the allowed fields and values.'
            : 'Request could not be completed. No success is implied.',
    });
  };
  app.use(errors);
  return app;
}
