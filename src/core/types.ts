export type ToolId = 'kyc' | 'refunds' | 'flags';
export type Page = 'overview' | ToolId | 'activity' | 'about' | 'investigation' | 'shared-kyc';
export type Tone = 'neutral' | 'purple' | 'green' | 'amber' | 'red' | 'blue';

export interface ToolRecord {
  id: string;
  name: string;
  subtitle: string;
  status: string;
  owner: string;
  openedAt?: string;
  updatedAt: string;
  version: number;
  fields: Record<string, string | number | boolean>;
}

export interface Activity {
  id: string;
  kind: 'action' | 'assignment' | 'note';
  moduleId: ToolId;
  recordId: string;
  recordName: string;
  action: string;
  reason: string;
  before: string;
  after: string;
  at: string;
}

export interface DemoState {
  schemaVersion: 2;
  records: Record<ToolId, ToolRecord[]>;
  activity: Activity[];
}

export interface RecordAction {
  id: string;
  label: string;
  confirmation: string;
  tone?: 'danger' | 'primary';
  available: (record: ToolRecord) => boolean;
  validate?: (record: ToolRecord, records: ToolRecord[]) => void;
  apply: (record: ToolRecord) => ToolRecord;
}

export interface DetailField {
  label: string;
  value: (record: ToolRecord) => string;
}

export interface ToolModule {
  id: ToolId;
  title: string;
  shortTitle: string;
  description: string;
  icon: 'identity' | 'refund' | 'flag';
  color: string;
  recordLabel: string;
  primaryColumn: string;
  secondaryColumn: string;
  secondaryValue: (record: ToolRecord) => string;
  statuses: Record<string, Tone>;
  owners: string[];
  isOpen?: (record: ToolRecord) => boolean;
  noActionMessage?: (record: ToolRecord) => string;
  details: DetailField[];
  notice: string;
  actions: RecordAction[];
  metrics: (records: ToolRecord[]) => { label: string; value: string; hint: string }[];
  validateFields: (record: ToolRecord) => boolean;
}
