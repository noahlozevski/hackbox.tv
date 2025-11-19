import { describe, it, expect } from 'vitest';
import * as https from 'https';

const SHARE_URL =
  process.env.HACKBOX_SHARE_E2E_URL ??
  'https://hackbox.tv.lozev.ski/share/E2eRoom/ticTacToe';

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(
            new Error(
              `Request failed with status ${res.statusCode ?? 'unknown'}`,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      })
      .on('error', reject);
  });
}

describe('Prod Share Page E2E', () => {
  it('serves room/game-specific OG metadata for share URL', async () => {
    const html = await fetchHtml(SHARE_URL);

    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
    expect(html).toContain('Join Tic-Tac-Toe in E2eRoom on hackbox.tv');
    expect(html).toContain(
      'https://hackbox.tv.lozev.ski/?room=E2eRoom&amp;game=ticTacToe',
    );
  }, 30_000);
});
