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
    key: 'STRIPE_SECRET_KEY',
    invalidPrefixes: ['sk_test_your_', 'sk_live_your_'],
    mustStartWith: ['sk_test_', 'sk_live_'],
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    invalidPrefixes: ['whsec_your_'],
    mustStartWith: ['whsec_'],
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    invalidExact: ['http://localhost:3000'],
    mustStartWith: ['http://', 'https://'],
  },
];

function evaluateValue(rule, rawValue) {
  const value = (rawValue || '').trim();
  if (!value) {
    return { ok: false, message: 'missing' };
  }

  if (rule.invalidExact && rule.invalidExact.includes(value)) {
    return { ok: false, message: `placeholder/default value (${value})` };
  }

  if (rule.invalidPrefixes && rule.invalidPrefixes.some((prefix) => value.startsWith(prefix))) {
    return { ok: false, message: 'placeholder value' };
  }

  if (rule.mustStartWith && !rule.mustStartWith.some((prefix) => value.startsWith(prefix))) {
    return { ok: false, message: `unexpected format (${value.slice(0, 12)}...)` };
  }

  return { ok: true, message: 'ok' };
}

console.log('Stripe setup status\n');

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

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
if (baseUrl) {
  console.log(`\nWebhook endpoint should be: ${baseUrl}/api/payments/stripe-webhook`);
} else {
  console.log('\nWebhook endpoint cannot be derived because NEXT_PUBLIC_APP_URL is missing.');
}

if (hasBlockingIssue) {
  console.log('\nRemaining tasks:');
  let step = 1;
  if (missingKeys.includes('STRIPE_SECRET_KEY')) {
    console.log(`${step}) Set real STRIPE_SECRET_KEY (sk_test_... or sk_live_...).`);
    step += 1;
  }
  if (missingKeys.includes('STRIPE_WEBHOOK_SECRET')) {
    console.log(`${step}) Set real STRIPE_WEBHOOK_SECRET (whsec_...).`);
    step += 1;
  }
  if (missingKeys.includes('NEXT_PUBLIC_APP_URL')) {
    console.log(`${step}) Ensure NEXT_PUBLIC_APP_URL points to your active domain.`);
  }
  process.exitCode = 1;
} else {
  console.log('\nStripe environment looks complete.');
}
