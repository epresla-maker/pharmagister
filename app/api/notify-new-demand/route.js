import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { demandId, pharmacyZipCode, position, pharmacyName, date } = await request.json();
    
    console.log('📢 New demand notification request:', { demandId, pharmacyZipCode, position, pharmacyName, date });
    
    if (!demandId || !position) {
      return Response.json({ error: 'demandId and position are required' }, { status: 400 });
    }
    
    // Keressük meg azokat a felhasználókat, akik:
    // 1. pharmacist vagy assistant szerepkörűek (nem pharmacy)
    // 2. newDemand értesítés be van kapcsolva
    // 3. A pozíció egyezik a beállított szűrővel
    // 4. Az irányítószám egyezik (vagy nincs megadva szűrő)
    
    const usersSnapshot = await db.collection('users')
      .where('pharmagisterRole', 'in', ['pharmacist', 'assistant'])
      .get();
    
    console.log(`📋 Found ${usersSnapshot.size} pharmacists/assistants`);
    
    const usersToNotify = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const settings = userData.notificationSettings || {};
      
      // Ellenőrizzük, hogy be van-e kapcsolva az új igény értesítés
      if (settings.newDemand === false) {
        console.log(`⏭️ User ${doc.id} has newDemand disabled`);
        return;
      }
      
      // Ellenőrizzük a pozíció szűrőt
      const positionFilter = settings.demandPositions || [userData.pharmagisterRole];
      if (!positionFilter.includes(position)) {
        console.log(`⏭️ User ${doc.id} position filter doesn't match: ${positionFilter} vs ${position}`);
        return;
      }
      
      // Ellenőrizzük az irányítószám szűrőt
      const zipFilter = settings.demandZipCodes || [];
      if (zipFilter.length > 0 && pharmacyZipCode && !zipFilter.includes(pharmacyZipCode)) {
        console.log(`⏭️ User ${doc.id} zip filter doesn't match: ${zipFilter} vs ${pharmacyZipCode}`);
        return;
      }
      
      usersToNotify.push({
        id: doc.id,
        displayName: userData.displayName
      });
    });
    
    console.log(`📬 Users to notify: ${usersToNotify.length}`);
    
    if (usersToNotify.length === 0) {
      return Response.json({ success: true, notified: 0, message: 'No matching users to notify' });
    }
    
    // Formázzuk a dátumot
    const dateStr = date ? new Date(date).toLocaleDateString('hu-HU', { 
      month: 'short', 
      day: 'numeric' 
    }) : '';
    
    const positionLabel = position === 'pharmacist' ? 'gyógyszerész' : 'szakasszisztens';
    
    // Küldünk értesítést minden érintett felhasználónak
    const results = [];
    
    for (const userInfo of usersToNotify) {
      try {
        // App értesítés létrehozása
        await db.collection('notifications').add({
          userId: userInfo.id,
          type: 'new_demand',
          title: 'Új helyettesítési igény!',
          message: `${pharmacyName || 'Egy gyógyszertár'} ${positionLabel} helyettest keres ${dateStr ? `(${dateStr})` : ''}.`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            demandId,
            pharmacyZipCode,
            position
          }
        });
        
        // Push notification küldése
        const pushResponse = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userInfo.id,
            title: 'Új helyettesítési igény',
            body: `${pharmacyName || 'Egy gyógyszertár'} ${positionLabel} helyettest keres${dateStr ? ` (${dateStr})` : ''}.`,
            url: `/pharmagister/demand/${demandId}`,
            tag: `new-demand-${demandId}`
          })
        });
        
        results.push({ userId: userInfo.id, success: true });
        console.log(`✅ Notified user ${userInfo.id}`);
      } catch (error) {
        console.error(`❌ Failed to notify user ${userInfo.id}:`, error);
        results.push({ userId: userInfo.id, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return Response.json({ 
      success: true, 
      notified: successCount,
      total: usersToNotify.length,
      results 
    });
    
  } catch (error) {
    console.error('Notify new demand error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
