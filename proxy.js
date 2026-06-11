import { NextResponse } from 'next/server';
import {
  MARKET_COOKIE,
  getMarketFromAcceptLanguage,
  getMarketFromHost as resolveMarketFromHost,
  normalizeMarket,
} from './lib/market';

// Karbantartási mód konfiguráció
const MAINTENANCE_MODE = false; // Kikapcsolva - ne töröld!
const MAINTENANCE_END = new Date('2026-02-03T23:59:00');

// Ezek az útvonalak mindig elérhetők
const ALLOWED_PATHS = [
  '/maintenance',
  '/api/',
  '/_next/',
  '/icons/',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
];

function setMarketCookie(response, market) {
  response.cookies.set(MARKET_COOKIE, market, {
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const hostWithoutPort = hostname.toLowerCase().split(':')[0];
  const cookieMarket = request.cookies.get(MARKET_COOKIE)?.value;
  const selectedMarket = cookieMarket ? normalizeMarket(cookieMarket) : null;
  const localeMarket = getMarketFromAcceptLanguage(request.headers.get('accept-language') || '');
  const resolvedMarket = selectedMarket || localeMarket || resolveMarketFromHost(hostWithoutPort);

  // www → non-www (HU/DE domain megtartásával)
  if (hostWithoutPort.startsWith('www.')) {
    const newUrl = new URL(request.url);
    const bare = hostWithoutPort.replace(/^www\./, '');
    newUrl.hostname = bare;
    newUrl.port = '';
    return setMarketCookie(
      NextResponse.redirect(newUrl, { status: 301 }),
      resolveMarketFromHost(bare)
    );
  }

  // Vercel preview és a normál domain is ugyanazon hoston marad, csak a market cookie változik
  if (hostWithoutPort.includes('.vercel.app')) {
    const newUrl = new URL(request.url);
    newUrl.protocol = 'https:';
    newUrl.hostname = 'pharmagister.hu';
    newUrl.port = '';
    return setMarketCookie(
      NextResponse.redirect(newUrl, { status: 308 }),
      resolvedMarket
    );
  }

  // Ha nincs karbantartási mód, engedjük át
  if (!MAINTENANCE_MODE) {
    return setMarketCookie(NextResponse.next(), resolvedMarket);
  }

  // Ha már lejárt a karbantartás ideje
  if (new Date() > MAINTENANCE_END) {
    return NextResponse.next();
  }

  // Ellenőrizzük az engedélyezett útvonalakat
  const isAllowedPath = ALLOWED_PATHS.some(path => pathname.startsWith(path));
  if (isAllowedPath) {
    return setMarketCookie(NextResponse.next(), resolvedMarket);
  }

  // Ellenőrizzük a bypass cookie-t (admin hozzáférés)
  const bypassCookie = request.cookies.get('maintenance_bypass');
  if (bypassCookie?.value === 'true') {
    return setMarketCookie(NextResponse.next(), resolvedMarket);
  }

  // Minden más kérést átirányítunk a maintenance oldalra
  const maintenanceUrl = new URL('/maintenance', request.url);
  return setMarketCookie(
    NextResponse.redirect(maintenanceUrl),
    resolvedMarket
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};