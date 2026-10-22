import type { IconName } from '../components/Icon';

// Tool and page IDs come from the build-time registries and are validated at runtime.
export type ToolId = string;
export type Page = string;
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
  applyWithContext?: (record: ToolRecord, reason: string) => ToolRecord;
  eligibility?: (record: ToolRecord) => string;
  blockedReason?: (record: ToolRecord) => string | undefined;
  preview?: (record: ToolRecord) => string;
  reasonLabel?: string;
  history?: (before: ToolRecord, after: ToolRecord) => { before: string; after: string };
}

export interface DetailField {
  label: string;
  /** Rows with an empty value and no badge are hidden. */
  value: (record: ToolRecord) => string;
  /** Status pill shown beside the label, e.g. a verification check result. */
  badge?: (record: ToolRecord) => { label: string; tone: Tone };
  wide?: boolean;
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
}

export interface IntakeField {
  key: string;
  label: string;
  kind?: 'text' | 'textarea' | 'date' | 'select';
  options?: string[];
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  maxLength?: number;
}

/** Optional submission form: the shell shows a button that creates a new record from `fields`. */
export interface ToolIntake {
  label: string;
  description: string;
  idPrefix: string;
  fields: IntakeField[];
  /** Valid sample input; the contract test submits it. */
  example: Record<string, string>;
  /** Build the record from trimmed, checked values. Throw an `Error` to block with a message. */
  create: (
    values: Record<string, string>,
    now: Date,
  ) => Pick<ToolRecord, 'name' | 'subtitle' | 'status' | 'fields'>;
}

export interface ToolModule {
  id: ToolId;
  title: string;
  shortTitle: string;
  description: string;
  icon: IconName;
  color: 'purple' | 'blue' | 'green';
  /** Show this icon instead of name initials beside each record. */
  recordIcon?: IconName;
  recordLabel: string;
  primaryColumn: string;
  secondaryColumn: string;
  secondaryValue: (record: ToolRecord) => string;
  statuses: Record<string, Tone>;
  /** Renamed statuses in saved browser data, mapped old → new before validation. */
  legacyStatuses?: Record<string, string>;
  owners: string[];
  isOpen?: (record: ToolRecord) => boolean;
  noActionMessage?: (record: ToolRecord) => string;
  details: DetailField[];
  notice: string;
  actions: RecordAction[];
  localActions?: RecordAction[];
  localDetails?: DetailSection[];
  withDefaults?: (record: ToolRecord) => ToolRecord;
  intake?: ToolIntake;
  metrics: (records: ToolRecord[]) => { label: string; value: string; hint: string }[];
  validateFields: (record: ToolRecord) => boolean;
  /** Deterministic synthetic records relative to `now`; used for first load and reset. */
  samples: (now: Date) => ToolRecord[];
}
