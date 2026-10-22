import { describe, expect, it } from 'vitest';
import { validateArgs } from '../../scripts/new-tool';
import { devinRequest, exampleSpec, parseAction, specProblems, toolId } from './toolRequest';

describe('new tool request', () => {
  it('turns the example into a request that runs the scaffold with a valid id and title', () => {
    expect(specProblems(exampleSpec)).toEqual([]);
    const request = devinRequest(exampleSpec);
    expect(request).toContain('npm run new-tool -- expense-claims "Expense claims"');
    expect(request).toContain('src/modules/expense-claims/');
    expect(request).toContain(
      'Approve: available when the status is "Submitted"; changes it to "Approved"',
    );
    expect(request).toContain('new records start as "Submitted"');
    expect(() => validateArgs(toolId(exampleSpec.title), exampleSpec.title)).not.toThrow();
  });

  it.each([
    ['Vendor requests', 'vendor-requests'],
    ['  IT / Access & Devices  ', 'it-access-devices'],
    ['A'.repeat(40), 'a'.repeat(32)],
    ['abc-' + 'd'.repeat(27) + ' x', 'abc-' + 'd'.repeat(27)],
  ])('derives a scaffold-safe id from %j', (title, id) => {
    expect(toolId(title)).toBe(id);
    expect(() => validateArgs(id, 'Title')).not.toThrow();
  });

  it.each([
    ['Approve: Submitted -> Approved', { label: 'Approve', from: 'Submitted', to: 'Approved' }],
    ['Mark paid :Approved→Paid', { label: 'Mark paid', from: 'Approved', to: 'Paid' }],
    ['Approve Submitted -> Approved', null],
    ['Approve: -> Approved', null],
    [': A -> B', null],
  ])('parses action line %j', (line, expected) => {
    expect(parseAction(line)).toEqual(expected);
  });

  it.each([
    [{ title: '' }, /Tool name/],
    [{ title: '<script>' }, /Tool name/],
    [{ title: '123 tools' }, /start with a letter/],
    [{ title: 'Activity' }, /already exists/],
    [{ title: 'New tool' }, /already exists/],
    [{ title: 'Vendors' }, /already exists/],
    [{ title: 'KYC' }, /already exists/],
    [{ purpose: 'short' }, /who uses/],
    [{ recordNoun: ' ' }, /one record is/],
    [{ fields: '\n \n' }, /at least one field/],
    [{ statuses: 'Open' }, /two statuses/],
    [{ statuses: 'Open\nopen' }, /different/],
    [{ actions: '' }, /at least one action/],
    [{ actions: 'Approve it' }, /should look like/],
    [{ actions: 'Approve: Submitted -> Done' }, /"Done", which is not a listed status/],
    [{ actions: 'Approve: Submitted -> Approved\napprove: Approved -> Rejected' }, /listed twice/],
    [{ fields: Array.from({ length: 13 }, (_, i) => `F${i}`).join('\n') }, /12 lines/],
    [{ rules: 'x'.repeat(601) }, /under 600/],
  ])('reports a readable problem for %j', (patch, message) => {
    const problems = specProblems({ ...exampleSpec, ...patch }, ['kyc', 'refunds', 'flags']);
    expect(problems.some((problem) => (message as RegExp).test(problem))).toBe(true);
  });
});
