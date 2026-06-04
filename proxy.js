import { NextResponse } from 'next/server';
import {
  MARKET_COOKIE,
  getMarketDomains,
  getMarketFromHost as resolveMarketFromHost,
  normalizeMarket,
} from './lib/market';

// Domain konfiguráció
const { hu: HU_DOMAIN, de: DE_DOMAIN } = getMarketDomains();

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
  const selectedMarket = normalizeMarket(request.cookies.get(MARKET_COOKIE)?.value);

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

  // preview/vercel hostok átirányítása a választott market domainre
  if (hostWithoutPort.includes('.vercel.app')) {
    const newUrl = new URL(request.url);
    newUrl.hostname = selectedMarket === 'de' ? DE_DOMAIN : HU_DOMAIN;
    newUrl.port = '';
    return setMarketCookie(
      NextResponse.redirect(newUrl, { status: 302 }),
      selectedMarket
    );
  }

  // Ha nincs karbantartási mód, engedjük át
  if (!MAINTENANCE_MODE) {
    return setMarketCookie(NextResponse.next(), resolveMarketFromHost(hostWithoutPort));
  }

  // Ha már lejárt a karbantartás ideje
  if (new Date() > MAINTENANCE_END) {
    return NextResponse.next();
  }

  // Ellenőrizzük az engedélyezett útvonalakat
  const isAllowedPath = ALLOWED_PATHS.some(path => pathname.startsWith(path));
  if (isAllowedPath) {
    return setMarketCookie(NextResponse.next(), resolveMarketFromHost(hostWithoutPort));
  }

  // Ellenőrizzük a bypass cookie-t (admin hozzáférés)
  const bypassCookie = request.cookies.get('maintenance_bypass');
  if (bypassCookie?.value === 'true') {
    return setMarketCookie(NextResponse.next(), resolveMarketFromHost(hostWithoutPort));
  }

  // Minden más kérést átirányítunk a maintenance oldalra
  const maintenanceUrl = new URL('/maintenance', request.url);
  return setMarketCookie(
    NextResponse.redirect(maintenanceUrl),
    resolveMarketFromHost(hostWithoutPort)
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