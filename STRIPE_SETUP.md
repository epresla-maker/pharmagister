# Stripe setup for Pharmagister

This project already contains the payment flow:

- Checkout session creation in [app/api/payments/create-checkout-session/route.js](app/api/payments/create-checkout-session/route.js)
- Webhook processing in [app/api/payments/stripe-webhook/route.js](app/api/payments/stripe-webhook/route.js)
- Payment trigger from the pharmacy dashboard in [app/components/PharmaDashboard.js](app/components/PharmaDashboard.js)

## 1) Create a Stripe account and get keys

1. Log in to Stripe Dashboard.
2. Go to Developers → API keys.
3. Copy the Secret key and keep it in a local environment file.
4. Copy the webhook secret after setting up the webhook endpoint.

## 2) Add environment variables

Create a local file named `.env.local` in the project root and paste:

```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

The project also expects the Firebase variables already in the environment file, as shown in [.env.local.example](.env.local.example).

## 3) Register the Stripe webhook

In Stripe Dashboard:

1. Go to Developers → Webhooks.
2. Click Add endpoint.
3. Set the endpoint URL:
   - Local: `http://localhost:3000/api/payments/stripe-webhook`
   - Production: `https://your-domain.com/api/payments/stripe-webhook`
4. Select the events:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy the webhook signing secret and save it as `STRIPE_WEBHOOK_SECRET`.

## 4) Local test with Stripe CLI

If you want to test locally without using a public deployment:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/payments/stripe-webhook
```

Use the printed `whsec_...` value as `STRIPE_WEBHOOK_SECRET`.

## 5) Test payment

Use Stripe test card:

```text
4242 4242 4242 4242
```

- Expiry: any future date
- CVC: any 3 digits

## 6) Verify flow

After setting the variables and webhook:

1. Start the app:
   ```bash
   npm run dev
   ```
2. Log in as a pharmacy user.
3. Trigger the credit package purchase from the dashboard.
4. Complete the test checkout in Stripe.
5. Confirm that the webhook updates the user credit balance and the purchase intent status.

Quick environment readiness check:

```bash
npm run check:stripe
```

This validates `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL`, and prints the webhook endpoint URL that should be configured in Stripe.

## 7) Production check list

- Set `NEXT_PUBLIC_APP_URL` to the live domain.
- Set Stripe secret key to a live key, not test key.
- Register the live webhook endpoint in Stripe.
- Confirm that HTTPS is enabled in production.
- Test a real payment in Stripe test mode first.

## 8) Vercel environment sync (automated)

This repository contains a helper script that pushes Stripe variables from `.env.local` to Vercel:

```bash
npm run sync:stripe:vercel
```

What it updates in Vercel:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Prerequisites:

1. `vercel login`
2. Link the correct project in this folder (`vercel link`)
3. Ensure `.env.local` contains real values (not placeholders)

To update all Vercel environments (development + preview + production), run:

```bash
bash ./set-stripe-vercel-env.sh --all
```

This project is already wired for Stripe checkout and webhook crediting; the remaining work is only the actual Stripe account configuration and environment values.
