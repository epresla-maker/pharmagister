"use client";
import { useAuth } from "@/context/AuthContext";
import { useBadges } from "@/context/BadgesContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RouteGuard from "@/app/components/RouteGuard";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { refreshBadges } = useBadges();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isLoadingRef = useRef(false); // Védi a dupla lekérdezéseket

  useEffect(() => {
    if (user && !isLoadingRef.current) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      console.log(`📧 Betöltött értesítések száma: ${snapshot.size}`);
      
      const notificationsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }))
        .filter(n => n.type !== 'new_message'); // Üzenet értesítések kiszűrése - azok az Üzenetek ikonon jelennek meg
      
      console.log('📧 Értesítések:', notificationsData);
      
      // Jelöljük meg az olvasatlanokat olvasottnak - BATCH-eléssel (1 write sok helyett!)
      const unreadNotifications = notificationsData.filter(n => !n.read);
      console.log(`📧 Olvasatlan értesítések: ${unreadNotifications.length}`);
      
      // Megjelenítjük az értesítéseket az EREDETI read státusszal
      setNotifications(notificationsData);
      
      // Aztán háttérben jelöljük olvasottnak
      if (unreadNotifications.length > 0) {
        const batch = writeBatch(db);
        for (const notification of unreadNotifications) {
          batch.update(doc(db, 'notifications', notification.id), { read: true });
        }
        await batch.commit(); // Egyetlen write művelet!
        await refreshBadges(true);
      }
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const deleteNotification = async (notificationId) => {
    console.log(`🗑️ Törlés kérés: ${notificationId}`);
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications(notifications.filter(n => n.id !== notificationId));
      await refreshBadges(true);
      console.log(`✅ Törölve: ${notificationId}`);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approval_approved':
      case 'approval_accepted':
        return '✅';
      case 'approval_rejected':
        return '❌';
      case 'pharma_application':
        return '📝';
      case 'admin_approval_request':
        return '🔔';
      case 'new_message':
        return '💬';
      case 'content_report':
        return '🚩';
      case 'rating_request':
        return '⭐';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'approval_approved':
      case 'approval_accepted':
        return 'bg-green-50 border-green-200';
      case 'approval_rejected':
        return 'bg-red-50 border-red-200';
      case 'pharma_application':
        return 'bg-purple-50 border-purple-200';
      case 'new_message':
        return 'bg-blue-50 border-blue-200';
      case 'admin_approval_request':
        return 'bg-orange-50 border-orange-200';
      case 'new_demand':
        return 'bg-cyan-50 border-cyan-200';
      case 'content_report':
        return 'bg-red-50 border-red-200';
      case 'rating_request':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const handleNotificationClick = (notification) => {
    // Új üzenet értesítés - chat megnyitása
    if (notification.type === 'new_message' && notification.chatId) {
      router.push(`/chat/${notification.chatId}`);
    }
    // Új helyettesítési igény értesítés - igény részletei oldal
    else if (notification.type === 'new_demand' && notification.data?.demandId) {
      router.push(`/pharmagister/demand/${notification.data.demandId}`);
    }
    // Pharmagister jelentkezés értesítés - vezérlőpultra navigálás a konkrét igénnyel
    else if (notification.type === 'pharma_application' && notification.demandId) {
      router.push(`/pharmagister?tab=dashboard&expand=${notification.demandId}`);
    }
    // Elfogadott jelentkezés - igény részletei és gyógyszertár adatlapja
    else if (notification.type === 'approval_accepted' && notification.demandId && notification.pharmacyId) {
      router.push(`/pharmagister/demand/${notification.demandId}`);
    }
    // Admin jóváhagyási kérelem - approvals oldalra
    else if (notification.type === 'admin_approval_request') {
      router.push('/admin/approvals');
    }
    // Jelentés értesítés - navigálás a megfelelő oldalra
    else if (notification.type === 'content_report' && notification.url) {
      router.push(notification.url);
    }
    // Értékelés kérés - értékelő oldalra
    else if (notification.type === 'rating_request' && notification.data?.demandId) {
      router.push(`/ertekeles/${notification.data.demandId}`);
    }
    // Beosztás csereigény értesítések - csereigény kezelő megnyitása
    else if ([
      'schedule_swap_request',
      'schedule_swap_employee_accepted',
      'schedule_swap_awaiting_pharmacy',
      'schedule_swap_result',
      'schedule_swap_result_for_pharmacy',
    ].includes(notification.type)) {
      router.push('/pharmagister?tab=schedule-manager&subtab=swaps');
    }
    // Ha van url a notification data-ban
    else if (notification.url) {
      router.push(notification.url);
    }
    // Egyéb értesítések esetén alapértelmezett viselkedés (nincs navigáció)
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-purple-600 font-medium flex items-center gap-1 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Vissza
            </button>
            <h1 className="text-3xl font-bold">Értesítések</h1>
            <p className="text-gray-600 mt-2">
              {notifications.length > 0 
                ? `${notifications.length} értesítésed van`
                : 'Nincs értesítésed'}
            </p>
          </div>

          {/* Notifications list */}
          {loading ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-gray-500">Betöltés...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Nincs értesítésed</h2>
              <p className="text-gray-500">Az új értesítések itt fognak megjelenni</p>
            </div>
          ) : (
            <div className="space-y-4 pb-24">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`rounded-xl shadow-lg p-6 border-2 ${getNotificationColor(notification.type)} ${
                    notification.type === 'pharma_application' || notification.type === 'admin_approval_request' || notification.type === 'new_message' || notification.type === 'new_demand' || notification.type === 'rating_request' || notification.chatId || notification.url || notification.data?.demandId
                      ? 'cursor-pointer hover:shadow-xl transition-shadow'
                      : ''
                  } ${!notification.read ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg">{notification.title}</h3>
                        {!notification.read && (
                          <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            Új
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mb-3">{notification.message || notification.body}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          {notification.createdAt?.toLocaleString('hu-HU')}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Törlés
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
