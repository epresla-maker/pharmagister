import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';

const resend = new Resend(process.env.RESEND_API_KEY);

export const runtime = 'nodejs';

function buildHtml({ employeeName, pharmacyName, pharmacyEmail }) {
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
      <p>Kedves ${employeeName || 'Dolgozó'}!</p>
      <p>
        Értesítünk, hogy a(z) <strong>${pharmacyName}</strong> gyógyszertár felvett a Pharmagister rendszerben a dolgozói közé.
      </p>
      <div class="card">
        <p style="margin:0 0 8px 0;"><strong>Gyógyszertár:</strong> ${pharmacyName}</p>
        <p style="margin:0;"><strong>Kapcsolat:</strong> ${pharmacyEmail || 'nincs megadva'}</p>
      </div>
      <p>
        Ha már rendelkezel Pharmagister fiókkal, a beosztásaid a későbbiekben automatikusan megjelenhetnek a felületeden.
      </p>
      <p>
        Ha ezt tévedésből kaptad, kérjük jelezd a gyógyszertárnak vagy válaszolj erre az emailre.
      </p>
    </div>
    <div class="footer">
      <p>Ez az üzenet a Pharmagister rendszerből érkezett.</p>
      <p>© 2026 Pharmagister - Minden jog fenntartva</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultsag' }, { status: 401 });
    }

    const { employeeEmail, employeeName, pharmacyName, pharmacyEmail } = await request.json();

    if (!employeeEmail) {
      return NextResponse.json({ error: 'A dolgozó email címe kötelező' }, { status: 400 });
    }

    try {
      await resend.emails.send({
        from: 'Pharmagister <noreply@pharmagister.hu>',
        to: employeeEmail,
        subject: 'Pharmagister - Felvettek egy gyógyszertár dolgozói közé',
        html: buildHtml({ employeeName, pharmacyName, pharmacyEmail })
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
    return NextResponse.json(
      { error: 'Hiba történt az email küldés során: ' + error.message },
      { status: 500 }
    );
  }
}