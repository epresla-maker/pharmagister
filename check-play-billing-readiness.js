#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const checks = [];

function addCheck(ok, label, details) {
  checks.push({ ok: Boolean(ok), label, details: details || '' });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function includeEnvCheck(name, validator, helpText) {
  const value = envValue(name);
  if (!value) {
    addCheck(false, name, 'missing');
    return;
  }
  const result = validator(value);
  addCheck(result, name, result ? 'ok' : helpText);
}

console.log('Google Play Billing readiness check\n');

includeEnvCheck('NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY', (value) => value.startsWith('goog_'), 'must start with goog_');
includeEnvCheck('NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_REGULAR', (value) => value.length > 0, 'missing product id');
includeEnvCheck('NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_FOUNDER', (value) => value.length > 0, 'missing product id');
includeEnvCheck('REVENUECAT_WEBHOOK_AUTH_TOKEN', (value) => value !== 'your_revenuecat_webhook_bearer_token', 'placeholder value');
includeEnvCheck('REVENUECAT_WEBHOOK_HMAC_SECRET', (value) => value !== 'your_revenuecat_webhook_hmac_secret', 'placeholder value');

const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJsonText = readText(packageJsonPath);
if (!packageJsonText) {
  addCheck(false, 'package.json', 'not found');
} else {
  try {
    const packageJson = JSON.parse(packageJsonText);
    const rcVersion = packageJson.dependencies?.['@revenuecat/purchases-capacitor'];
    addCheck(Boolean(rcVersion), '@revenuecat/purchases-capacitor', rcVersion ? `installed (${rcVersion})` : 'dependency missing');
  } catch (error) {
    addCheck(false, 'package.json', 'invalid json');
  }
}

const gradlePath = path.join(projectRoot, 'android/app/build.gradle');
const gradleText = readText(gradlePath);
if (!gradleText) {
  addCheck(false, 'android/app/build.gradle', 'not found');
} else {
  const appIdMatch = gradleText.match(/applicationId\s+"([^"]+)"/);
  const appId = appIdMatch ? appIdMatch[1] : '';
  addCheck(Boolean(appId), 'applicationId', appId || 'not found');
}

const manifestPath = path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml');
const manifestText = readText(manifestPath);
if (!manifestText) {
  addCheck(false, 'AndroidManifest.xml', 'not found');
} else {
  const hasBillingPermission = manifestText.includes('com.android.vending.BILLING');
  addCheck(hasBillingPermission, 'Billing permission', hasBillingPermission ? 'present' : 'missing com.android.vending.BILLING');

  const launchModeMatch = manifestText.match(/android:launchMode="([^"]+)"/);
  const launchMode = launchModeMatch ? launchModeMatch[1] : '';
  const launchModeOk = launchMode === 'singleTop' || launchMode === 'standard';
  addCheck(launchModeOk, 'MainActivity launchMode', launchMode || 'missing');
}

let failed = 0;
for (const item of checks) {
  const status = item.ok ? 'OK' : 'MISSING';
  if (!item.ok) failed += 1;
  console.log(`${status.padEnd(8)} ${item.label}${item.details ? ` - ${item.details}` : ''}`);
}

if (failed > 0) {
  console.log('\nResult: local setup is incomplete. Fix the MISSING lines first.');
  process.exitCode = 1;
} else {
  console.log('\nResult: local Play Billing setup looks ready.');
  console.log('Next: complete Google Play Console + RevenueCat dashboard linking and test track purchase.');
}