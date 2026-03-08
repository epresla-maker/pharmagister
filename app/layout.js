// app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/app/components/ClientProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Pharmagister - Gyógyszertári helyettesítés",
  description: "Gyógyszertári helyettesítés platform",
  manifest: "/manifest.json",
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
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hu">
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
