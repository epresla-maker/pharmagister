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
  const email = process.argv[2] || "etinatina22@gmail.com";
  
  // Find user by email
  const usersSnap = await db.collection("users").where("email", "==", email).get();
  
  if (usersSnap.empty) {
    console.log("User not found with email:", email);
    return;
  }
  
  const userId = usersSnap.docs[0].id;
  const userData = usersSnap.docs[0].data();
  console.log("Found user:", userId, "-", userData.displayName || email);
  
  // Get push subscription
  const subsSnap = await db.collection("pushSubscriptions").where("userId", "==", userId).get();
  
  if (subsSnap.empty) {
    console.log("No push subscription found for this user");
    console.log("The user needs to enable notifications in the app first!");
    return;
  }
  
  console.log("Found", subsSnap.size, "subscription(s)");
  
  // Setup web-push with actual keys
  webpush.setVapidDetails(
    "mailto:info@pharmagister.hu",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  
  const payload = JSON.stringify({
    title: "🧪 Teszt értesítés",
    body: "Ez egy teszt push notification! " + new Date().toLocaleTimeString(),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-monochrome.png",
    tag: "test-" + Date.now(),
    url: "/notifications"
  });
  
  for (const doc of subsSnap.docs) {
    const sub = doc.data().subscription;
    
    // Skip invalid subscriptions
    if (sub.endpoint.includes("permanently-removed") || sub.endpoint.includes("invalid")) {
      console.log("Deleting invalid subscription:", doc.id);
      await doc.ref.delete();
      continue;
    }
    
    const isAndroid = sub.endpoint.includes("fcm.googleapis.com");
    console.log("Platform:", isAndroid ? "Android (FCM)" : "iOS/Other");
    console.log("Sending to endpoint:", sub.endpoint.substring(0, 70) + "...");
    
    try {
      const result = await webpush.sendNotification(sub, payload);
      console.log("✅ Push sent successfully! Status:", result.statusCode);
    } catch (err) {
      console.error("❌ Push failed:", err.statusCode, "-", err.body || err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log("Subscription expired/invalid, deleting...");
        await doc.ref.delete();
      }
    }
  }
}

sendTestPush().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
