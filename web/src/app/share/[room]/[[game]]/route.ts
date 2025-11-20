import { NextRequest } from 'next/server';
import { buildSharePageHtml } from '../../../../../../src/share-page';

const PUBLIC_ORIGIN =
  process.env.HACKBOX_PUBLIC_ORIGIN ?? 'https://hackbox.tv.lozev.ski';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ room: string; game?: string }> },
) {
  const { room, game } = await context.params;
  const roomParam = room;
  const gameId = game ?? null;

  if (!roomParam) {
    return new Response('Missing room', { status: 400 });
  }

  const url = new URL(request.url);
  const playerName = url.searchParams.get('name') ?? undefined;

  const html = buildSharePageHtml({
    origin: PUBLIC_ORIGIN,
    roomName: decodeURIComponent(roomParam),
    gameId: gameId ? decodeURIComponent(gameId) : null,
    playerName,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
