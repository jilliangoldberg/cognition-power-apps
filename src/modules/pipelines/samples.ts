import type { ToolRecord } from '../../core/types';

// Fictional sample records relative to `now`; used on first load and reset.
export function samples(now: Date): ToolRecord[] {
  const time = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const day = (days: number) =>
    new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const request = (
    id: string,
    name: string,
    requester: string,
    status: string,
    owner: string,
    hours: number,
    fields: {
      source: string;
      destination: string;
      schedule: string;
      neededIn: number;
      purpose: string;
    },
  ): ToolRecord => ({
    id,
    name,
    subtitle: `Requested by ${requester}`,
    status,
    owner,
    openedAt: time(hours + 48),
    updatedAt: time(hours),
    version: 1,
    fields: {
      requester,
      source: fields.source,
      destination: fields.destination,
      schedule: fields.schedule,
      neededBy: day(fields.neededIn),
      purpose: fields.purpose,
    },
  });
  return [
    request('DPR-101', 'Churn model features', 'Priya Natarajan', 'Submitted', 'Unassigned', 3, {
      source: 'Product events stream (app_events)',
      destination: 'Analytics warehouse · ds_churn.features_daily',
      schedule: 'Daily',
      neededIn: 10,
      purpose: 'Daily feature table for the churn model retrain. Needs data by 06:00 UTC.',
    }),
    request(
      'DPR-102',
      'Support ticket sentiment',
      'Marcus Lee',
      'Submitted',
      'Data engineering',
      20,
      {
        source: 'Support desk nightly export (CSV drop)',
        destination: 'Lakehouse · support.ticket_sentiment',
        schedule: 'Daily',
        neededIn: 21,
        purpose: 'Scores ticket text for the support quality dashboard.',
      },
    ),
    request('DPR-103', 'Hourly checkout funnel', 'Ana Ruiz', 'In progress', 'Platform', 30, {
      source: 'Checkout service Postgres replica',
      destination: 'Analytics warehouse · growth.checkout_funnel_hourly',
      schedule: 'Hourly',
      neededIn: 4,
      purpose: 'Funnel drop-off by step for the checkout experiment readout.',
    }),
    request('DPR-104', 'Marketing spend history', 'Tom Becker', 'Needs info', 'You', 52, {
      source: 'Ad platform exports (sample CSVs)',
      destination: 'Lakehouse · marketing.spend_history',
      schedule: 'One-time load',
      neededIn: 30,
      purpose: 'Two years of spend for the attribution model. Date range still to confirm.',
    }),
    request(
      'DPR-105',
      'Weekly inventory snapshot',
      'Grace Okafor',
      'Delivered',
      'Data engineering',
      96,
      {
        source: 'Inventory service API (sandbox)',
        destination: 'Analytics warehouse · ops.inventory_weekly',
        schedule: 'Weekly',
        neededIn: -2,
        purpose: 'Stock levels per site for the demand forecast.',
      },
    ),
    request('DPR-106', 'Real-time session signals', 'Leo Park', 'Declined', 'Platform', 140, {
      source: 'Web session events stream',
      destination: 'Feature store · session_signals',
      schedule: 'Streaming',
      neededIn: 7,
      purpose: 'Live session features. Covered by the existing session_features table.',
    }),
    request('DPR-107', 'Monthly revenue cohorts', 'Sofia Rossi', 'Submitted', 'You', 8, {
      source: 'Billing Postgres replica',
      destination: 'Analytics warehouse · finance.revenue_cohorts',
      schedule: 'Monthly',
      neededIn: 45,
      purpose: 'Revenue by signup cohort for the quarterly planning model.',
    }),
  ];
}
