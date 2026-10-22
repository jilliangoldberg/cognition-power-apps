import type { ComponentType } from 'react';
import type { IconName } from '../components/Icon';

export const READ_ONLY_PAGE_CONTRACT_VERSION = 1;

export interface ReadOnlyPageExtension<Id extends string = string> {
  contractVersion: typeof READ_ONLY_PAGE_CONTRACT_VERSION;
  id: Id;
  title: string;
  icon: IconName;
  View: ComponentType;
  dataMode: 'synthetic';
  readOnly: true;
  persistence: 'none';
  reviewStatus: 'provisional';
  owner: {
    team: string;
    status: 'proposed' | 'assigned';
    support: string;
    runbook: string;
  };
  actions: readonly { id: string; label: string; effect: 'synthetic-read' }[];
  fixtureScenarios: readonly string[];
}

// Static registration checks only; imported code is trusted, not sandboxed or authorized here.
export function defineReadOnlyPage<const Id extends string>(
  extension: ReadOnlyPageExtension<Id>,
): ReadOnlyPageExtension<Id> {
  if (extension.contractVersion !== READ_ONLY_PAGE_CONTRACT_VERSION)
    throw new Error('Unsupported read-only page contract version');
  if (!/^[a-z][a-z0-9-]*$/.test(extension.id) || !extension.title.trim())
    throw new Error('Extension requires a stable slug and title');
  if (
    extension.dataMode !== 'synthetic' ||
    extension.readOnly !== true ||
    extension.persistence !== 'none' ||
    extension.reviewStatus !== 'provisional'
  )
    throw new Error('This provisional contract supports stateless synthetic reads only');
  if (
    !extension.owner.team.trim() ||
    !extension.owner.support.trim() ||
    !extension.owner.runbook.trim()
  )
    throw new Error('Extension requires owner, support and runbook metadata');
  if (
    !extension.actions.length ||
    new Set(extension.actions.map((action) => action.id)).size !== extension.actions.length ||
    extension.actions.some(
      (action) => !action.id.trim() || !action.label.trim() || action.effect !== 'synthetic-read',
    )
  )
    throw new Error('Extension actions must be unique named synthetic reads');
  if (
    !extension.fixtureScenarios.length ||
    extension.fixtureScenarios.some((scenario) => !scenario.trim()) ||
    new Set(extension.fixtureScenarios).size !== extension.fixtureScenarios.length
  )
    throw new Error('Extension requires unique fixture scenarios');
  return extension;
}
