import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('site metadata', () => {
  it('includes a favicon link in the main HTML', () => {
    const htmlPath = resolve(__dirname, '../site/index.html');
    const html = readFileSync(htmlPath, 'utf8');

    expect(html).toContain('rel="icon"');
    expect(html).toContain('href="/favicon.svg"');
  });
});
