import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addToRegistry, createTool, validateArgs } from './new-tool';
import { contractProblems } from '../src/modules/contract';

// Fixed registry so these tests don't depend on which tools are registered in the repo.
const registry = `import { kyc } from './kyc';
import { refunds } from './refunds';
import type { ToolId, ToolModule } from '../core/types';

export const modules: ToolModule[] = [kyc, refunds];
`;
function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'new-tool-'));
  mkdirSync(join(root, 'src/modules/kyc'), { recursive: true });
  writeFileSync(join(root, 'src/modules/index.ts'), registry);
  return root;
}

describe('new-tool scaffold', () => {
  it.each([
    ['Vendor', 'Vendors'],
    ['1vendor', 'Vendors'],
    ['vendor_requests', 'Vendors'],
    ['vendor--requests', 'Vendors'],
    ['vendor-', 'Vendors'],
    ['', 'Vendors'],
    ['overview', 'Overview'],
    ['shared-kyc', 'Shared'],
    ['vendors', ''],
    ['vendors', "Vendor's queue"],
    ['vendors', 'x'.repeat(41)],
    ['vendors', '<script>'],
  ])('rejects id %j / title %j', (id, title) => {
    expect(() => validateArgs(id, title)).toThrow();
  });

  it('adds exactly one import and registry entry', () => {
    const next = addToRegistry(registry, 'vendor-requests');
    expect(next).toContain("import { vendorRequests } from './vendor-requests';");
    expect(next).toContain('modules: ToolModule[] = [kyc, refunds, vendorRequests];');
    expect(() => addToRegistry(next, 'vendor-requests')).toThrow('already registered');
    expect(() => addToRegistry('export const modules = [];', 'x')).toThrow('registry shape');
  });

  it('refuses to overwrite an existing tool and leaves the registry untouched', () => {
    const root = fakeRoot();
    expect(() => createTool(root, 'kyc', 'KYC again')).toThrow('already exists');
    expect(readFileSync(join(root, 'src/modules/index.ts'), 'utf8')).toBe(registry);
  });

  it('generates a tool that passes the shared contract', async () => {
    const root = fakeRoot();
    createTool(root, 'vendor-requests', 'Vendor requests & spend');
    expect(existsSync(join(root, 'src/modules/vendor-requests/samples.ts'))).toBe(true);
    const generated = await import(join(root, 'src/modules/vendor-requests/index.ts'));
    expect(generated.vendorRequests.title).toBe('Vendor requests & spend');
    expect(contractProblems(generated.vendorRequests)).toEqual([]);
  });
});
