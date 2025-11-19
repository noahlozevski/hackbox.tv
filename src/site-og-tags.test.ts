import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('site Open Graph metadata', () => {
  it('includes rich OG and Twitter card tags', () => {
    const htmlPath = resolve(__dirname, '../site/index.html');
    const html = readFileSync(htmlPath, 'utf8');

    expect(html).toMatch(
      /property="og:title"[\s\S]*hackbox\.tv – realtime browser games with friends/,
    );
    expect(html).toMatch(
      /property="og:description"[\s\S]*Spin up a hackbox room, drop a link, and play chaotic real‑time games in your browser\./,
    );
    expect(html).toMatch(
      /property="og:image"[\s\S]*https:\/\/hackbox\.tv\.lozev\.ski\/og_image\.jpg/,
    );
    expect(html).toMatch(
      /property="og:url"[\s\S]*https:\/\/hackbox\.tv\.lozev\.ski\//,
    );
    expect(html).toMatch(/name="twitter:card"[\s\S]*summary_large_image/);
    expect(html).toMatch(
      /name="twitter:title"[\s\S]*hackbox\.tv – realtime browser games with friends/,
    );
  });
});
