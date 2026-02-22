// lib/apiAuth.js
import { getFirebaseAdmin } from './firebaseAdmin';

const ADMIN_EMAILS = ['epresla@icloud.com'];

/**
 * Verify Firebase ID token from request Authorization header.
 * Returns { uid, email, token } on success, or null on failure.
 */
export async function verifyAuth(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      token: decodedToken
    };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Verify that the request is from an admin user.
 * Returns { uid, email, token } on success, or null on failure.
 */
export async function verifyAdmin(request) {
  const authResult = await verifyAuth(request);
  if (!authResult) return null;
  if (!ADMIN_EMAILS.includes(authResult.email)) return null;
  return authResult;
}
