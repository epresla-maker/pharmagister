const admin = require("firebase-admin");
const webpush = require("web-push");
require("dotenv").config({ path: ".env.local" });

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();

const title = "pharmagister";
const body = "Találd meg, amire szükséged van, vagy add el felesleges eszközeid a pharmagisteren.";
const targetUrl = "/pharmagister/eszkozpiacter?view=eladas";

async function sendBroadcast() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/=+$/, "");
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim().replace(/=+$/, "");
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails("mailto:info@pharmagister.hu", vapidPublic, vapidPrivate);
  }

  const subsSnap = await db.collection("pushSubscriptions").get();
  if (subsSnap.empty) {
    console.log("No push subscriptions found.");
    return;
  }

  console.log(`Subscriptions to process: ${subsSnap.size}`);

  const userIds = new Set();
  for (const subDoc of subsSnap.docs) {
    const uid = subDoc.data()?.userId;
    if (uid) userIds.add(uid);
  }

  let inAppOk = 0;
  for (const userId of userIds) {
    try {
      await db.collection("notifications").add({
        userId,
        type: "system",
        title,
        message: body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          source: "marketplace-broadcast",
          url: targetUrl,
        },
      });
      inAppOk += 1;
    } catch (err) {
      console.log(`In-app notification failed for ${userId}: ${err.message}`);
    }
  }

  let pushOk = 0;
  let pushFail = 0;

  for (const subDoc of subsSnap.docs) {
    const sub = subDoc.data()?.subscription;
    if (!sub?.endpoint) {
      pushFail += 1;
      continue;
    }

    if (sub.endpoint.includes("permanently-removed") || sub.endpoint.includes("invalid")) {
      await subDoc.ref.delete();
      continue;
    }

    const isNative = sub.endpoint.startsWith("native-") && sub.token;

    try {
      if (isNative) {
        const message = {
          token: sub.token,
          notification: {
            title,
            body,
          },
          data: {
            url: targetUrl,
            tag: `marketplace-broadcast-${Date.now()}`,
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title,
                  body,
                },
                sound: "default",
              },
            },
          },
        };

        await admin.messaging().send(message);
        pushOk += 1;
      } else {
        const payload = JSON.stringify({
          title,
          body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-monochrome.png",
          tag: `marketplace-broadcast-${Date.now()}`,
          url: targetUrl,
        });

        await webpush.sendNotification(sub, payload);
        pushOk += 1;
      }
    } catch (err) {
      pushFail += 1;
      const code = err.statusCode || err.code || "unknown";
      console.log(`Push failed (${code}) on ${subDoc.id}: ${err.body || err.message}`);

      if (
        err.statusCode === 410 ||
        err.statusCode === 404 ||
        err.code === "messaging/registration-token-not-registered" ||
        err.code === "messaging/invalid-registration-token"
      ) {
        try {
          await subDoc.ref.delete();
        } catch (deleteErr) {
          console.log(`Failed to delete invalid subscription ${subDoc.id}: ${deleteErr.message}`);
        }
      }
    }
  }

  console.log("Broadcast done.");
  console.log(`In-app notifications created: ${inAppOk}/${userIds.size}`);
  console.log(`Push sent: ${pushOk}`);
  console.log(`Push failed: ${pushFail}`);
}

sendBroadcast()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
