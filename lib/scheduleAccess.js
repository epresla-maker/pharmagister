import {
  SCHEDULE_MANAGER_ADMIN_EMAILS,
  canAccessScheduleManagerByEmailRole,
} from './pharmagisterFeatures';

const SCHEDULE_NOTIFICATION_TYPES = new Set([
  'employee_added_to_pharmacy',
  'employee_removed_from_pharmacy',
  'schedule_published',
  'schedule_updated',
  'schedule_revoked',
  'schedule_removed_from_employee',
  'schedule_month_deleted',
  'schedule_swap_request',
  'schedule_swap_request_for_pharmacy',
  'schedule_swap_employee_accepted',
  'schedule_swap_awaiting_pharmacy',
  'schedule_swap_result',
  'schedule_swap_result_for_pharmacy',
  'schedule_swap_cancelled',
  'schedule_preference_published',
  'vacation_request_created',
  'vacation_request_result',
]);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAdminEmail(email) {
  return SCHEDULE_MANAGER_ADMIN_EMAILS.has(normalizeEmail(email));
}

async function getUserData(db, uid) {
  if (!uid) return null;
  const snapshot = await db.collection('users').doc(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}

export async function getScheduleManagerAccess(authUser, db) {
  const userData = await getUserData(db, authUser?.uid);
  const role = userData?.pharmagisterRole || null;
  const email = normalizeEmail(authUser?.email);
  const canAccess = canAccessScheduleManagerByEmailRole(email, role);

  return {
    uid: authUser?.uid || null,
    email,
    role,
    userData,
    canAccess,
    isAdmin: isAdminEmail(email),
    isPharmacy: role === 'pharmacy',
    isEmployee: ['employee', 'pharmacist', 'assistant'].includes(role),
  };
}

export function isScheduleNotificationType(type) {
  return SCHEDULE_NOTIFICATION_TYPES.has(type);
}

export async function requireSchedulePharmacyAccess(authUser, db) {
  const access = await getScheduleManagerAccess(authUser, db);
  if (!access.canAccess || access.role !== 'pharmacy') {
    const error = new Error('Nincs jogosultság a beosztáskezelő művelethez.');
    error.status = 403;
    throw error;
  }
  return access;
}

async function hasLinkedEmployee(db, pharmacyId, linkedUserId) {
  if (!pharmacyId || !linkedUserId) return false;
  const snapshot = await db.collection('pharmacyEmployees')
    .where('pharmacyId', '==', pharmacyId)
    .where('linkedUserId', '==', linkedUserId)
    .limit(1)
    .get();
  return !snapshot.empty;
}

async function getEmployeePharmacyIds(db, linkedUserId) {
  if (!linkedUserId) return [];
  const snapshot = await db.collection('pharmacyEmployees')
    .where('linkedUserId', '==', linkedUserId)
    .get();

  return [...new Set(snapshot.docs
    .map((doc) => doc.data())
    .filter((item) => item.status !== 'inactive')
    .map((item) => item.pharmacyId)
    .filter(Boolean))];
}

async function canSendScheduleNotification({ authUser, db, targetUserId }) {
  const access = await getScheduleManagerAccess(authUser, db);
  if (!access.canAccess) return false;
  if (access.isAdmin || targetUserId === access.uid) return true;

  if (access.role === 'pharmacy') {
    return hasLinkedEmployee(db, access.uid, targetUserId);
  }

  const pharmacyIds = await getEmployeePharmacyIds(db, access.uid);
  if (pharmacyIds.includes(targetUserId)) return true;

  for (const pharmacyId of pharmacyIds) {
    if (await hasLinkedEmployee(db, pharmacyId, targetUserId)) return true;
  }

  return false;
}

async function canSendChatNotification({ authUser, db, targetUserId, chatId }) {
  if (!chatId) return false;
  const snapshot = await db.collection('chats').doc(chatId).get();
  if (!snapshot.exists) return false;
  const members = snapshot.data()?.members || [];
  return members.includes(authUser.uid) && members.includes(targetUserId);
}

async function canSendPharmaDemandNotification({ authUser, db, targetUserId, type, notificationData }) {
  if (type === 'pharma_application') {
    const demandId = notificationData?.demandId;
    if (!demandId) return false;
    const demandSnapshot = await db.collection('pharmaDemands').doc(demandId).get();
    const demand = demandSnapshot.exists ? demandSnapshot.data() : null;
    return demand?.pharmacyId === targetUserId;
  }

  if (type === 'approval_accepted' || type === 'approval_rejected') {
    if (targetUserId === authUser.uid) return true;

    const demandId = notificationData?.demandId;
    if (demandId) {
      const demandSnapshot = await db.collection('pharmaDemands').doc(demandId).get();
      const demand = demandSnapshot.exists ? demandSnapshot.data() : null;
      if (demand?.pharmacyId === authUser.uid) return true;
    }

    const applicationSnapshot = await db.collection('pharmaApplications')
      .where('applicantId', '==', targetUserId)
      .where('pharmacyId', '==', authUser.uid)
      .limit(1)
      .get();

    return !applicationSnapshot.empty;
  }

  if (type === 'rating_request') {
    const demandId = notificationData?.demandId;
    if (!demandId) return false;
    const demandSnapshot = await db.collection('pharmaDemands').doc(demandId).get();
    const demand = demandSnapshot.exists ? demandSnapshot.data() : null;
    return demand?.pharmacyId === authUser.uid;
  }

  return false;
}

function getChatIdFromPayload({ tag, url }) {
  const tagMatch = String(tag || '').match(/^chat-(.+)$/);
  if (tagMatch?.[1]) return tagMatch[1];

  const urlMatch = String(url || '').match(/^\/chat\/([^/?#]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  return null;
}

export async function canSendNotificationToUser({ authUser, db, targetUserId, type, tag, url, notificationData }) {
  if (!authUser?.uid || !targetUserId) return false;
  if (targetUserId === authUser.uid) return true;
  if (isAdminEmail(authUser.email)) return true;

  const normalizedType = String(type || '').trim();
  const chatId = getChatIdFromPayload({ tag, url });
  if (normalizedType === 'new_message' || chatId) {
    return canSendChatNotification({ authUser, db, targetUserId, chatId });
  }

  if (isScheduleNotificationType(normalizedType)) {
    return canSendScheduleNotification({ authUser, db, targetUserId });
  }

  return canSendPharmaDemandNotification({
    authUser,
    db,
    targetUserId,
    type: normalizedType,
    notificationData,
  });
}