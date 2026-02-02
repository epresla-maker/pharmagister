import { NextResponse } from 'next/server';

// Karbantartási mód konfiguráció
const MAINTENANCE_MODE = true;
const MAINTENANCE_END = new Date('2026-02-03T10:00:00');

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
