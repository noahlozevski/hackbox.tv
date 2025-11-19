import { describe, it, expect } from 'vitest';
import { buildSharePageHtml } from './share-page';

describe('share page HTML generator', () => {
  it('generates room-only share page with correct OG metadata and redirect', () => {
    const html = buildSharePageHtml({
      origin: 'https://example.com',
      roomName: 'Room42',
      gameId: null,
    });

    expect(html).toContain('Join room Room42 on hackbox.tv');
    expect(html).toContain('content="https://example.com/share/Room42"');
    expect(html).toContain('https://example.com/?room=Room42');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('generates room + game share page using friendly game name and proper target', () => {
    const html = buildSharePageHtml({
      origin: 'https://example.com',
      roomName: 'MainRoom',
      gameId: 'ticTacToe',
    });

    expect(html).toContain('Join Tic-Tac-Toe in MainRoom on hackbox.tv');
    expect(html).toContain(
      'content="https://example.com/share/MainRoom/ticTacToe"',
    );
    expect(html).toContain(
      'https://example.com/?room=MainRoom&amp;game=ticTacToe',
    );
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:title"');
  });
});
