import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultsag' }, { status: 401 });
    }

    const body = await request.json();
    const eventType = String(body?.eventType || '').trim();
    const details = body?.details && typeof body.details === 'object' ? body.details : {};
    const context = body?.context && typeof body.context === 'object' ? body.context : {};

    if (!eventType) {
      return NextResponse.json({ error: 'Hianyzo eventType' }, { status: 400 });
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
    return NextResponse.json({ success: false, error: 'Audit mentes sikertelen' }, { status: 500 });
  }
}
