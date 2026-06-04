import { NextResponse } from 'next/server';
import {
  MARKET_COOKIE,
  getMarketUrls,
  normalizeMarket,
} from '@/lib/market';

function sanitizeNextPath(nextPath) {
  const path = String(nextPath || '/');
  if (!path.startsWith('/')) {
    return '/';
  }
  if (path.startsWith('//')) {
    return '/';
  }
  return path;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedMarket = normalizeMarket(searchParams.get('market'));
  const nextPath = sanitizeNextPath(searchParams.get('next'));
  const marketUrls = getMarketUrls();

  const targetBase = requestedMarket === 'de' ? marketUrls.de : marketUrls.hu;
  const targetUrl = new URL(targetBase);
  targetUrl.pathname = nextPath;

  const response = NextResponse.redirect(targetUrl, { status: 302 });
  response.cookies.set(MARKET_COOKIE, requestedMarket, {
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
