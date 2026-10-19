import { z } from 'zod';

export interface SandboxResult {
  source: 'Stripe test mode';
  outcome: 'found' | 'not-found' | 'unavailable' | 'not-connected';
  attemptedAt: string;
  retrievedAt?: string;
  message: string;
  record?: {
    id: string;
    originalStatus: string;
    normalizedStatus: string;
    amount: number;
    currency: string;
    createdAt: string;
  };
}
const paymentIntent = z.object({
  id: z.string().regex(/^pi_[A-Za-z0-9]+$/),
  object: z.literal('payment_intent'),
  livemode: z.literal(false),
  status: z.string().min(1).max(100),
  amount: z.number().int().nonnegative().safe(),
  currency: z.string().regex(/^[a-z]{3}$/),
  created: z.number().int().nonnegative().max(253402300799),
});
export function createSandbox(key?: string, fetcher: typeof fetch = fetch) {
  if (key && !/^(rk|sk)_test_/.test(key))
    throw new Error('Only Stripe test/sandbox keys are permitted.');
  return async (id: string): Promise<SandboxResult> => {
    const base = { source: 'Stripe test mode' as const, attemptedAt: new Date().toISOString() };
    if (!key)
      return {
        ...base,
        outcome: 'not-connected',
        message:
          'No sandbox key configured. No external lookup was attempted; synthetic results are never substituted.',
      };
    if (!/^pi_[A-Za-z0-9]{1,100}$/.test(id))
      return {
        ...base,
        outcome: 'unavailable',
        message: 'Use a PaymentIntent ID beginning pi_. No external request was made.',
      };
    try {
      const response = await fetcher(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
          headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2025-06-30.basil' },
        },
      );
      if (response.status === 404)
        return {
          ...base,
          outcome: 'not-found',
          message: 'This sandbox returned no matching PaymentIntent.',
        };
      if (!response.ok)
        return {
          ...base,
          outcome: 'unavailable',
          message:
            response.status === 401 || response.status === 403
              ? 'Sandbox credentials or read permissions were rejected.'
              : response.status === 429
                ? 'Sandbox rate limit reached. Retry later; automatic retries are disabled.'
                : 'Sandbox unavailable. This does not mean the payment failed.',
        };
      const parsed = paymentIntent.safeParse(await response.json());
      if (!parsed.success || parsed.data.id !== id)
        return {
          ...base,
          outcome: 'unavailable',
          message: 'Unsupported or non-test provider response. No result has been accepted.',
        };
      const p = parsed.data;
      const normalizedStatus =
        p.status === 'succeeded'
          ? 'Reported succeeded'
          : p.status === 'canceled'
            ? 'Reported canceled'
            : [
                  'processing',
                  'requires_action',
                  'requires_capture',
                  'requires_confirmation',
                  'requires_payment_method',
                ].includes(p.status)
              ? 'Reported in progress / awaiting input'
              : 'Unmapped provider status';
      return {
        ...base,
        outcome: 'found',
        retrievedAt: new Date().toISOString(),
        message:
          'Single PaymentIntent snapshot only. This is not a full payment-event history or settlement confirmation.',
        record: {
          id: p.id,
          originalStatus: p.status,
          normalizedStatus,
          amount: p.amount,
          currency: p.currency,
          createdAt: new Date(p.created * 1000).toISOString(),
        },
      };
    } catch {
      return {
        ...base,
        outcome: 'unavailable',
        message:
          'Sandbox lookup timed out or failed. No conclusion about payment outcome; retry is manual.',
      };
    }
  };
}
