import Stripe from 'stripe';

let stripeInstance;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey);
  }

  return stripeInstance;
}

export function getAppBaseUrl(requestOrUrl) {
  if (typeof requestOrUrl === 'string') {
    return requestOrUrl.replace(/\/$/, '');
  }

  if (requestOrUrl && typeof requestOrUrl.url === 'string') {
    const url = new URL(requestOrUrl.url);
    return url.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
