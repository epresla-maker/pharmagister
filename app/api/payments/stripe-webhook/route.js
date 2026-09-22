import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(request) {
  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');
  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Stripe webhook signature validation failed:', error.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const intentId = session.metadata?.intentId;
      const userId = session.metadata?.userId;

      if (!intentId || !userId) {
        return Response.json({ received: true });
      }

      const creditAmount = Math.max(
        1,
        Number(session.metadata?.packageCredits || 4)
      );

      await db.runTransaction(async (tx) => {
        const intentRef = db.collection('demandCreditPurchaseIntents').doc(intentId);
        const intentSnap = await tx.get(intentRef);
        if (!intentSnap.exists) {
          return;
        }

        const intent = intentSnap.data() || {};
        const userRef = db.collection('users').doc(userId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          return;
        }

        const userData = userSnap.data() || {};
        const currentTotal = Math.max(0, Number(userData.demandCreditsTotal) || 0);
        const currentUsed = Math.max(0, Number(userData.demandCreditsUsed) || 0);
        const nextTotal = currentTotal + creditAmount;

        tx.update(userRef, {
          demandCreditsTotal: nextTotal,
          demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          demandCreditsUpdatedBy: 'stripe-webhook',
          demandCreditsUpdatedByEmail: userData.email || '',
        });

        tx.update(intentRef, {
          status: 'credited',
          creditedCredits: creditAmount,
          paymentProvider: 'stripe',
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || intent.stripePaymentIntentId || null,
          paymentRef: session.payment_intent || '',
          creditedAt: admin.firestore.FieldValue.serverTimestamp(),
          creditedByUid: 'stripe-webhook',
          creditedByEmail: 'stripe-webhook',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: 'stripe-webhook',
          updatedByEmail: 'stripe-webhook',
          adminNote: 'Stripe fizetés alapjan automatikusan jovairva.',
        });

        const logRef = db.collection('demandCreditAdminAdjustments').doc();
        tx.set(logRef, {
          userId,
          userEmail: userData.email || '',
          pharmacyName: userData.pharmacyName || userData.displayName || '',
          mode: 'stripe_checkout_credit',
          intentId,
          delta: creditAmount,
          previousTotal: currentTotal,
          previousUsed: currentUsed,
          nextTotal,
          nextUsed: currentUsed,
          paymentRef: session.payment_intent || '',
          note: 'Stripe checkout completed',
          adminUid: 'stripe-webhook',
          adminEmail: 'stripe-webhook',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const intentId = session.metadata?.intentId;
      if (intentId) {
        await db.collection('demandCreditPurchaseIntents').doc(intentId).update({
          status: 'rejected',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          adminNote: 'Stripe fizetes lejart.',
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
