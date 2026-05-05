import { auth } from '@/lib/firebase';

/**
 * Értesítés létrehozása és Push notification küldése
 * @param {Object} params - Az értesítés paraméterei
 * @param {string} params.userId - A címzett user ID-ja
 * @param {string} params.type - Az értesítés típusa (pharma_application, approval_accepted, stb.)
 * @param {string} params.title - Az értesítés címe
 * @param {string} params.message - Az értesítés szövege
 * @param {Object} params.data - Opcionális extra adatok (demandId, applicantId, stb.)
 * @param {string} params.url - Az URL ahova kattintáskor navigáljon
 */
export async function createNotificationWithPush({
  userId,
  type,
  title,
  message,
  data = {},
  url = '/notifications',
  dedupeWindowSeconds = 0,
  dedupeByDataKeys = []
}) {
  try {
    try {
      console.log('🚀 Attempting to send push notification...', { userId, title, url });

      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const headers = { 'Content-Type': 'application/json' };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      
      const pushResponse = await fetch('/api/send-push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          title,
          body: message,
          url,
          tag: `${type}-${Date.now()}`,
          type,
          createInAppNotification: true,
          notificationData: data,
          dedupeWindowSeconds,
          dedupeByDataKeys,
        })
      });

      console.log('📥 Push API response status:', pushResponse.status);
      
      if (!pushResponse.ok) {
        const errorText = await pushResponse.text();
        console.error('❌ Push API error response:', errorText);
        throw new Error(`Push API returned ${pushResponse.status}: ${errorText}`);
      }

      const pushResult = await pushResponse.json();
      console.log('🔔 Push notification result:', pushResult);
      
      if (pushResult.sent === 0) {
        console.warn('⚠️ No push notifications were sent. User may not have subscriptions.');
      } else {
        console.log(`✅ Successfully sent ${pushResult.sent}/${pushResult.total} push notifications`);
      }
      return {
        success: true,
        notificationId: pushResult.notificationId || null,
        deduped: Boolean(pushResult.deduped),
      };
    } catch (pushError) {
      console.error('❌ Notification/push failed:', pushError);
      throw pushError;
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Értesítési típusok és URL-ek
 */
export const NotificationTypes = {
  // Gyógyszertár kap értesítést
  PHARMA_APPLICATION: {
    type: 'pharma_application',
    getUrl: (demandId) => `/pharmagister?tab=dashboard&expand=${demandId}`
  },
  
  // Gyógyszerész/Asszisztens kap értesítést
  APPLICATION_ACCEPTED: {
    type: 'approval_accepted',
    getUrl: (demandId) => `/pharmagister/demand/${demandId}`
  },
  
  APPLICATION_REJECTED: {
    type: 'approval_rejected',
    getUrl: () => '/pharmagister?tab=dashboard'
  },
  
  // Felhasználó kap admin jóváhagyást
  PROFILE_APPROVED: {
    type: 'approval_approved',
    getUrl: () => '/pharmagister'
  },
  
  PROFILE_REJECTED: {
    type: 'approval_rejected',
    getUrl: () => '/pharmagister/setup?edit=true'
  },
  
  // Admin kap értesítést
  ADMIN_APPROVAL_REQUEST: {
    type: 'admin_approval_request',
    getUrl: () => '/admin/approvals'
  },
  
  // Új üzenet
  NEW_MESSAGE: {
    type: 'new_message',
    getUrl: (chatId) => `/chat/${chatId}`
  }
};
