import { NextResponse } from 'next/server';
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
import webpush from 'web-push';
import { verifyAuth } from '@/lib/apiAuth';
import { escapeHtml } from '@/lib/sanitize';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

const ADMIN_UID = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2';

export async function POST(request) {
  try {
    // Verify authenticated user
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const { reportType, reportedUserName, reason, details } = await request.json();

    // === 1. In-app notification Firestore-ba ===
    try {
      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      const notifMessage = `${reason} – ${reportedUserName || reportType}`;
      await db.collection('notifications').add({
        userId: ADMIN_UID,
        type: 'content_report',
        title: 'Új bejelentés érkezett',
        message: notifMessage,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        url: '/admin',
      });
      console.log('[Report API] Firestore notification created for admin');
    } catch (notifErr) {
      console.error('[Report API] Firestore notification failed:', notifErr);
    }

    // === 2. Push notification küldése admin-nak ===
    try {
      const admin = getFirebaseAdmin();
      const db = admin.firestore();

      const subsSnapshot = await db.collection('pushSubscriptions')
        .where('userId', '==', ADMIN_UID)
        .get();

      const notifMessage = `${reason} – ${reportedUserName || reportType}`;
      let sent = 0;

      for (const subDoc of subsSnapshot.docs) {
        const sub = subDoc.data();
        
        // === FCM token alapú push (iOS/Android native) ===
        const fcmToken = sub.subscription?.token;
        if (fcmToken) {
          try {
            await admin.messaging().send({
              token: fcmToken,
              notification: {
                title: 'Új bejelentés érkezett',
                body: notifMessage
              },
              data: {
                url: '/admin',
                tag: `content_report-${Date.now()}`
              },
              apns: {
                payload: {
                  aps: {
                    alert: { title: 'Új bejelentés érkezett', body: notifMessage },
                    badge: 1,
                    sound: 'default'
                  }
                }
              }
            });
            sent++;
            console.log('[Report API] FCM push sent successfully');
          } catch (fcmErr) {
            console.error('[Report API] FCM push error:', fcmErr.code || fcmErr.message);
            // Token érvénytelen - töröljük
            if (fcmErr.code === 'messaging/registration-token-not-registered' ||
                fcmErr.code === 'messaging/invalid-registration-token') {
              await subDoc.ref.delete();
            }
          }
          continue; // Ne próbálkozzon web push-sal is
        }

        // === Web Push (böngésző) ===
        if (sub.endpoint && sub.keys) {
          let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

          if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
            VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.trim().replace(/=+$/, '');
            VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.trim().replace(/=+$/, '');

            webpush.setVapidDetails(
              'mailto:epresla@icloud.com',
              VAPID_PUBLIC_KEY,
              VAPID_PRIVATE_KEY
            );

            const payload = JSON.stringify({
              title: 'Új bejelentés érkezett',
              body: notifMessage,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              tag: `content_report-${Date.now()}`,
              url: '/admin'
            });

            try {
              await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: sub.keys
              }, payload);
              sent++;
            } catch (pushErr) {
              console.error('[Report API] Web push error:', pushErr.statusCode || pushErr.message);
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await subDoc.ref.delete();
              }
            }
          }
        }
      }
      console.log(`[Report API] Push sent to ${sent}/${subsSnapshot.size} subscriptions`);
    } catch (pushErr) {
      console.error('[Report API] Push notification failed:', pushErr);
    }

    // === 3. Email értesítés ===

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
          .info-label { font-weight: bold; color: #6b7280; }
          .footer { background: #374151; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">⚠️ Új jelentés érkezett</h1>
          </div>
          
          <div class="content">
            <h2>Pharmagister - Tartalom jelentés</h2>
            
            <div class="info-row">
              <span class="info-label">Típus:</span> ${reportType === 'user' ? 'Felhasználó' : reportType === 'message' ? 'Üzenet' : 'Igény'}
            </div>
            
            <div class="info-row">
              <span class="info-label">Jelentett:</span> ${escapeHtml(reportedUserName)}
            </div>
            
            <div class="info-row">
              <span class="info-label">Ok:</span> ${escapeHtml(reason)}
            </div>
            
            ${details ? `
            <div class="info-row">
              <span class="info-label">Részletek:</span><br/>
              ${escapeHtml(details)}
            </div>
            ` : ''}
            
            <div class="info-row">
              <span class="info-label">Időpont:</span> ${new Date().toLocaleString('hu-HU')}
            </div>
            
            <p style="margin-top: 25px;">
              <strong>Teendő:</strong> Kérjük, ellenőrizd a jelentett tartalmat a Firebase Console-ban és hozd meg a szükséges intézkedéseket.
            </p>
          </div>
          
          <div class="footer">
            Pharmagister Admin Értesítés
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: 'Pharmagister <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL || 'epresla@icloud.com',
      subject: `⚠️ Új jelentés: ${reportedUserName}`,
      html: emailHTML,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
