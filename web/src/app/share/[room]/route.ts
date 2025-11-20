import { NextRequest } from 'next/server';
import { buildSharePageHtml } from '../../../../../src/share-page';

const PUBLIC_ORIGIN =
  process.env.HACKBOX_PUBLIC_ORIGIN ?? 'https://hackbox.tv.lozev.ski';

export async function GET(
  request: NextRequest,
  context: { params: { room: string } },
) {
  const { room } = context.params;

  if (!room) {
    return new Response('Missing room', { status: 400 });
  }

  const url = new URL(request.url);
  const playerName = url.searchParams.get('name') ?? undefined;

  const html = buildSharePageHtml({
    origin: PUBLIC_ORIGIN,
    roomName: decodeURIComponent(room),
    gameId: null,
    playerName,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
