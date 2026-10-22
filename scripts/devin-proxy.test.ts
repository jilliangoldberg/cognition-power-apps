import { describe, expect, it, vi } from 'vitest';
import { COOLDOWN_MS, createSender, isSameOrigin, MAX_PER_RUN } from './devin-proxy';

const prompt = 'A dashboard for Support leads that shows refunds per day, so they can spot spikes.';
const env = { apiKey: 'cog_secret_value', orgId: 'org-abc123' };
const ok = () =>
  vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ session_id: 'devin-1', url: 'https://app.devin.ai/sessions/1' }),
        ),
    );

function clock() {
  let t = 1_000_000;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

describe('Devin dev-server proxy', () => {
  it.each([
    [{}, false],
    [{ apiKey: ' ', orgId: 'org-abc' }, false],
    [{ apiKey: 'k', orgId: 'abc' }, false],
    [{ apiKey: 'k', orgId: 'org-abc/../x' }, false],
    [env, true],
  ])('is enabled only with a key and a valid org id: %j', async (config, enabled) => {
    const fetchImpl = ok();
    const sender = createSender(config, fetchImpl);
    expect(sender.enabled).toBe(enabled);
    if (!enabled) {
      expect((await sender.send({ prompt })).status).toBe(503);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('creates a capped v3 session with the wrapped request and returns only the link', async () => {
    const fetchImpl = ok();
    const reply = await createSender(env, fetchImpl).send({ prompt, kind: 'dashboard' });
    expect(reply).toEqual({
      status: 200,
      body: { url: 'https://app.devin.ai/sessions/1', sessionId: 'devin-1' },
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.devin.ai/v3/organizations/org-abc123/sessions');
    expect(init.headers.Authorization).toBe('Bearer cog_secret_value');
    const body = JSON.parse(init.body);
    expect(body.prompt).toContain(prompt);
    expect(body.prompt).toContain('(dashboard)');
    expect(body.prompt).toContain('Use fictional sample data only.');
    expect(body).toMatchObject({ max_acu_limit: 10, tags: ['workbench-new-tool'] });
  });

  it.each([
    ['25', 25],
    ['0', 10],
    ['2.5', 10],
    ['1000', 10],
    ['lots', 10],
  ])('reads DEVIN_MAX_ACU=%j as %i', (maxAcu, expected) => {
    expect(createSender({ ...env, maxAcu }).maxAcu).toBe(expected);
  });

  it.each([null, 'text', {}, { prompt: 42 }, { prompt: 'too short' }, { prompt: '[who] [what]' }])(
    'rejects %j without calling the API',
    async (input) => {
      const fetchImpl = ok();
      expect((await createSender(env, fetchImpl).send(input)).status).toBe(400);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('ignores an unknown kind instead of putting it in the request', async () => {
    const fetchImpl = ok();
    await createSender(env, fetchImpl).send({ prompt, kind: '<script>' });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.prompt).toContain('## What the requester wants\n');
    expect(body.prompt).not.toContain('<script>');
  });

  it('starts one session per click even when two requests race', async () => {
    let finish!: (value: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)));
    const sender = createSender(env, fetchImpl as unknown as typeof fetch);
    const first = sender.send({ prompt });
    expect((await sender.send({ prompt })).status).toBe(429);
    finish(new Response(JSON.stringify({ url: 'https://app.devin.ai/sessions/1' })));
    expect((await first).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it(`enforces a cooldown and at most ${MAX_PER_RUN} sessions per run`, async () => {
    const { now, tick } = clock();
    const sender = createSender(env, ok(), now);
    for (let i = 0; i < MAX_PER_RUN; i += 1) {
      expect((await sender.send({ prompt })).status).toBe(200);
      if (i < MAX_PER_RUN - 1)
        expect((await sender.send({ prompt })).body.error).toMatch(/Wait a minute/);
      tick(COOLDOWN_MS);
    }
    expect((await sender.send({ prompt })).body.error).toMatch(/Restart npm run dev/);
  });

  it('frees the slot after an API error and never echoes the key', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"detail":"cog_secret_value bad"}', { status: 401 }))
      .mockRejectedValueOnce(new Error('offline cog_secret_value'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://evil.example/x' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://app.devin.ai/s/2' })));
    const sender = createSender(env, fetchImpl);
    const replies = [];
    for (let i = 0; i < 3; i += 1) replies.push(await sender.send({ prompt }));
    expect(replies.map((r) => r.status)).toEqual([502, 502, 502]);
    expect(replies[0].body.error).toMatch(/Check DEVIN_API_KEY and DEVIN_ORG_ID/);
    expect(JSON.stringify(replies)).not.toContain('cog_secret_value');
    // An unexpected link may still mean a session started, so that slot stays used.
    expect((await sender.send({ prompt })).status).toBe(429);
  });

  it.each([
    ['http://localhost:5173', 'localhost:5173', true],
    ['https://preview.devinapps.com', 'preview.devinapps.com', true],
    ['https://evil.example', 'localhost:5173', false],
    [undefined, 'localhost:5173', false],
    ['not a url', 'localhost:5173', false],
  ])('treats origin %j for host %j as same-origin: %s', (origin, host, expected) => {
    expect(isSameOrigin(origin, host)).toBe(expected);
  });
});
