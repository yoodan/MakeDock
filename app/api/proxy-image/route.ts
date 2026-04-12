import { NextResponse } from 'next/server';

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.local')) {
    return true;
  }

  if (/^127\./.test(host)) {
    return true;
  }

  if (/^10\./.test(host)) {
    return true;
  }

  if (/^192\.168\./.test(host)) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return true;
  }

  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');

  if (!target) {
    return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http and https URLs are supported' }, { status: 400 });
  }

  if (isPrivateOrLocalHost(targetUrl.hostname)) {
    return NextResponse.json({ error: 'Blocked host' }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 },
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream responded with ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Upstream resource is not an image' }, { status: 415 });
    }

    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }
}
