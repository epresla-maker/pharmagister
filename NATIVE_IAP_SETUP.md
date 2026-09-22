# Native IAP setup for Pharmagister

This project now supports:

- Web: Stripe Checkout
- iOS app: App Store In-App Purchase via RevenueCat
- Android app: Google Play Billing via RevenueCat

## Code paths

- Native client purchase flow: `app/components/PharmaDashboard.js`
- RevenueCat client helper: `lib/revenuecat.js`
- Product mapping: `lib/nativeDemandCreditProducts.js`
- RevenueCat webhook: `app/api/payments/revenuecat-webhook/route.js`
- Web Stripe checkout: `app/api/payments/create-checkout-session/route.js`

## 1. RevenueCat project

Create a RevenueCat project and connect both store apps:

- App Store app for `com.pharmagister.app`
- Google Play app for `com.pharmagister.app`

Collect these public SDK keys:

- Apple public SDK key
- Google public SDK key

Add them to environment variables:

```bash
NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_...
NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_...
```

## 2. Store products

Create one-time products for the native app.

Recommended product IDs:

- `pharmagister_4_credits_regular`
- `pharmagister_4_credits_founder`

Expected business meaning:

- regular = 4 credits, normal price
- founder = 4 credits, founder price

Add the IDs to env:

```bash
NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_REGULAR=pharmagister_4_credits_regular
NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_REGULAR=pharmagister_4_credits_regular
NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_FOUNDER=pharmagister_4_credits_founder
NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_FOUNDER=pharmagister_4_credits_founder
```

## 3. RevenueCat webhook

Create a webhook in RevenueCat that points to:

```text
https://pharmagister.hu/api/payments/revenuecat-webhook
```

Configure:

- Authorization header: `Bearer <token>`
- HMAC signing: enabled

Add env:

```bash
REVENUECAT_WEBHOOK_AUTH_TOKEN=...
REVENUECAT_WEBHOOK_HMAC_SECRET=...
```

Handled events:

- `NON_RENEWING_PURCHASE`
- `INITIAL_PURCHASE`
- `CANCELLATION`
- `TEST`

The webhook updates:

- `users.demandCreditsTotal`
- `demandCreditPurchaseIntents`
- `demandCreditAdminAdjustments`
- `revenueCatWebhookEvents`

## 4. iOS project requirements

In Xcode for the iOS target:

1. Enable `In-App Purchase` capability
2. Ensure Swift Language Version is 5.0+
3. Rebuild after `npx cap sync ios`

## 5. Android project requirements

After installing the plugin, run:

```bash
npx cap sync android
```

Check the main activity launchMode in `AndroidManifest.xml`:

- use `standard` or `singleTop`

This avoids purchase cancellation when Google Play sends the user to a banking or verification app.

## 6. Local dependency sync

After pulling these changes:

```bash
npm install
npx cap sync ios
npx cap sync android
```

## 7. Production env checklist

Required native IAP env values:

- `NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY`
- `NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY`
- `NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_REGULAR`
- `NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_REGULAR`
- `NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_FOUNDER`
- `NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_FOUNDER`
- `REVENUECAT_WEBHOOK_AUTH_TOKEN`
- `REVENUECAT_WEBHOOK_HMAC_SECRET`

Quick local readiness check:

```bash
npm run check:revenuecat
```

Push RevenueCat env vars to Vercel:

```bash
npm run sync:revenuecat:vercel
```

To update development + preview + production too:

```bash
bash ./set-revenuecat-vercel-env.sh --all
```

## 8. Expected behavior

- Browser users keep using Stripe Checkout
- Native app users see official in-app purchase flow
- Credits are granted server-side only after RevenueCat webhook confirmation
- Founder users are routed to founder product IDs when their profile is eligible

## 9. Important limitation

This code is ready for official native store billing, but store-console work is still required:

- App Store Connect product creation
- Google Play Console product creation
- RevenueCat dashboard configuration
- RevenueCat webhook configuration
- Vercel environment variables

Until those are configured, native purchase UI will show a configuration warning instead of a working price/product.
