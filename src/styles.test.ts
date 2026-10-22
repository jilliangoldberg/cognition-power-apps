import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const full = hex.length === 4 ? hex.replace(/\w/g, '$&$&') : hex;
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('readability floor', () => {
  it('keeps every font size at 11px or larger', () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter((size) => size < 11)).toEqual([]);
  });

  it('keeps text colours at WCAG AA contrast against the page background', () => {
    const colours = [...css.matchAll(/(?:(?<![-\w])color|--muted):\s*(#[\da-f]{3,6})\b/gi)]
      .map((m) => m[1].toLowerCase())
      .filter((hex) => hex !== '#fff' && hex !== '#ffffff');
    expect(colours.length).toBeGreaterThan(0);
    expect(colours.filter((hex) => contrast(hex, '#f8f9fc') < 4.5)).toEqual([]);
  });

  it('keeps neutral text near-black rather than grey', () => {
    const saturation = (hex: string) => {
      const full = hex.length === 4 ? hex.replace(/\w/g, '$&$&') : hex;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const light = (max + min) / 2;
      return max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
    };
    const greys = [...css.matchAll(/(?:(?<![-\w])color|--muted):\s*(#[\da-f]{3,6})\b/gi)]
      .map((m) => m[1].toLowerCase())
      .filter((hex) => hex !== '#fff' && hex !== '#ffffff' && saturation(hex) <= 0.11);
    expect(greys.length).toBeGreaterThan(0);
    expect(greys.filter((hex) => contrast(hex, '#f8f9fc') < 14)).toEqual([]);
  });
});
