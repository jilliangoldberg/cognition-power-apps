import { describe, expect, it, vi } from 'vitest';
import { createSandbox } from './sandbox';

const key = 'rk_test_synthetic_not_a_credential';
const payment = {
  id: 'pi_example',
  object: 'payment_intent',
  livemode: false,
  amount: 12345,
  currency: 'usd',
  created: 1700000000,
  status: 'processing',
  client_secret: 'must-not-leave-server',
  receipt_email: 'not-exposed@example.test',
};
describe('read-only Stripe test adapter contract (mock transport, not live proof)', () => {
  it('does not call a provider when unconfigured and rejects live/publishable keys', async () => {
    const fetcher = vi.fn();
    expect(await createSandbox(undefined, fetcher)('pi_example')).toMatchObject({
      outcome: 'not-connected',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(() => createSandbox('sk_live_not-a-key')).toThrow('Only Stripe test');
    expect(() => createSandbox('pk_test_not-a-key')).toThrow('Only Stripe test');
  });
  it('uses one fixed GET endpoint, bounded timeout, and only an allowlisted response', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payment));
    const result = await createSandbox(key, fetcher)('pi_example');
    expect(result).toMatchObject({
      outcome: 'found',
      record: {
        originalStatus: 'processing',
        normalizedStatus: 'Reported in progress / awaiting input',
        amount: 12345,
        currency: 'usd',
      },
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leave-server');
    expect(JSON.stringify(result)).not.toContain('receipt_email');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('https://api.stripe.com/v1/payment_intents/pi_example');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'error' });
  });
  it.each([404, 401, 403, 429, 500])(
    'represents HTTP %s without claiming a payment failure',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response('', { status }));
      const result = await createSandbox(key, fetcher)('pi_example');
      expect(result.outcome).toBe(status === 404 ? 'not-found' : 'unavailable');
      expect(result.record).toBeUndefined();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it('exposes unmapped statuses instead of guessing a domain transition', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ...payment, status: 'future_status' }));
    expect(await createSandbox(key, fetcher)('pi_example')).toMatchObject({
      record: { originalStatus: 'future_status', normalizedStatus: 'Unmapped provider status' },
    });
  });
  it.each([{ livemode: true }, { amount: 'bad' }, { id: 'pi_other' }, { created: -1 }])(
    'rejects unsupported provider data %s',
    async (override) => {
      expect(
        await createSandbox(
          key,
          vi.fn().mockResolvedValue(Response.json({ ...payment, ...override })),
        )('pi_example'),
      ).toMatchObject({ outcome: 'unavailable' });
    },
  );
  it('contains timeouts, invalid identifiers, and malformed responses', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error('timed out with sensitive upstream detail'));
    expect(await createSandbox(key, fetcher)('../arbitrary-url')).toMatchObject({
      outcome: 'unavailable',
    });
    expect(fetcher).not.toHaveBeenCalled();
    const result = await createSandbox(key, fetcher)('pi_example');
    expect(result.outcome).toBe('unavailable');
    expect(JSON.stringify(result)).not.toContain('sensitive');
    expect(
      await createSandbox(key, vi.fn().mockResolvedValue(new Response('{bad')))('pi_example'),
    ).toMatchObject({ outcome: 'unavailable' });
  });
});
