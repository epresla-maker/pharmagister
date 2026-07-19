import { NextResponse } from 'next/server';
import { verifyAuth } from '../../../lib/apiAuth';
import getFirebaseAdmin from '../../../lib/firebaseAdmin';
import { resolveMarketFromRequest, normalizeMarket } from '../../../lib/market';
import { getEffectivePharmagisterRole } from '../../../lib/pharmagisterProfile';

function stripInvalidUnicodeSurrogates(value) {
  const input = String(value || '');
  let out = '';

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);

    // High surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += input[i] + input[i + 1];
        i += 1;
      }
      continue;
    }

    // Drop lone low surrogate
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    out += input[i];
  }

  return out;
}

function sanitizePostText(value) {
  return stripInvalidUnicodeSurrogates(String(value || ''))
    .normalize('NFKC')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

async function readBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const fd = await request.formData();
    return {
      text: fd.get('text') || '',
      category: fd.get('category') || 'altalanos',
      tags: (() => {
        const raw = fd.get('tags');
        if (!raw) return [];
        try {
          const parsed = JSON.parse(String(raw));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      market: fd.get('market') || null,
      isAnonymous: String(fd.get('isAnonymous') || '').toLowerCase() === 'true',
      imageUrl: fd.get('imageUrl') || null,
      style: (() => {
        const raw = fd.get('style');
        if (!raw) return null;
        try {
          return JSON.parse(String(raw));
        } catch {
          return null;
        }
      })(),
    };
  }

  return {};
}

function getCommunityPostCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      invalidPayload: 'Ungueltige Anfrage',
      missingText: 'Beitragstext fehlt',
      missingRole: 'Fehlende Berechtigung (Pharmagister-Rolle)',
      saveFailed: 'Beitrag konnte nicht gespeichert werden',
    };
  }

  return {
    unauthorized: 'Nincs jogosultság',
    invalidPayload: 'Érvénytelen kérés',
    missingText: 'Hiányzó posztszöveg',
    missingRole: 'Nincs megfelelő jogosultság (Pharmagister szerepkör)',
    saveFailed: 'A poszt mentése sikertelen',
  };
}

export async function POST(request) {
  const requestMarket = resolveMarketFromRequest(request);
  const copy = getCommunityPostCopy(requestMarket);

  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const body = await readBody(request);
    const text = sanitizePostText(body?.text).trim();
    const category = String(body?.category || 'altalanos');
    const tags = Array.isArray(body?.tags) ? body.tags.slice(0, 5).map((t) => String(t || '').trim()).filter(Boolean) : [];
    const isAnonymous = Boolean(body?.isAnonymous);
    const imageUrl = body?.imageUrl ? String(body.imageUrl) : null;
    const style = body?.style && typeof body.style === 'object' ? body.style : null;

    if (!text && !imageUrl) {
      return NextResponse.json({ error: copy.missingText }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    const effectiveRole = getEffectivePharmagisterRole(userData);
    if (!effectiveRole) {
      return NextResponse.json({ error: copy.missingRole }, { status: 403 });
    }

    if (userData?.pharmagisterRole !== effectiveRole) {
      await userRef.set(
        {
          pharmagisterRole: effectiveRole,
          pharmagisterRoleRecoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const postData = {
      text,
      category,
      tags,
      market: normalizeMarket(body?.market || userData?.market || requestMarket),
      userId: authUser.uid,
      isAnonymous,
      style,
      imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      reactions: {},
      commentCount: 0,
      reportCount: 0,
      isHidden: false,
      authorData: {
        displayName: userData?.displayName || (requestMarket === 'de' ? 'Nutzer/in' : 'Felhasználó'),
        photoURL: userData?.photoURL || null,
      },
    };

    const createdRef = await db.collection('communityPosts').add(postData);
    return NextResponse.json({ ok: true, id: createdRef.id });
  } catch (error) {
    console.error('Community post create API error:', error);
    return NextResponse.json({ error: copy.saveFailed }, { status: 500 });
  }
}
