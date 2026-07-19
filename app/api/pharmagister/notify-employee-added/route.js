import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { requireSchedulePharmacyAccess } from '../../../../lib/scheduleAccess';
import { resolveMarketFromRequest } from '../../../../lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);

export const runtime = 'nodejs';

function getNotifyEmployeeApiCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      employeeEmailRequired: 'E-Mail-Adresse der Mitarbeiterin/des Mitarbeiters ist erforderlich',
      emailSendErrorPrefix: 'Fehler beim E-Mail-Versand: ',
      subject: 'Pharmagister - Du wurdest als Apothekenmitarbeiter/in hinzugefuegt',
      fallbackEmployeeName: 'Mitarbeiter/in',
      fallbackContact: 'nicht angegeben',
      greeting: 'Hallo',
      intro: 'Wir informieren dich, dass die Apotheke',
      introSuffix: 'dich in Pharmagister als Mitarbeitende/n hinzugefuegt hat.',
      pharmacyLabel: 'Apotheke',
      contactLabel: 'Kontakt',
      scheduleInfo: 'Wenn du bereits ein Pharmagister-Konto hast, koennen deine Dienstplaene spaeter automatisch angezeigt werden.',
      mistakenInfo: 'Wenn du diese Nachricht irrtuemlich erhalten hast, kontaktiere bitte die Apotheke oder antworte auf diese E-Mail.',
      footerLine1: 'Diese Nachricht wurde vom Pharmagister-System gesendet.',
      footerLine2: '© 2026 Pharmagister - Alle Rechte vorbehalten',
    };
  }

  return {
    unauthorized: 'Nincs jogosultsag',
    employeeEmailRequired: 'A dolgozó email címe kötelező',
    emailSendErrorPrefix: 'Hiba történt az email küldés során: ',
    subject: 'Pharmagister - Felvettek egy gyógyszertár dolgozói közé',
    fallbackEmployeeName: 'Dolgozó',
    fallbackContact: 'nincs megadva',
    greeting: 'Kedves',
    intro: 'Értesítünk, hogy a(z)',
    introSuffix: 'gyógyszertár felvett a Pharmagister rendszerben a dolgozói közé.',
    pharmacyLabel: 'Gyógyszertár',
    contactLabel: 'Kapcsolat',
    scheduleInfo: 'Ha már rendelkezel Pharmagister fiókkal, a beosztásaid a későbbiekben automatikusan megjelenhetnek a felületeden.',
    mistakenInfo: 'Ha ezt tévedésből kaptad, kérjük jelezd a gyógyszertárnak vagy válaszolj erre az emailre.',
    footerLine1: 'Ez az üzenet a Pharmagister rendszerből érkezett.',
    footerLine2: '© 2026 Pharmagister - Minden jog fenntartva',
  };
}

function buildHtml({ employeeName, pharmacyName, pharmacyEmail, copy }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #16a34a, #15803d); padding: 28px 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 28px 20px; color: #1f2937; line-height: 1.6; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pharmagister</h1>
    </div>
    <div class="content">
      <p>${copy.greeting} ${employeeName || copy.fallbackEmployeeName}!</p>
      <p>
        ${copy.intro} <strong>${pharmacyName}</strong> ${copy.introSuffix}
      </p>
      <div class="card">
        <p style="margin:0 0 8px 0;"><strong>${copy.pharmacyLabel}:</strong> ${pharmacyName}</p>
        <p style="margin:0;"><strong>${copy.contactLabel}:</strong> ${pharmacyEmail || copy.fallbackContact}</p>
      </div>
      <p>
        ${copy.scheduleInfo}
      </p>
      <p>
        ${copy.mistakenInfo}
      </p>
    </div>
    <div class="footer">
      <p>${copy.footerLine1}</p>
      <p>${copy.footerLine2}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getNotifyEmployeeApiCopy(requestMarket);
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    await requireSchedulePharmacyAccess(authUser, db);

    const { employeeEmail, employeeName, pharmacyName, pharmacyEmail } = await request.json();

    if (!employeeEmail) {
      return NextResponse.json({ error: copy.employeeEmailRequired }, { status: 400 });
    }

    try {
      await resend.emails.send({
        from: 'Pharmagister <noreply@pharmagister.hu>',
        to: employeeEmail,
        subject: copy.subject,
        html: buildHtml({ employeeName, pharmacyName, pharmacyEmail, copy })
      });
    } catch (mailError) {
      console.error('Employee added notification email send failed:', mailError);
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'email_send_failed',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Employee added notification email error:', error);
    const copy = getNotifyEmployeeApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json(
      { error: copy.emailSendErrorPrefix + error.message },
      { status: error.status || 500 }
    );
  }
}