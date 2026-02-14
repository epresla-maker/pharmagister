// next.config.mobile.js
// Ez a konfiguráció CSAK a mobil appok buildjeléhez használatos
// A normál PWA deployment a next.config.js-t használja

/** @type {import('next').NextConfig} */
const nextConfigMobile = {
  // Turbopack config - üres, hogy ne legyen konfliktus
  turbopack: {},
  
  // Static export Capacitorhoz
  output: 'export',
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // Trailing slash kötelező static exportnál
  trailingSlash: true,
  
  // Base path konfiguráció (ha kell)
  // basePath: '',
  
  // Asset prefix statichoz
  assetPrefix: '',
  
  // Compiler optimalizációk
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  
  // Webpack config eltávolítva - Turbopack-et használunk
};

module.exports = nextConfigMobile;
