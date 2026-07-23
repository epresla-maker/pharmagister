import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { normalizeMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const admin = getFirebaseAdmin();
    const auth = getAuth(admin);
    
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userEmail = decodedToken.email;
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { market = 'hu', cleanup = true } = await request.json();
    const normalizedMarket = normalizeMarket(market);

    // Call the cron endpoint directly
    const cronUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu'}/api/cron/auto-feed-posts`);
    cronUrl.searchParams.set('market', normalizedMarket);
    if (cleanup) cronUrl.searchParams.set('cleanup', '1');

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const cronResponse = await fetch(cronUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const cronData = await cronResponse.json();

    if (!cronResponse.ok) {
      return NextResponse.json(
        { error: 'Cron execution failed', details: cronData },
        { status: cronResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `AI posztok ${cleanup ? 'frissítve' : 'generálva'}`,
      result: cronData,
    });
  } catch (error) {
    console.error('trigger-ai-posts error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
