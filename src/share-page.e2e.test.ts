import { describe, it, expect } from 'vitest';
import * as https from 'https';

const SHARE_ORIGIN =
  process.env.HACKBOX_SHARE_E2E_ORIGIN ?? 'https://hackbox.tv.lozev.ski';
const SHARE_ROOM = process.env.HACKBOX_SHARE_E2E_ROOM ?? 'E2eRoom';
const SHARE_GAME = process.env.HACKBOX_SHARE_E2E_GAME ?? 'ticTacToe';

const ROOM_ONLY_URL = `${SHARE_ORIGIN}/share/${encodeURIComponent(SHARE_ROOM)}`;
const ROOM_AND_GAME_URL = `${SHARE_ORIGIN}/share/${encodeURIComponent(
  SHARE_ROOM,
)}/${encodeURIComponent(SHARE_GAME)}`;

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
  it('serves room-only OG metadata for share URL', async () => {
    const html = await fetchHtml(ROOM_ONLY_URL);

    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
    expect(html).toContain(`Join room ${SHARE_ROOM} on hackbox.tv`);
    expect(html).toContain(
      `${SHARE_ORIGIN}/?room=${encodeURIComponent(SHARE_ROOM)}`,
    );
  }, 30_000);

  it('serves room/game-specific OG metadata for share URL', async () => {
    const html = await fetchHtml(ROOM_AND_GAME_URL);

    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
    expect(html).toContain(`Join Tic-Tac-Toe in ${SHARE_ROOM} on hackbox.tv`);
    expect(html).toContain(
      `${SHARE_ORIGIN}/?room=${encodeURIComponent(
        SHARE_ROOM,
      )}&amp;game=${encodeURIComponent(SHARE_GAME)}`,
    );
  }, 30_000);
});
