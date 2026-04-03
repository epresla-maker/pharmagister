const admin = require("firebase-admin");
const webpush = require("web-push");
require("dotenv").config({ path: ".env.local" });

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();

async function sendTestPush() {
  const email = process.argv[2] || "epresla@icloud.com";
  
  // Find user by email
  const usersSnap = await db.collection("users").where("email", "==", email).get();
  
  if (usersSnap.empty) {
    console.log("❌ User not found with email:", email);
    return;
  }
  
  const userId = usersSnap.docs[0].id;
  const userData = usersSnap.docs[0].data();
  console.log("👤 Found user:", userId, "-", userData.displayName || email);
  
  // Get push subscriptions
  const subsSnap = await db.collection("pushSubscriptions").where("userId", "==", userId).get();
  
  if (subsSnap.empty) {
    console.log("❌ No push subscription found for this user");
    console.log("👉 The user needs to enable notifications in the app first!");
    return;
  }
  
  console.log(`📱 Found ${subsSnap.size} subscription(s)\n`);
  
  // List all subscriptions first
  for (const doc of subsSnap.docs) {
    const data = doc.data();
    const sub = data.subscription;
    const isNative = sub?.endpoint?.startsWith("native-");
    console.log(`  [${doc.id}]`);
    console.log(`    Platform: ${isNative ? "📲 Native (iOS/Android FCM)" : "🌐 Web Push"}`);
    console.log(`    Endpoint: ${sub?.endpoint?.substring(0, 70)}...`);
    if (isNative) console.log(`    FCM Token: ${sub?.token?.substring(0, 30)}...`);
    console.log(`    Created: ${data.createdAt?.toDate?.() || "N/A"}`);
    console.log();
  }
  
  // Setup web-push for web subscriptions
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/=+$/, '');
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim().replace(/=+$/, '');
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails("mailto:info@pharmagister.hu", vapidPublic, vapidPrivate);
  }
  
  const now = new Date().toLocaleTimeString("hu-HU");
  const title = "🧪 Teszt értesítés";
  const body = `Ez egy teszt push! (${now})`;

  // In-app notification létrehozása, hogy az Értesítések oldalon is megjelenjen.
  await db.collection("notifications").add({
    userId,
    type: "system",
    title,
    message: body,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      source: "send-test-push",
      url: "/notifications",
    },
  });

  // Badge számot ne fixen 1-re küldjük, hanem valós olvasatlan darabszámra.
  const unreadSnap = await db
    .collection("notifications")
    .where("userId", "==", userId)
    .where("read", "==", false)
    .get();
  const badgeCount = unreadSnap.docs.filter((d) => d.data()?.type !== "new_message").length;

  let successCount = 0;
  let failCount = 0;
  
  for (const doc of subsSnap.docs) {
    const sub = doc.data().subscription;
    
    // Skip invalid subscriptions
    if (sub?.endpoint?.includes("permanently-removed") || sub?.endpoint?.includes("invalid")) {
      console.log("🗑️ Deleting invalid subscription:", doc.id);
      await doc.ref.delete();
      continue;
    }
    
    const isNative = sub?.endpoint?.startsWith("native-") && sub?.token;
    
    try {
      if (isNative) {
        // ===== NATIVE iOS/Android push via FCM =====
        console.log(`📲 Sending FCM push to ${doc.id}...`);
        const message = {
          token: sub.token,
          notification: {
            title,
            body,
          },
          data: {
            url: "/notifications",
            tag: "test-" + Date.now(),
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title,
                  body,
                },
                badge: badgeCount,
                sound: "default",
              },
            },
          },
        };
        
        const result = await admin.messaging().send(message);
        console.log("✅ FCM push sent! Message ID:", result);
        successCount++;
      } else {
        // ===== Web Push via VAPID =====
        console.log(`🌐 Sending web push to ${doc.id}...`);
        const payload = JSON.stringify({
          title,
          body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-monochrome.png",
          tag: "test-" + Date.now(),
          url: "/notifications",
        });
        
        const result = await webpush.sendNotification(sub, payload);
        console.log("✅ Web push sent! Status:", result.statusCode);
        successCount++;
      }
    } catch (err) {
      failCount++;
      const code = err.statusCode || err.code || "unknown";
      console.error(`❌ Push failed (${code}):`, err.body || err.message);
      
      if (err.statusCode === 410 || err.statusCode === 404 || 
          err.code === "messaging/registration-token-not-registered" ||
          err.code === "messaging/invalid-registration-token") {
        console.log("🗑️ Subscription expired/invalid, deleting...");
        await doc.ref.delete();
      }
    }
  }
  
  console.log(`\n📊 Eredmény: ${successCount} sikeres, ${failCount} sikertelen (összesen ${subsSnap.size})`);
}

sendTestPush().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
