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

// Keep this list in sync with the known game IDs that have OG images
const GAMES_WITH_OG_IMAGES = [
  'connectFour',
  'marbleRace',
  'tiltPong',
  'arenaBumpers',
  'frogger',
  'ticTacToe',
  'rockPaperScissors',
  'lightcycle',
];

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

function fetchAssetHeaders(
  url: string,
): Promise<{ statusCode: number; contentType: string | undefined }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'] as string | undefined;
        if (!statusCode) {
          reject(new Error('Missing status code'));
          return;
        }
        // We only care that the asset is reachable and looks like an image.
        resolve({ statusCode, contentType });
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
    expect(html).toContain(SHARE_ROOM);
    expect(html).toContain(
      `${SHARE_ORIGIN}/?room=${encodeURIComponent(SHARE_ROOM)}`,
    );
    const ogImageMatch = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/,
    );
    expect(ogImageMatch).not.toBeNull();
    const ogImageUrl = ogImageMatch?.[1] ?? '';
    expect(ogImageUrl.startsWith(SHARE_ORIGIN)).toBe(true);
    const { statusCode, contentType } = await fetchAssetHeaders(ogImageUrl);
    expect(statusCode).toBeLessThan(400);
    expect(contentType && contentType.startsWith('image/')).toBe(true);
  }, 30_000);

  it('serves room/game-specific OG metadata for share URL', async () => {
    const html = await fetchHtml(ROOM_AND_GAME_URL);

    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
    expect(html).toContain('Tic-Tac-Toe');
    expect(html).toContain(SHARE_ROOM);
    expect(html).toContain(
      `${SHARE_ORIGIN}/?room=${encodeURIComponent(
        SHARE_ROOM,
      )}&amp;game=${encodeURIComponent(SHARE_GAME)}`,
    );
    const ogImageMatch = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/,
    );
    expect(ogImageMatch).not.toBeNull();
    const ogImageUrl = ogImageMatch?.[1] ?? '';
    expect(ogImageUrl.startsWith(SHARE_ORIGIN)).toBe(true);
    const { statusCode, contentType } = await fetchAssetHeaders(ogImageUrl);
    expect(statusCode).toBeLessThan(400);
    expect(contentType && contentType.startsWith('image/')).toBe(true);
  }, 30_000);

  it('serves valid OG images for all known games', async () => {
    for (const gameId of GAMES_WITH_OG_IMAGES) {
      const url = `${SHARE_ORIGIN}/share/${encodeURIComponent(
        SHARE_ROOM,
      )}/${encodeURIComponent(gameId)}`;

      const html = await fetchHtml(url);

      const ogImageMatch = html.match(
        /<meta\s+property="og:image"\s+content="([^"]+)"/,
      );
      expect(ogImageMatch).not.toBeNull();
      const ogImageUrl = ogImageMatch?.[1] ?? '';
      expect(ogImageUrl.startsWith(SHARE_ORIGIN)).toBe(true);

      const { statusCode, contentType } = await fetchAssetHeaders(ogImageUrl);
      expect(statusCode).toBeLessThan(400);
      expect(contentType && contentType.startsWith('image/')).toBe(true);
    }
  }, 60_000);
});
