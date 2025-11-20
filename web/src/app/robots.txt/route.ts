export function GET() {
  const body = [
    'User-agent: *',
    'Disallow:',
    '',
    'Sitemap: https://hackbox.tv.lozev.ski/sitemap.xml',
    '',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
