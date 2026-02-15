import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const snapshot = await db.collection('sentEmails')
      .orderBy('sentAt', 'desc')
      .limit(50)
      .get();

    const emails = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        to: data.to || [],
        failedTo: data.failedTo || [],
        subject: data.subject || '',
        body: data.body || '',
        sentAt: data.sentAt ? data.sentAt.toDate().toISOString() : null,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || 0,
        from: data.from || 'info@pharmagister.hu',
      };
    });

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
