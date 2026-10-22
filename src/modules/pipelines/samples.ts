import type { ToolRecord } from '../../core/types';

// Fictional sample records relative to `now`; used on first load and reset.
export function samples(now: Date): ToolRecord[] {
  const time = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const day = (days: number) =>
    new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const request = (
    id: string,
    name: string,
    status: string,
    owner: string,
    opened: number,
    updated: number,
    fields: {
      requester: string;
      source: string;
      destination: string;
      schedule: string;
      neededBy: string;
      purpose: string;
    },
  ): ToolRecord => ({
    id,
    name,
    subtitle: `${fields.source} → ${fields.destination}`,
    status,
    owner,
    openedAt: time(opened),
    updatedAt: time(updated),
    version: 1,
    fields,
  });
  return [
    request('DPR-101', 'Churn model training features', 'Submitted', 'Unassigned', 20, 3, {
      requester: 'Maya Chen',
      source: 'App events stream',
      destination: 'Feature store',
      schedule: 'Daily',
      neededBy: day(12),
      purpose: 'Daily features for the churn model retrain.',
    }),
    request('DPR-102', 'Support ticket sentiment', 'Submitted', 'Data engineering', 50, 8, {
      requester: 'Leo Okafor',
      source: 'Help desk export bucket',
      destination: 'Warehouse: support.tickets_scored',
      schedule: 'Hourly',
      neededBy: day(5),
      purpose: 'Near-real-time sentiment for the support dashboard.',
    }),
    request('DPR-103', 'Marketing spend by channel', 'Needs info', 'Data engineering', 120, 26, {
      requester: 'Sam Rivera',
      source: 'Ad platform CSV drops',
      destination: 'Warehouse: marketing.spend_daily',
      schedule: 'Daily',
      neededBy: day(20),
      purpose: 'Which ad accounts are in scope is still unclear.',
    }),
    request('DPR-104', 'Inventory forecast inputs', 'In progress', 'Platform', 170, 14, {
      requester: 'Ines Duarte',
      source: 'Warehouse: ops.inventory_snapshots',
      destination: 'Forecast service bucket',
      schedule: 'Weekly',
      neededBy: day(9),
      purpose: 'Weekly snapshot for the demand forecast.',
    }),
    request('DPR-105', 'Experiment exposure log', 'In progress', 'You', 90, 40, {
      requester: 'Tomás Berg',
      source: 'Experiment service events',
      destination: 'Warehouse: experiments.exposures',
      schedule: 'Hourly',
      neededBy: day(2),
      purpose: 'Analyze A/B tests without manual exports.',
    }),
    request('DPR-106', 'Historical orders backfill', 'Delivered', 'Platform', 300, 60, {
      requester: 'Hana Ito',
      source: 'Legacy orders database export',
      destination: 'Warehouse: sales.orders_history',
      schedule: 'One-time backfill',
      neededBy: day(-3),
      purpose: 'Three years of orders for the pricing study.',
    }),
    request('DPR-107', 'Raw clickstream copy', 'Declined', 'Data engineering', 210, 100, {
      requester: 'Rafael Moss',
      source: 'App events stream',
      destination: 'Personal sandbox bucket',
      schedule: 'Hourly',
      neededBy: day(1),
      purpose: 'Duplicate of the shared events table.',
    }),
  ];
}
