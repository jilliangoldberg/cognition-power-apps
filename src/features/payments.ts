export type PaymentStatus =
  | 'Pending'
  | 'Authorized'
  | 'Settled'
  | 'Partially refunded'
  | 'Refunded'
  | 'Declined';

export interface Dispute {
  id: string;
  reason: string;
  status: 'Needs response' | 'Under review' | 'Won' | 'Lost';
  amountCents: number;
  openedAt: string;
  respondBy?: string;
}

// Only the brand and last 4 digits are stored, so a full card number cannot be rendered.
export interface Payment {
  id: string;
  customerName: string;
  customerEmail: string;
  merchant: string;
  amountCents: number;
  card: { brand: 'Visa' | 'Mastercard' | 'Amex'; last4: string };
  status: PaymentStatus;
  createdAt: string;
  authorizedAt?: string;
  settledAt?: string;
  refundedAt?: string;
  refundedCents?: number;
  declineReason?: string;
  dispute?: Dispute;
}

export const isOpenDispute = (dispute?: Dispute) =>
  dispute?.status === 'Needs response' || dispute?.status === 'Under review';

const HOUR = 3_600_000;

export function samplePayments(now = new Date()): Payment[] {
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();
  const ahead = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();
  return [
    {
      id: 'TXN-4F8K2Q',
      customerName: 'Maya Chen',
      customerEmail: 'maya.chen@example.com',
      merchant: 'Northwind Outfitters',
      amountCents: 18_450,
      card: { brand: 'Visa', last4: '4242' },
      status: 'Settled',
      createdAt: ago(312),
      authorizedAt: ago(311.9),
      settledAt: ago(290),
      dispute: {
        id: 'DP-20931',
        reason: 'Product not received',
        status: 'Needs response',
        amountCents: 18_450,
        openedAt: ago(40),
        respondBy: ahead(128),
      },
    },
    {
      id: 'TXN-7H3M9D',
      customerName: 'Maya Chen',
      customerEmail: 'maya.chen@example.com',
      merchant: 'Bluebird Books',
      amountCents: 3_299,
      card: { brand: 'Visa', last4: '4242' },
      status: 'Partially refunded',
      createdAt: ago(150),
      authorizedAt: ago(149.95),
      settledAt: ago(128),
      refundedAt: ago(30),
      refundedCents: 1_100,
    },
    {
      id: 'TXN-2C6V1R',
      customerName: 'Maya Chen',
      customerEmail: 'maya.chen@example.com',
      merchant: 'Harbor Street Cafe',
      amountCents: 1_275,
      card: { brand: 'Mastercard', last4: '5100' },
      status: 'Authorized',
      createdAt: ago(3),
      authorizedAt: ago(2.98),
    },
    {
      id: 'TXN-9P4L6T',
      customerName: 'Daniel Okafor',
      customerEmail: 'd.okafor@example.org',
      merchant: 'Summit Fitness',
      amountCents: 6_900,
      card: { brand: 'Amex', last4: '0005' },
      status: 'Refunded',
      createdAt: ago(500),
      authorizedAt: ago(499.9),
      settledAt: ago(476),
      refundedAt: ago(200),
      refundedCents: 6_900,
    },
    {
      id: 'TXN-5B8N3W',
      customerName: 'Daniel Okafor',
      customerEmail: 'd.okafor@example.org',
      merchant: 'Lumen Electronics',
      amountCents: 129_900,
      card: { brand: 'Amex', last4: '0005' },
      status: 'Settled',
      createdAt: ago(900),
      authorizedAt: ago(899.9),
      settledAt: ago(876),
      dispute: {
        id: 'DP-18804',
        reason: 'Duplicate charge',
        status: 'Won',
        amountCents: 129_900,
        openedAt: ago(700),
      },
    },
    {
      id: 'TXN-3K7Q8J',
      customerName: 'Priya Natarajan',
      customerEmail: 'priya.n@example.net',
      merchant: 'Cedar & Pine Home',
      amountCents: 24_000,
      card: { brand: 'Visa', last4: '1881' },
      status: 'Declined',
      createdAt: ago(20),
      declineReason: 'Insufficient funds',
    },
    {
      id: 'TXN-8R1Z4F',
      customerName: 'Priya Natarajan',
      customerEmail: 'priya.n@example.net',
      merchant: 'Cedar & Pine Home',
      amountCents: 24_000,
      card: { brand: 'Visa', last4: '1881' },
      status: 'Settled',
      createdAt: ago(19),
      authorizedAt: ago(18.99),
      settledAt: ago(2),
      dispute: {
        id: 'DP-21177',
        reason: 'Unrecognized charge',
        status: 'Under review',
        amountCents: 24_000,
        openedAt: ago(1),
      },
    },
    {
      id: 'TXN-6D2X5S',
      customerName: 'Leo Martins',
      customerEmail: 'leo.martins@example.com',
      merchant: 'Northwind Outfitters',
      amountCents: 7_450,
      card: { brand: 'Mastercard', last4: '4444' },
      status: 'Pending',
      createdAt: ago(0.2),
    },
  ];
}

export interface PaymentSearch {
  transactionId: string;
  email: string;
  last4: string;
}

export type SearchResult =
  | { ok: true; criteria: PaymentSearch; matches: Payment[] }
  | { ok: false; error: string; clear: (keyof PaymentSearch)[] };

// 12-19 digits, optionally separated by spaces or dashes: the shape of a full card number.
export const looksLikeCardNumber = (value: string) => /\d(?:[ -]?\d){11,18}/.test(value);

export function searchPayments(input: PaymentSearch, payments: Payment[]): SearchResult {
  const cardFields = (Object.keys(input) as (keyof PaymentSearch)[]).filter((key) =>
    looksLikeCardNumber(input[key]),
  );
  if (cardFields.length)
    return {
      ok: false,
      error: 'That looks like a full card number. Enter only the last 4 digits.',
      clear: cardFields,
    };
  const criteria = {
    transactionId: input.transactionId.trim().toUpperCase(),
    email: input.email.trim().toLowerCase(),
    last4: input.last4.trim(),
  };
  const fail = (error: string): SearchResult => ({ ok: false, error, clear: [] });
  if (!criteria.transactionId && !criteria.email)
    return criteria.last4
      ? fail('Card digits need the customer’s email too.')
      : fail('Enter a transaction ID or customer email.');
  if (criteria.transactionId && !/^[A-Z0-9-]{1,40}$/.test(criteria.transactionId))
    return fail('Transaction IDs use letters, numbers and dashes, like TXN-4F8K2Q.');
  if (criteria.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(criteria.email))
    return fail('Enter the customer’s full email address.');
  if (criteria.last4 && !/^\d{4}$/.test(criteria.last4))
    return fail('Card digits must be exactly the last 4 digits.');
  if (criteria.last4 && !criteria.email) return fail('Card digits need the customer’s email too.');
  const matches = payments
    .filter(
      (payment) =>
        (!criteria.transactionId || payment.id === criteria.transactionId) &&
        (!criteria.email || payment.customerEmail === criteria.email) &&
        (!criteria.last4 || payment.card.last4 === criteria.last4),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { ok: true, criteria, matches };
}

export const paymentExamples: { label: string; search: PaymentSearch }[] = [
  {
    label: 'Open dispute',
    search: { transactionId: 'TXN-4F8K2Q', email: '', last4: '' },
  },
  {
    label: 'Customer email',
    search: { transactionId: '', email: 'maya.chen@example.com', last4: '' },
  },
  {
    label: 'Email + card ending 4242',
    search: { transactionId: '', email: 'maya.chen@example.com', last4: '4242' },
  },
  {
    label: 'Refunded',
    search: { transactionId: 'TXN-9P4L6T', email: '', last4: '' },
  },
];
