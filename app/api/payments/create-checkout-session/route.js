import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { getDemandPackageOffer, getDemandCreditBalance } from '@/lib/demandCredits';
import { getStripe, getAppBaseUrl } from '@/lib/stripe';

export const runtime = 'nodejs';
const STRIPE_MIN_CHARGE_HUF = 175;

function toStripeMinorAmountHuf(amountHuf) {
  const parsed = Number(amountHuf);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  // Stripe account/API version expects HUF in minor units.
  return Math.round(parsed * 100);
}

export async function POST(request) {
  let admin;
  let intentRef = null;
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: 'Nincs jogosultsag', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    admin = getFirebaseAdmin();
    const db = admin.firestore();
    const clientPlatform = String(request.headers.get('x-pharmagister-client-platform') || 'web').trim().toLowerCase();

    if (clientPlatform === 'ios' || clientPlatform === 'android') {
      return Response.json({
        error: 'A kreditvasarlas a mobilalkalmazasban nem erheto el. Kerdjuk, hasznald a webes verziot.',
        code: 'WEB_ONLY_CHECKOUT',
      }, { status: 403 });
    }

    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    if (userData.pharmagisterRole !== 'pharmacy') {
      return Response.json({ error: 'Csak gyogyszertar fiok tud csomagot venni.', code: 'PHARMACY_ONLY' }, { status: 403 });
    }

    if (!userData.pharmaProfileComplete) {
      return Response.json({ error: 'Elobb toltsd ki a profilodat.', code: 'PROFILE_INCOMPLETE' }, { status: 400 });
    }

    const creditBalance = getDemandCreditBalance(userData);
    if (!creditBalance.decreaseActive) {
      return Response.json({ error: 'A kreditvasarlas meg nem aktivalt.', code: 'PAYMENT_NOT_ACTIVE' }, { status: 400 });
    }

    const offer = getDemandPackageOffer(userData);
    const forcedTestPriceRaw = process.env.STRIPE_TEST_PRICE_HUF;
    const forcedTestPrice = Number(forcedTestPriceRaw);
    const hasForcedTestPrice = Number.isFinite(forcedTestPrice) && forcedTestPrice > 0;

    const requestedPriceHuf = hasForcedTestPrice
      ? forcedTestPrice
      : Number(offer.finalPriceHuf);

    const effectivePriceHuf = Math.max(STRIPE_MIN_CHARGE_HUF, Math.round(requestedPriceHuf || 0));
    const unitAmount = toStripeMinorAmountHuf(effectivePriceHuf);

    if (hasForcedTestPrice && forcedTestPrice < STRIPE_MIN_CHARGE_HUF) {
      console.warn(`STRIPE_TEST_PRICE_HUF (${forcedTestPrice}) below Stripe minimum, using ${STRIPE_MIN_CHARGE_HUF} HUF.`);
    }

    if (unitAmount <= 0) {
      return Response.json({
        error: 'Ervenytelen csomagar. Kerlek probald ujra kesobb.',
        code: 'INVALID_PACKAGE_PRICE',
      }, { status: 400 });
    }

    const requesterName = userData.contactName || userData.displayName || userData.pharmacyName || authUser.email || userData.email || '';

    intentRef = await db.collection('demandCreditPurchaseIntents').add({
      userId: authUser.uid,
      email: authUser.email || userData.email || '',
      requesterName,
      pharmacyName: userData.pharmacyName || '',
      market: userData.market || 'hu',
      packageCredits: offer.packageCredits,
      basePriceHuf: offer.basePriceHuf,
      discountPercent: offer.discountPercent,
      catalogFinalPriceHuf: offer.finalPriceHuf,
      finalPriceHuf: effectivePriceHuf,
      stripeUnitAmount: unitAmount,
      testPriceOverrideHuf: hasForcedTestPrice ? forcedTestPrice : null,
      founderDiscountApplied: offer.discountPercent > 0,
      founderValidUntil: offer.founder?.validUntil || null,
      status: 'pending_payment',
      paymentProvider: 'stripe',
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const stripe = getStripe();
    const appBaseUrl = getAppBaseUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'huf',
          unit_amount: unitAmount,
          product_data: {
            name: `${offer.packageCredits} db helyettesítési igény kredit csomag`,
            description: 'Pharmagister igényfeladási kredit csomag',
          },
        },
      }],
      success_url: `${appBaseUrl}/pharmagister?tab=dashboard&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/pharmagister?tab=dashboard&payment=cancelled`,
      client_reference_id: authUser.uid,
      customer_email: authUser.email || userData.email || undefined,
      metadata: {
        userId: authUser.uid,
        intentId: intentRef.id,
        requesterName,
        packageCredits: String(offer.packageCredits),
        finalPriceHuf: String(effectivePriceHuf),
        catalogFinalPriceHuf: String(offer.finalPriceHuf),
        stripeUnitAmount: String(unitAmount),
        testPriceOverrideHuf: hasForcedTestPrice ? String(forcedTestPrice) : '',
        market: userData.market || 'hu',
      },
      payment_method_types: ['card'],
    });

    await intentRef.update({
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,
      intentId: intentRef.id,
      sessionId: session.id,
      url: session.url,
      offer,
    });
  } catch (error) {
    if (intentRef && admin) {
      try {
        await intentRef.update({
          status: 'rejected',
          adminNote: `Stripe checkout letrehozas sikertelen: ${error?.message || 'ismeretlen hiba'}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        console.error('Failed to update purchase intent after checkout error:', updateError);
      }
    }

    console.error('Stripe checkout session creation failed:', error);
    return Response.json({
      error: error?.message || 'Hiba tortent a fizetesi session letrehozasakor.',
      code: 'CHECKOUT_SESSION_FAILED',
    }, { status: 500 });
  }
}
