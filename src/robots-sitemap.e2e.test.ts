import { describe, it, expect } from 'vitest';
import * as https from 'https';

const ORIGIN =
  process.env.HACKBOX_META_E2E_ORIGIN ?? 'https://hackbox.tv.lozev.ski';

function fetch(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const statusCode = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({
            statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      })
      .on('error', reject);
  });
}

describe('Prod metadata endpoints E2E', () => {
  it('serves robots.txt that references the sitemap', async () => {
    const { statusCode, body } = await fetch(`${ORIGIN}/robots.txt`);
    expect(statusCode).toBeLessThan(400);
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Sitemap:');
  }, 30_000);

  it('serves a simple sitemap.xml for the root URL', async () => {
    const { statusCode, body } = await fetch(`${ORIGIN}/sitemap.xml`);
    expect(statusCode).toBeLessThan(400);
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>https://hackbox.tv.lozev.ski/</loc>');
  }, 30_000);

  it('serves a favicon image', async () => {
    const { statusCode } = await fetch(`${ORIGIN}/favicon.svg`);
    expect(statusCode).toBeLessThan(400);
  }, 30_000);
});
