import { describe, expect, it } from 'vitest';
import {
  isOpenDispute,
  looksLikeCardNumber,
  paymentExamples,
  samplePayments,
  searchPayments,
  type PaymentSearch,
} from './payments';

const clock = new Date('2026-10-19T06:00:00Z');
const payments = samplePayments(clock);
const search = (patch: Partial<PaymentSearch>) =>
  searchPayments({ transactionId: '', email: '', last4: '', ...patch }, payments);
const ids = (patch: Partial<PaymentSearch>) => {
  const result = search(patch);
  if (!result.ok) throw new Error(result.error);
  return result.matches.map((payment) => payment.id);
};
const error = (patch: Partial<PaymentSearch>) => {
  const result = search(patch);
  if (result.ok) throw new Error('expected an error');
  return result;
};

describe('payment samples', () => {
  it('are deterministic, unique and never hold more than 4 card digits', () => {
    expect(samplePayments(clock)).toEqual(payments);
    expect(new Set(payments.map((p) => p.id)).size).toBe(payments.length);
    expect(payments.every((p) => /^\d{4}$/.test(p.card.last4))).toBe(true);
    expect(looksLikeCardNumber(JSON.stringify(payments))).toBe(false);
    expect(payments.every((p) => /@example\.(com|org|net)$/.test(p.customerEmail))).toBe(true);
  });

  it('keep each timeline in order and no later than now', () => {
    for (const p of payments) {
      const steps = [p.createdAt, p.authorizedAt, p.settledAt, p.refundedAt].filter(
        (at): at is string => Boolean(at),
      );
      expect([...steps].sort()).toEqual(steps);
      expect(steps.every((at) => Date.parse(at) <= clock.getTime())).toBe(true);
      if (p.status === 'Declined') expect(p.authorizedAt).toBeUndefined();
    }
  });

  it('cover open, closed and no disputes, and every example finds a payment', () => {
    expect(payments.filter((p) => isOpenDispute(p.dispute))).toHaveLength(2);
    expect(payments.some((p) => p.dispute && !isOpenDispute(p.dispute))).toBe(true);
    for (const example of paymentExamples)
      expect(ids(example.search).length, example.label).toBeGreaterThan(0);
  });
});

describe('searchPayments', () => {
  it('matches a transaction ID exactly, ignoring case and spaces', () => {
    expect(ids({ transactionId: ' txn-4f8k2q ' })).toEqual(['TXN-4F8K2Q']);
    expect(ids({ transactionId: 'TXN-4F8K' })).toEqual([]);
  });

  it('matches an exact email, newest first, and never a partial email', () => {
    expect(ids({ email: ' Maya.Chen@Example.com ' })).toEqual([
      'TXN-2C6V1R',
      'TXN-7H3M9D',
      'TXN-4F8K2Q',
    ]);
    expect(error({ email: 'maya' }).error).toMatch(/full email/);
    expect(ids({ email: 'chen@example.com' })).toEqual([]);
  });

  it('requires the email whenever card digits are given', () => {
    expect(error({ last4: '4242' }).error).toMatch(/need the customer’s email/);
    expect(error({ transactionId: 'TXN-4F8K2Q', last4: '4242' }).error).toMatch(/email too/);
    expect(ids({ email: 'maya.chen@example.com', last4: '4242' })).toEqual([
      'TXN-7H3M9D',
      'TXN-4F8K2Q',
    ]);
    expect(ids({ email: 'maya.chen@example.com', last4: '0005' })).toEqual([]);
  });

  it('combines every given field', () => {
    expect(ids({ transactionId: 'TXN-4F8K2Q', email: 'd.okafor@example.org' })).toEqual([]);
    expect(ids({ transactionId: 'TXN-4F8K2Q', email: 'maya.chen@example.com' })).toEqual([
      'TXN-4F8K2Q',
    ]);
  });

  it.each(['42', '42424', 'abcd', '42 4'])('rejects card digits %j', (last4) => {
    expect(error({ email: 'maya.chen@example.com', last4 }).error).toMatch(/exactly the last 4/);
  });

  it.each([
    ['last4', '4242424242424242'],
    ['last4', '4242 4242 4242 4242'],
    ['transactionId', '4242-4242-4242-4242'],
    ['email', '4242424242424242@example.com'],
  ] as const)('refuses a full card number in %s and asks to clear it', (key, value) => {
    const result = error({ email: 'maya.chen@example.com', [key]: value });
    expect(result.error).toMatch(/full card number/);
    expect(result.error).not.toContain('4242');
    expect(result.clear).toEqual([key]);
  });

  it('asks for something to search and rejects malformed IDs', () => {
    expect(error({}).error).toMatch(/transaction ID or customer email/);
    expect(error({ transactionId: 'TXN 1; DROP' }).error).toMatch(/letters, numbers and dashes/);
  });
});
