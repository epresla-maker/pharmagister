// hooks/useDashboardBadges.js
// Polling-based badge counts (optimized: getCountFromServer instead of onSnapshot)
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';

const POLL_INTERVAL = 120000; // 2 perc

export function useDashboardBadges(user, userData) {
  const [badges, setBadges] = useState({
    notifications: 0,
    messages: 0,
    requests: 0,
    friends: 0,
    following: 0,
    timemagister: 0,
    pharmagister: 0
  });
  
  const isMountedRef = useRef(true);

  // Stabilize userData dependency to avoid re-triggers on reference changes
  const userDataKey = user ? JSON.stringify({
    friendRequests: (userData?.friendRequests || []).length,
    friends: (userData?.friends || []).length,
    following: (userData?.following || []).length,
    status: userData?.status,
    pharmagisterRole: userData?.pharmagisterRole,
    zipCodes: userData?.zipCodes?.join(',') || ''
  }) : '';

  // Minden badge polling-gal, getCountFromServer-rel ahol lehet
  const fetchAllBadges = useCallback(async () => {
    if (!user || !userData || !isMountedRef.current) return;

    try {
      // --- Üzenetek (chats) badge: olvasatlan chatok száma ---
      // getCountFromServer nem tudja a komplex logikát (readBy, ghost, archived stb.)
      // ezért getDocs-szal kérdezzük, de EGYSZER, 2 percenként (nem onSnapshot)
      const chatsQuery = query(
        collection(db, 'chats'),
        where('members', 'array-contains', user.uid)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      let unreadCount = 0;
      chatsSnapshot.docs.forEach(chatDoc => {
        const data = chatDoc.data();
        const isGhost = data.lastMessageSenderId === null;
        const isArchived = data.archivedBy?.includes(user.uid);
        const isDeleted = data.deletedBy?.includes(user.uid);
        if (isGhost || isArchived || isDeleted) return;
        const readBy = data.readBy || [];
        if (!readBy.includes(user.uid) && data.lastMessageSenderId !== user.uid) {
          unreadCount++;
        }
      });

      // --- Értesítések badge: olvasatlan, nem-üzenet értesítések száma ---
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false)
      );
      const notifsSnapshot = await getDocs(notificationsQuery);
      const notifCount = notifsSnapshot.docs.filter(d => d.data().type !== 'new_message').length;

      // --- userData-ból ---
      const requestsCount = (userData.friendRequests || []).length;
      const friendsCount = (userData.friends || []).length;
      const followingCount = (userData.following || []).length;

      // --- Timemagister ---
      let timeMagisterCount = 0;
      if (userData.status === 'Full Tag') {
        const appointmentsQuery = query(
          collection(db, 'appointments'),
          where('providerId', '==', user.uid),
          where('status', '==', 'accepted')
        );
        const appCount = await getCountFromServer(appointmentsQuery);
        timeMagisterCount = appCount.data().count;
      }

      // --- Pharmagister ---
      let pharmaMagisterCount = 0;
      const isAdminUser = user?.email === 'epresla@icloud.com';
      if (isAdminUser || ((userData.pharmagisterRole === 'pharmacist' || userData.pharmagisterRole === 'assistant') 
          && userData.zipCodes?.length > 0)) {
        const pharmaQueryConstraints = [where('status', '==', 'active')];
        if (!isAdminUser && userData.zipCodes?.length > 0) {
          pharmaQueryConstraints.push(where('zipCode', 'in', userData.zipCodes.slice(0, 10)));
        }
        const pharmaQuery = query(
          collection(db, 'substitutionRequests'),
          ...pharmaQueryConstraints
        );
        const pharmaCount = await getCountFromServer(pharmaQuery);
        pharmaMagisterCount = pharmaCount.data().count;
      }

      if (isMountedRef.current) {
        setBadges({
          messages: unreadCount,
          notifications: notifCount,
          requests: requestsCount,
          friends: friendsCount,
          following: followingCount,
          timemagister: timeMagisterCount,
          pharmagister: pharmaMagisterCount
        });
      }
    } catch (error) {
      // Silent fail
    }
  }, [user, userDataKey]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!user || !userDataKey) return;

    fetchAllBadges();
    const interval = setInterval(fetchAllBadges, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [user, userDataKey, fetchAllBadges]);

  const refreshBadges = useCallback(() => fetchAllBadges(), [fetchAllBadges]);

  return { badges, refreshBadges };
}
