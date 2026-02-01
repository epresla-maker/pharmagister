// hooks/useDashboardBadges.js
// Hybrid: Real-time for messages, polling for others
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getCountFromServer, onSnapshot } from 'firebase/firestore';

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

  // Real-time listener a chatekhez
  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('members', 'array-contains', user.uid)
    );
    
    const unsub = onSnapshot(chatsQuery, (snapshot) => {
      let unreadCount = 0;
      snapshot.docs.forEach(chatDoc => {
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
      setBadges(prev => ({ ...prev, messages: unreadCount }));
    }, () => {});

    return () => unsub();
  }, [user]);

  // Real-time listener az értesítésekhez is
  useEffect(() => {
    if (!user) return;

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
    
    const unsub = onSnapshot(notificationsQuery, (snapshot) => {
      // Üzenet értesítések kiszűrése - azok az Üzenetek badge-en látszanak
      const notifCount = snapshot.docs.filter(doc => doc.data().type !== 'new_message').length;
      setBadges(prev => ({ ...prev, notifications: notifCount }));
    }, () => {});

    return () => unsub();
  }, [user]);

  // Polling a többi badge-hez (ritkább) - értesítések már real-time
  const fetchOtherBadges = useCallback(async () => {
    if (!user || !userData || !isMountedRef.current) return;

    try {
      // userData-ból
      const requestsCount = (userData.friendRequests || []).length;
      const friendsCount = (userData.friends || []).length;
      const followingCount = (userData.following || []).length;

      // Timemagister
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

      // Pharmagister
      let pharmaMagisterCount = 0;
      if ((userData.pharmagisterRole === 'pharmacist' || userData.pharmagisterRole === 'assistant') 
          && userData.zipCodes?.length > 0) {
        const pharmaQuery = query(
          collection(db, 'substitutionRequests'),
          where('status', '==', 'active'),
          where('zipCode', 'in', userData.zipCodes.slice(0, 10))
        );
        const pharmaCount = await getCountFromServer(pharmaQuery);
        pharmaMagisterCount = pharmaCount.data().count;
      }

      if (isMountedRef.current) {
        setBadges(prev => ({
          ...prev,
          requests: requestsCount,
          friends: friendsCount,
          following: followingCount,
          timemagister: timeMagisterCount,
          pharmagister: pharmaMagisterCount
        }));
      }
    } catch (error) {
      // Silent fail
    }
  }, [user, userData]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!user || !userData) return;

    fetchOtherBadges();
    const interval = setInterval(fetchOtherBadges, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [user, userData, fetchOtherBadges]);

  const refreshBadges = useCallback(() => fetchOtherBadges(), [fetchOtherBadges]);

  return { badges, refreshBadges };
}
