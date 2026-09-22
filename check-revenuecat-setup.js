#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const checks = [
  {
    key: 'NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY',
    invalidPrefixes: ['appl_your_'],
    mustStartWith: ['appl_'],
  },
  {
    key: 'NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY',
    invalidPrefixes: ['goog_your_'],
    mustStartWith: ['goog_'],
  },
  {
    key: 'NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_REGULAR',
    allowExample: true,
  },
  {
    key: 'NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_REGULAR',
    allowExample: true,
  },
  {
    key: 'NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_FOUNDER',
    allowExample: true,
  },
  {
    key: 'NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_FOUNDER',
    allowExample: true,
  },
  {
    key: 'REVENUECAT_WEBHOOK_AUTH_TOKEN',
    invalidExact: ['your_revenuecat_webhook_bearer_token'],
  },
  {
    key: 'REVENUECAT_WEBHOOK_HMAC_SECRET',
    invalidExact: ['your_revenuecat_webhook_hmac_secret'],
  },
];

function evaluateValue(rule, rawValue) {
  const value = (rawValue || '').trim();
  if (!value) {
    return { ok: false, message: 'missing' };
  }

  if (rule.invalidExact && rule.invalidExact.includes(value)) {
    return { ok: false, message: 'placeholder/example value' };
  }

  if (rule.invalidPrefixes && rule.invalidPrefixes.some((prefix) => value.startsWith(prefix))) {
    return { ok: false, message: 'placeholder value' };
  }

  if (rule.mustStartWith && !rule.mustStartWith.some((prefix) => value.startsWith(prefix))) {
    return { ok: false, message: `unexpected format (${value.slice(0, 12)}...)` };
  }

  if (rule.allowExample) {
    return { ok: true, message: 'set' };
  }

  return { ok: true, message: 'ok' };
}

console.log('RevenueCat native payment setup status\n');

let hasBlockingIssue = false;
const missingKeys = [];

for (const rule of checks) {
  const result = evaluateValue(rule, process.env[rule.key]);
  const status = result.ok ? 'OK' : 'MISSING';
  if (!result.ok) {
    hasBlockingIssue = true;
    missingKeys.push(rule.key);
  }
  console.log(`${status.padEnd(8)} ${rule.key} - ${result.message}`);
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
if (appUrl) {
  console.log(`\nRevenueCat webhook URL should be: ${appUrl}/api/payments/revenuecat-webhook`);
}

if (hasBlockingIssue) {
  console.log('\nRemaining manual configuration:');
  missingKeys.forEach((key, index) => {
    console.log(`${index + 1}) Set ${key}`);
  });
  process.exitCode = 1;
} else {
  console.log('\nRevenueCat environment looks complete.');
}