// app/layout.js
import { Inter } from "next/font/google";
import { cookies, headers } from 'next/headers';
import "./globals.css";
import ClientProviders from "@/app/components/ClientProviders";
import { MARKET_COOKIE, getMarketFromAcceptLanguage, getMarketFromHost, marketToLang, normalizeMarket } from '@/lib/market';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Pharmagister - Pharmacy Shift Coverage",
  description: "Pharmacy shift coverage platform",
  manifest: "https://pharmagister.hu/manifest.json",
  appleWebAppCapable: "yes",
  appleWebAppStatusBarStyle: "default",
};

export const viewport = {
  themeColor: "#6B46C1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const marketCookie = cookieStore.get(MARKET_COOKIE)?.value;
  const market = marketCookie
    ? normalizeMarket(marketCookie)
    : getMarketFromAcceptLanguage(headersList.get('accept-language') || '') || getMarketFromHost(host);
  const lang = marketToLang(market);

  return (
    <html lang={lang}>
      <head>
        <meta name="application-name" content="Pharmagister" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pharmagister" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.className}`}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
