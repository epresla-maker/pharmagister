import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { resolveMarketFromRequest, normalizeMarket } from '@/lib/market';
import { getDemandCreditBalance, isDemandCreditDecreaseActive } from '@/lib/demandCredits';

function getCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      missingDemandId: 'demandId ist erforderlich',
      profileIncomplete: 'Bitte Profil vervollstaendigen, bevor du dich bewirbst.',
      wrongRole: 'Nur Apotheker/innen und Assistent/innen koennen sich bewerben.',
      demandNotFound: 'Anfrage nicht gefunden',
      demandClosed: 'Diese Anfrage ist nicht mehr offen.',
      marketMismatch: 'Diese Anfrage ist in deinem Markt nicht verfuegbar.',
      ownDemand: 'Du kannst dich nicht auf deine eigene Anfrage bewerben.',
      roleMismatch: 'Deine Rolle passt nicht zur gesuchten Position.',
      duplicate: 'Du hast dich bereits auf diese Anfrage beworben.',
      noCredits: 'Diese Apotheke hat derzeit keine verbleibenden Anfrage-Credits.',
      serverError: 'Serverfehler bei der Bewerbung',
    };
  }

  return {
    unauthorized: 'Nincs jogosultsag',
    missingDemandId: 'A demandId megadasa kotelezo',
    profileIncomplete: 'Jelentkezes elott toltsd ki a profilodat.',
    wrongRole: 'Csak gyogyszeresz vagy szakasszisztens jelentkezhet.',
    demandNotFound: 'Az igeny nem talalhato',
    demandClosed: 'Ez az igeny mar nem nyitott.',
    marketMismatch: 'Ez az igeny a piacodon nem erheto el.',
    ownDemand: 'A sajat igenyedre nem tudsz jelentkezni.',
    roleMismatch: 'A szerepkorod nem egyezik az igeny poziciojaval.',
    duplicate: 'Mar jelentkeztel erre az igenyre.',
    noCredits: 'A gyogyszertar csomagkerete elfogyott ehhez az igenyhez.',
    serverError: 'Szerverhiba jelentkezes kozben',
  };
}

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toApplicationDocId(demandId, applicantId) {
  return `${demandId}_${applicantId}`;
}

export async function POST(request) {
  const requestMarket = resolveMarketFromRequest(request);
  const copy = getCopy(requestMarket);

  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: copy.unauthorized, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const demandId = String(body?.demandId || '').trim();
    const applicantMessage = String(body?.message || '').trim();

    if (!demandId) {
      return Response.json({ error: copy.missingDemandId, code: 'MISSING_DEMAND_ID' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    const userRole = String(userData.pharmagisterRole || '').trim();
    const userMarket = normalizeMarket(userData.market || requestMarket);

    if (!userData.pharmaProfileComplete) {
      return Response.json({ error: copy.profileIncomplete, code: 'PROFILE_INCOMPLETE' }, { status: 400 });
    }

    if (userRole !== 'pharmacist' && userRole !== 'assistant' && userRole !== 'pka') {
      return Response.json({ error: copy.wrongRole, code: 'ROLE_FORBIDDEN' }, { status: 403 });
    }

    const demandRef = db.collection('pharmaDemands').doc(demandId);
    const demandSnap = await demandRef.get();
    if (!demandSnap.exists) {
      return Response.json({ error: copy.demandNotFound, code: 'DEMAND_NOT_FOUND' }, { status: 404 });
    }

    const demandData = demandSnap.data() || {};
    const demandMarket = normalizeMarket(demandData.market || requestMarket);

    if (demandMarket !== userMarket) {
      return Response.json({ error: copy.marketMismatch, code: 'MARKET_MISMATCH' }, { status: 403 });
    }

    if (demandData.pharmacyId === authUser.uid) {
      return Response.json({ error: copy.ownDemand, code: 'OWN_DEMAND' }, { status: 400 });
    }

    if (String(demandData.status || '') !== 'open') {
      return Response.json({ error: copy.demandClosed, code: 'DEMAND_CLOSED' }, { status: 400 });
    }

    const todayKey = getTodayDateKey();
    if (demandData.date && String(demandData.date) < todayKey) {
      return Response.json({ error: copy.demandClosed, code: 'DEMAND_EXPIRED' }, { status: 400 });
    }

    if (demandData.position && demandData.position !== userRole) {
      return Response.json({ error: copy.roleMismatch, code: 'ROLE_MISMATCH' }, { status: 403 });
    }

    const appDocId = toApplicationDocId(demandId, authUser.uid);
    const appRef = db.collection('pharmaApplications').doc(appDocId);

    let consumedCreditNow = false;
    let remainingCreditsAfter = null;
    const decreaseActiveNow = isDemandCreditDecreaseActive(new Date());

    await db.runTransaction(async (tx) => {
      const [freshDemandSnap, existingAppSnap] = await Promise.all([
        tx.get(demandRef),
        tx.get(appRef),
      ]);

      if (!freshDemandSnap.exists) {
        const err = new Error('DEMAND_NOT_FOUND');
        err.code = 'DEMAND_NOT_FOUND';
        throw err;
      }

      if (existingAppSnap.exists) {
        const err = new Error('DUPLICATE_APPLICATION');
        err.code = 'DUPLICATE_APPLICATION';
        throw err;
      }

      const freshDemand = freshDemandSnap.data() || {};
      if (String(freshDemand.status || '') !== 'open') {
        const err = new Error('DEMAND_CLOSED');
        err.code = 'DEMAND_CLOSED';
        throw err;
      }

      const hasApplicantAlready = Array.isArray(freshDemand.applicants)
        && freshDemand.applicants.some((item) => item?.userId === authUser.uid);
      if (hasApplicantAlready) {
        const err = new Error('DUPLICATE_APPLICATION');
        err.code = 'DUPLICATE_APPLICATION';
        throw err;
      }

      if (decreaseActiveNow && !freshDemand.creditConsumedAt) {
        const pharmacyRef = db.collection('users').doc(String(freshDemand.pharmacyId || ''));
        const pharmacySnap = await tx.get(pharmacyRef);
        const pharmacyData = pharmacySnap.exists ? (pharmacySnap.data() || {}) : {};
        const balance = getDemandCreditBalance(pharmacyData);

        if (balance.remainingCredits <= 0) {
          const err = new Error('PHARMACY_NO_CREDITS');
          err.code = 'PHARMACY_NO_CREDITS';
          throw err;
        }

        consumedCreditNow = true;
        remainingCreditsAfter = balance.remainingCredits - 1;

        tx.update(pharmacyRef, {
          demandCreditsUsed: admin.firestore.FieldValue.increment(1),
          demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.update(demandRef, {
          creditConsumedAt: admin.firestore.FieldValue.serverTimestamp(),
          creditConsumedReason: 'first_applicant',
          creditConsumedByApplicantId: authUser.uid,
          creditConsumedByApplicationId: appDocId,
        });
      }

      const applicantData = {
        applicantId: authUser.uid,
        userId: authUser.uid,
        displayName: userData.displayName || authUser.email || 'Ismeretlen',
        photoURL: userData.photoURL || null,
        pharmagisterRole: userRole,
        email: userData.email || authUser.email || '',
        phone: userData.pharmaPhone || userData.phone || null,
        experience: userData.pharmaYearsOfExperience || null,
        hourlyRate: userData.pharmaHourlyRate || null,
        software: userData.pharmaSoftwareKnowledge || [],
        bio: userData.pharmaBio || '',
        appliedAt: new Date().toISOString(),
        status: 'pending',
      };

      tx.update(demandRef, {
        applicants: admin.firestore.FieldValue.arrayUnion(applicantData),
        updatedAt: new Date().toISOString(),
      });

      tx.set(appRef, {
        demandId,
        pharmacyId: freshDemand.pharmacyId,
        pharmacyName: freshDemand.pharmacyName || '',
        applicantId: authUser.uid,
        applicantName: userData.displayName || authUser.email || 'Ismeretlen',
        displayName: userData.displayName || authUser.email || 'Ismeretlen',
        photoURL: userData.photoURL || null,
        pharmagisterRole: userRole,
        email: userData.email || authUser.email || '',
        phone: userData.pharmaPhone || userData.phone || null,
        experience: userData.pharmaYearsOfExperience || null,
        hourlyRate: userData.pharmaHourlyRate || null,
        software: userData.pharmaSoftwareKnowledge || [],
        bio: userData.pharmaBio || '',
        applicantRole: userRole,
        applicantExperience: userData.pharmaYearsOfExperience || '',
        applicantHourlyRate: userData.pharmaHourlyRate || '',
        position: freshDemand.position || '',
        date: freshDemand.date || '',
        status: 'pending',
        message: applicantMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return Response.json({
      success: true,
      demandId,
      applicationId: appDocId,
      consumedCreditNow,
      remainingCreditsAfter,
    });
  } catch (error) {
    console.error('Demand apply API error:', error);

    if (error?.code === 'DUPLICATE_APPLICATION') {
      return Response.json({ error: copy.duplicate, code: 'DUPLICATE_APPLICATION' }, { status: 409 });
    }

    if (error?.code === 'PHARMACY_NO_CREDITS') {
      return Response.json({ error: copy.noCredits, code: 'PHARMACY_NO_CREDITS' }, { status: 402 });
    }

    if (error?.code === 'DEMAND_NOT_FOUND') {
      return Response.json({ error: copy.demandNotFound, code: 'DEMAND_NOT_FOUND' }, { status: 404 });
    }

    if (error?.code === 'DEMAND_CLOSED' || error?.code === 'DEMAND_EXPIRED') {
      return Response.json({ error: copy.demandClosed, code: error.code }, { status: 400 });
    }

    return Response.json({ error: copy.serverError, code: 'APPLY_FAILED' }, { status: 500 });
  }
}
