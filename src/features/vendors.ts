import { z } from 'zod';
import { money } from '../core/format';
import { randomId } from '../core/id';

export const reviewTeams = ['Finance', 'Security', 'Legal'] as const;
export type ReviewTeam = (typeof reviewTeams)[number];
export const departments = ['Engineering', 'Operations', 'People', 'Product'] as const;
export const dataAccessOptions = [
  'Public information only',
  'Internal business data',
  'Customer data',
] as const;

const detailsSchema = z.object({
  vendor: z.string().trim().min(2, 'Enter a vendor name (2–120 characters).').max(120),
  requester: z.string().trim().min(2, 'Enter a fictional requester (2–120 characters).').max(120),
  department: z.enum(departments),
  purpose: z.string().trim().min(10, 'Describe the business need (10–1,000 characters).').max(1000),
  annualCents: z
    .number()
    .int()
    .positive('Annual spend must be positive.')
    .max(100_000_000, 'Annual spend must not exceed $1,000,000 in this demo.'),
  budgetOwner: z.string().trim().max(120),
  dataAccess: z.enum(dataAccessOptions),
  securityReviewed: z.boolean(),
  contractReviewed: z.boolean(),
});
export type VendorDetails = z.infer<typeof detailsSchema>;
const reviewSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Changes requested']),
  reason: z.string().max(1000),
});
const requestSchema = z.object({
  id: z.string().min(1).max(64),
  revision: z.number().int().positive(),
  details: detailsSchema,
  reviews: z.object({ Finance: reviewSchema, Security: reviewSchema, Legal: reviewSchema }),
  history: z.array(
    z.object({
      id: z.string(),
      at: z.string().datetime(),
      actor: z.string(),
      action: z.string(),
      reason: z.string(),
      snapshot: z.string().optional(),
    }),
  ),
});
const stateSchema = z.object({ schemaVersion: z.literal(1), requests: z.array(requestSchema) });
export type VendorRequest = z.infer<typeof requestSchema>;
export type VendorState = z.infer<typeof stateSchema>;
export const VENDOR_STORAGE_KEY = 'workbench.vendor-demo.v1';

const pendingReviews = (): VendorRequest['reviews'] => ({
  Finance: { status: 'Pending', reason: '' },
  Security: { status: 'Pending', reason: '' },
  Legal: { status: 'Pending', reason: '' },
});

export function requiredTeams(details: VendorDetails): ReviewTeam[] {
  return reviewTeams.filter(
    (team) => team !== 'Security' || details.dataAccess !== 'Public information only',
  );
}

export function approvalBlocker(details: VendorDetails, team: ReviewTeam): string | null {
  if (team === 'Finance' && !details.budgetOwner.trim())
    return 'Add a budget owner before Finance approval.';
  if (team === 'Security' && !details.securityReviewed)
    return 'Mark the synthetic security assessment reviewed before Security approval.';
  if (team === 'Legal' && !details.contractReviewed)
    return 'Mark the synthetic contract reviewed before Legal approval.';
  return null;
}

export function vendorStatus(request: VendorRequest) {
  const teams = requiredTeams(request.details);
  if (teams.some((team) => request.reviews[team].status === 'Changes requested'))
    return 'Changes requested';
  if (
    teams.every(
      (team) =>
        request.reviews[team].status === 'Approved' && !approvalBlocker(request.details, team),
    )
  )
    return 'Ready for onboarding';
  return 'In review';
}

function historyEvent(
  actor: string,
  action: string,
  reason: string,
  at: string,
  snapshot?: string,
) {
  return { id: randomId(), actor, action, reason, at, ...(snapshot && { snapshot }) };
}

export function revisionSnapshot(details: VendorDetails): string {
  return [
    `${money(details.annualCents)}/yr`,
    details.dataAccess,
    `Budget owner: ${details.budgetOwner || 'missing'}`,
    `Security assessment ${details.securityReviewed ? 'reviewed' : 'not reviewed'}`,
    `Contract ${details.contractReviewed ? 'reviewed' : 'not reviewed'}`,
  ].join(' · ');
}

export function newVendorRequest(
  details: VendorDetails,
  at = new Date().toISOString(),
): VendorRequest {
  const parsed = detailsSchema.safeParse(details);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return {
    id: `VND-${randomId().slice(0, 8).toUpperCase()}`,
    revision: 1,
    details: parsed.data,
    reviews: pendingReviews(),
    history: [
      historyEvent(
        'Demo requester',
        'Submitted revision 1',
        parsed.data.purpose,
        at,
        revisionSnapshot(parsed.data),
      ),
    ],
  };
}

export function reviseVendorRequest(
  request: VendorRequest,
  details: VendorDetails,
  at = new Date().toISOString(),
): VendorRequest {
  const next = newVendorRequest(details, at);
  const revision = request.revision + 1;
  return {
    ...next,
    id: request.id,
    revision,
    history: [
      ...request.history,
      historyEvent(
        'Demo requester',
        `Resubmitted revision ${revision}; all reviews reset`,
        'Review the updated request again. Prior decisions apply only to earlier revisions.',
        at,
        revisionSnapshot(next.details),
      ),
    ],
  };
}

export function reviewVendorRequest(
  request: VendorRequest,
  team: ReviewTeam,
  decision: 'Approved' | 'Changes requested',
  reason: string,
  at = new Date().toISOString(),
): VendorRequest {
  if (!requiredTeams(request.details).includes(team))
    throw new Error(`${team} review is not required for this demo request.`);
  if (request.reviews[team].status !== 'Pending')
    throw new Error(
      'This review is already recorded. Edit and resubmit the request for a new review.',
    );
  const text = reason.trim();
  if (text.length < 5 || text.length > 1000)
    throw new Error('Enter a review reason (5–1,000 characters).');
  if (decision === 'Approved') {
    const blocker = approvalBlocker(request.details, team);
    if (blocker) throw new Error(blocker);
  }
  return {
    ...request,
    reviews: { ...request.reviews, [team]: { status: decision, reason: text } },
    history: [
      ...request.history,
      historyEvent(
        `Demo ${team} reviewer`,
        `${team}: ${decision} · revision ${request.revision}`,
        text,
        at,
      ),
    ],
  };
}

export function createVendorFixtures(): VendorState {
  const sample = (id: string, details: VendorDetails): VendorRequest => ({
    id,
    revision: 1,
    details,
    reviews: pendingReviews(),
    history: [
      {
        id: `${id}-submitted`,
        at: '2026-10-19T09:00:00.000Z',
        actor: 'Demo requester',
        action: 'Submitted revision 1',
        reason: details.purpose,
        snapshot: revisionSnapshot(details),
      },
    ],
  });
  const base: VendorDetails = {
    vendor: 'Juniper Demo Analytics',
    requester: 'Alex Morgan',
    department: 'Product',
    purpose: 'Understand product usage using synthetic customer events.',
    annualCents: 2_400_000,
    budgetOwner: 'Demo Product lead',
    dataAccess: 'Customer data',
    securityReviewed: false,
    contractReviewed: true,
  };
  const changes = sample('VND-1002', {
    ...base,
    vendor: 'Harbor Demo Recruiting',
    requester: 'Sam Patel',
    department: 'People',
    purpose: 'Coordinate recruiting interviews with internal business data.',
    annualCents: 1_200_000,
    budgetOwner: '',
    dataAccess: 'Internal business data',
    securityReviewed: true,
    contractReviewed: false,
  });
  changes.reviews.Finance = {
    status: 'Changes requested',
    reason: 'Identify the budget owner before review.',
  };
  changes.history.push({
    id: 'VND-1002-finance',
    at: '2026-10-19T10:00:00.000Z',
    actor: 'Demo Finance reviewer',
    action: 'Finance: Changes requested · revision 1',
    reason: changes.reviews.Finance.reason,
  });
  const ready = sample('VND-1003', {
    ...base,
    vendor: 'Maple Demo Design',
    department: 'Engineering',
    purpose: 'Create public marketing illustrations with no internal data access.',
    annualCents: 360_000,
    dataAccess: 'Public information only',
  });
  for (const team of requiredTeams(ready.details)) {
    ready.reviews[team] = {
      status: 'Approved',
      reason: 'Reviewed the synthetic request for this demo.',
    };
    ready.history.push({
      id: `${ready.id}-${team}`,
      at: '2026-10-19T11:00:00.000Z',
      actor: `Demo ${team} reviewer`,
      action: `${team}: Approved · revision 1`,
      reason: ready.reviews[team].reason,
    });
  }
  return { schemaVersion: 1, requests: [sample('VND-1001', base), changes, ready] };
}

export function loadVendors(): { data: VendorState; blocked: boolean; warning: string } {
  try {
    const raw = localStorage.getItem(VENDOR_STORAGE_KEY);
    if (raw === null) return { data: createVendorFixtures(), blocked: false, warning: '' };
    const result = stateSchema.safeParse(JSON.parse(raw));
    if (
      !result.success ||
      new Set(result.data.requests.map((r) => r.id)).size !== result.data.requests.length
    )
      throw new Error('Invalid vendor state');
    return { data: result.data, blocked: false, warning: '' };
  } catch {
    return {
      data: createVendorFixtures(),
      blocked: true,
      warning:
        'Saved vendor data could not be read. Samples are read-only; reset the vendor demo explicitly to replace saved data. Other tools are unaffected.',
    };
  }
}

export function saveVendors(data: VendorState): boolean {
  try {
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
