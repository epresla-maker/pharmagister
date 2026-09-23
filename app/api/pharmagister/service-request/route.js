import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { getDemandPackageOffer } from '@/lib/demandCredits';
import { normalizePharmagisterRole } from '@/lib/pharmagisterProfile';

const SERVICE_FRAME_WINDOW_DAYS = 8;

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultsag', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    const normalizedRole = normalizePharmagisterRole(userData.pharmagisterRole || userData.pharmaRole || userData.role);
    if (normalizedRole !== 'pharmacy') {
      return NextResponse.json({ error: 'Csak gyogyszertar fiok tud keretigénylést küldeni.', code: 'PHARMACY_ONLY' }, { status: 403 });
    }

    const existingPendingSnap = await db.collection('demandCreditPurchaseIntents')
      .where('userId', '==', authUser.uid)
      .where('status', '==', 'pending_payment')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!existingPendingSnap.empty) {
      const existingDoc = existingPendingSnap.docs[0];
      const existingData = existingDoc.data() || {};
      const existingDueAt = existingData.dueAt?.toDate?.() || null;
      return NextResponse.json({
        success: true,
        alreadyPending: true,
        requestId: existingDoc.id,
        dueAt: existingDueAt ? existingDueAt.toISOString() : null,
        queue: 'internal_admin_queue',
      });
    }

    const offer = getDemandPackageOffer(userData || {});
    const packageCredits = Math.max(1, Number(offer?.packageCredits || 1));
    const finalPriceHuf = Math.max(0, Number(offer?.finalPriceHuf || 0));
    const dueAt = new Date(Date.now() + SERVICE_FRAME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const requesterName = userData.contactName || userData.displayName || userData.pharmacyName || authUser.email || userData.email || '';
    const invoiceSummary = {
      invoiceType: 'service_frame',
      pharmacyName: userData.pharmacyName || '',
      contactName: userData.contactName || requesterName,
      email: authUser.email || userData.email || '',
      phone: userData.pharmaPhone || userData.phone || '',
      city: userData.pharmacyCity || '',
      zipCode: userData.pharmacyZipCode || '',
      market: userData.market || 'hu',
      packageCredits,
      finalPriceHuf,
      dueAt: dueAt.toISOString(),
      issuedAt: new Date().toISOString(),
      status: 'pending_payment',
    };

    const payload = {
      userId: authUser.uid,
      email: authUser.email || userData.email || '',
      requesterName,
      pharmacyName: userData.pharmacyName || '',
      pharmacyCity: userData.pharmacyCity || '',
      pharmacyZipCode: userData.pharmacyZipCode || '',
      contactName: userData.contactName || requesterName,
      phone: userData.pharmaPhone || userData.phone || '',
      market: userData.market || 'hu',
      packageCredits,
      basePriceHuf: Number(offer?.basePriceHuf || 0),
      discountPercent: Number(offer?.discountPercent || 0),
      finalPriceHuf,
      founderDiscountApplied: Boolean(offer?.discountPercent > 0),
      status: 'pending_payment',
      paymentProvider: 'internal_admin_queue',
      serviceRequestType: 'service_frame_request',
      sentToAdminEmail: 'internal_admin_queue',
      invoiceSummary,
      dueAt: admin.firestore.Timestamp.fromDate(dueAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const requestRef = await db.collection('demandCreditPurchaseIntents').add(payload);

    await requestRef.update({
      adminQueueSource: 'internal_service_frame_message',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      requestId: requestRef.id,
      dueAt: dueAt.toISOString(),
      queue: 'internal_admin_queue',
    });
  } catch (error) {
    console.error('Service request creation failed:', error);
    return NextResponse.json({
      error: 'A szolgáltatási keret igénylése sikertelen volt.',
      code: 'SERVICE_REQUEST_FAILED',
    }, { status: 500 });
  }
}
