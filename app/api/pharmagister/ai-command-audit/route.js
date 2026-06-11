import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { resolveMarketFromRequest } from '@/lib/market';

export const runtime = 'nodejs';

function getAuditApiCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      missingEventType: 'eventType fehlt',
      saveFailed: 'Audit-Speicherung fehlgeschlagen',
    };
  }

  return {
    unauthorized: 'Nincs jogosultsag',
    missingEventType: 'Hianyzo eventType',
    saveFailed: 'Audit mentes sikertelen',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getAuditApiCopy(requestMarket);
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const body = await request.json();
    const eventType = String(body?.eventType || '').trim();
    const details = body?.details && typeof body.details === 'object' ? body.details : {};
    const context = body?.context && typeof body.context === 'object' ? body.context : {};

    if (!eventType) {
      return NextResponse.json({ error: copy.missingEventType }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    await db.collection('users').doc(authUser.uid).collection('bettiAudit').add({
      eventType,
      details,
      context,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
      source: 'ai-command-gateway',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ai-command-audit] failed:', error);
    const copy = getAuditApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ success: false, error: copy.saveFailed }, { status: 500 });
  }
}
