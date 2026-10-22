import { describe, expect, it } from 'vitest';
import { RESERVED } from '../../scripts/new-tool';
import { devinRequest, isStarter, MAX_PROMPT, promptProblems, toolKinds } from './toolRequest';

const prompt =
  'A dashboard for Support leads that shows refunds per day, so they can spot spikes quickly.';

describe('new tool request', () => {
  it('wraps any description with the repository rules and both build paths', () => {
    expect(promptProblems(prompt)).toEqual([]);
    const request = devinRequest(prompt, 'dashboard');
    expect(request).toContain('## What the requester wants (dashboard)');
    expect(request).toContain(prompt);
    expect(request).toContain('npm run new-tool -- <id> "<Name>"');
    expect(request).toContain('`customPages` in `src/features/pages.tsx`');
    expect(request).toContain('Use fictional sample data only.');
    expect(request).toContain('npm run build');
    expect(devinRequest(prompt, 'other')).toContain('## What the requester wants\n');
    expect(devinRequest(prompt, null)).toContain('## What the requester wants\n');
  });

  it('reserves the page id so a generated tool cannot take it', () => {
    expect(RESERVED).toContain('new-tool');
  });

  it.each(toolKinds.filter((kind) => kind.starter))(
    'refuses the untouched $label starter until its blanks are filled',
    ({ starter }) => {
      expect(isStarter(`  ${starter}\n`)).toBe(true);
      expect(promptProblems(starter).join(' ')).toMatch(/Replace the bracketed parts/);
      const filled = starter.replace(/\[[^\]]+\]/g, 'finance analysts');
      expect(promptProblems(filled)).toEqual([]);
    },
  );

  it.each([
    ['', /Describe the tool/],
    ['   \n ', /Describe the tool/],
    ['A tool', /more detail/],
    ['x'.repeat(MAX_PROMPT + 1), /under 2000/],
  ])('reports a readable problem for %j', (text, message) => {
    expect(promptProblems(text).join(' ')).toMatch(message);
  });

  it('keeps bracketed text the user wrote themselves', () => {
    expect(promptProblems(`${prompt} Show amounts as [USD] with two decimals.`)).toEqual([]);
  });
});
