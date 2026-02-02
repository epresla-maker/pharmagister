import { NextResponse } from 'next/server';

// Domain konfiguráció
const PRIMARY_DOMAIN = 'pharmagister.hu';
const VERCEL_DOMAIN = 'pharmagister.vercel.app'; // vagy ami a Vercel subdomain

// Karbantartási mód konfiguráció
const MAINTENANCE_MODE = true;
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

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Domain átirányítások (www → non-www, vercel → fő domain)
  if (hostname.startsWith('www.') || hostname.includes('.vercel.app')) {
    const newUrl = new URL(request.url);
    newUrl.hostname = PRIMARY_DOMAIN;
    newUrl.port = '';
    return NextResponse.redirect(newUrl, { status: 301 });
  }
  
  // Ha nincs karbantartási mód, engedjük át
  if (!MAINTENANCE_MODE) {
    return NextResponse.next();
  }

  // Ha már lejárt a karbantartás ideje
  if (new Date() > MAINTENANCE_END) {
    return NextResponse.next();
  }

  // Ellenőrizzük az engedélyezett útvonalakat
  const isAllowedPath = ALLOWED_PATHS.some(path => pathname.startsWith(path));
  if (isAllowedPath) {
    return NextResponse.next();
  }

  // Ellenőrizzük a bypass cookie-t (admin hozzáférés)
  const bypassCookie = request.cookies.get('maintenance_bypass');
  if (bypassCookie?.value === 'true') {
    return NextResponse.next();
  }

  // Minden más kérést átirányítunk a maintenance oldalra
  const maintenanceUrl = new URL('/maintenance', request.url);
  return NextResponse.redirect(maintenanceUrl);
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
