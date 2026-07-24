"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, addDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
import { Loader2, Search, ChevronDown, ChevronUp, MapPin, Clock, CheckCircle, XCircle, MessageCircle, User, Calendar, Edit2, Trash2, Eye, CalendarDays, Filter } from 'lucide-react';
import ResponseRateBar from '@/app/components/ResponseRateBar';
import { getClientMarket, getLocalizedDemandPositionLabel } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';
import { getDemandCreditBalance, getDemandPackageOffer } from '@/lib/demandCredits';

export default function PharmaDashboard({ pharmaRole, expandDemandId }) {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const market = getClientMarket();
  const locale = market === 'de' ? 'de-DE' : 'hu-HU';
  const [loading, setLoading] = useState(true);
  const [myApplications, setMyApplications] = useState([]);
  const [myDemands, setMyDemands] = useState([]);
  const [availableDemands, setAvailableDemands] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDemand, setExpandedDemand] = useState(expandDemandId || null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'accepted', 'rejected'
  const [requestingCredits, setRequestingCredits] = useState(false);

  useEffect(() => {
    console.log('🔄 PharmaDashboard useEffect triggered - user:', user?.uid, 'pharmaRole:', pharmaRole);
    loadData();
  }, [user, pharmaRole, market]);

  // Update expanded demand when expandDemandId prop changes
  useEffect(() => {
    if (expandDemandId) {
      console.log('🎯 Auto-expanding demand:', expandDemandId);
      setExpandedDemand(expandDemandId);
    }
  }, [expandDemandId]);

  const loadData = async () => {
    console.log('📊 loadData called');
    if (!user || !pharmaRole) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      if (pharmaRole === 'pharmacy') {
        console.log('🏥 Loading pharmacy data...');
        await loadPharmacyData();
      } else {
        console.log('💊 Loading substitute data...');
        await loadSubstituteData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMyApplications([]);
      setMyDemands([]);
      setAvailableDemands([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPharmacyData = async () => {
    // Saját igények betöltése
    const demandsRef = collection(db, 'pharmaDemands');
    const demandsQuery = query(
      demandsRef,
      where('pharmacyId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const demandsSnapshot = await getDocs(demandsQuery);
    
    const demandsData = demandsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(demand => {
        if (!isDocInMarket(demand, market)) {
          return false;
        }
        // Megtartjuk a régebbi igényeket is, hogy külön szekcióban lehessen kezelni/áttekinteni.
        return demand.status !== 'deleted';
      });

    // Jelentkezések betöltése minden igényhez
    const demandsWithApplications = await Promise.all(
      demandsData.map(async (demand) => {
        const applicationsRef = collection(db, 'pharmaApplications');
        const applicationsQuery = query(
          applicationsRef,
          where('demandId', '==', demand.id),
          orderBy('createdAt', 'desc')
        );
        const applicationsSnapshot = await getDocs(applicationsQuery);
        const applications = applicationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        return { ...demand, applications };
      })
    );

    setMyDemands(demandsWithApplications);
  };

  const loadSubstituteData = async () => {
    // Saját jelentkezések
    const applicationsRef = collection(db, 'pharmaApplications');
    const applicationsQuery = query(
      applicationsRef,
      where('applicantId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const applicationsSnapshot = await getDocs(applicationsQuery);
    const applicationsData = applicationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Igények adatainak betöltése
    const applicationsWithDemands = await Promise.all(
      applicationsData.map(async (application) => {
        const demandDoc = await getDocs(query(
          collection(db, 'pharmaDemands'),
          where('__name__', '==', application.demandId)
        ));
        const demand = demandDoc.docs[0]?.data();
        if (demand && !isDocInMarket(demand, market)) {
          return { ...application, demand: null };
        }
        return { ...application, demand };
      })
    );

    setMyApplications(applicationsWithDemands);

    // Elérhető igények
    const demandsRef = collection(db, 'pharmaDemands');
    const demandsQuery = query(
      demandsRef,
      where('status', '==', 'open'),
      where('position', '==', pharmaRole),
      orderBy('date', 'asc')
    );
    const demandsSnapshot = await getDocs(demandsQuery);
    
    // Szűrjük ki a múltbeli dátumú igényeket (lokális időzóna!)
    const today2 = new Date();
    const todayStr2 = `${today2.getFullYear()}-${String(today2.getMonth() + 1).padStart(2, '0')}-${String(today2.getDate()).padStart(2, '0')}`;
    
    const demandsData = demandsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(demand => {
        if (!isDocInMarket(demand, market)) {
          return false;
        }
        // Csak olyan igényeket tartunk meg, amelyek dátuma ma vagy jövőbeli
        return demand.date >= todayStr2;
      });

    // Szűrés: amelyekre még nem jelentkezett
    const appliedDemandIds = applicationsData.map(app => app.demandId);
    const available = demandsData.filter(d => !appliedDemandIds.includes(d.id));

    setAvailableDemands(available);
  };

  const handleAcceptApplication = async (applicationId, demandId) => {
    if (!confirm(market === 'de' ? 'Moechtest du diese Bewerbung wirklich annehmen?' : 'Biztosan elfogadod ezt a jelentkezést?')) return;

    try {
      // Get application details to send notification
      const appDoc = await getDoc(doc(db, 'pharmaApplications', applicationId));
      const appData = appDoc.data();
      
      // Jelentkezés elfogadása
      await updateDoc(doc(db, 'pharmaApplications', applicationId), {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Igény státuszának frissítése
      await updateDoc(doc(db, 'pharmaDemands', demandId), {
        status: 'filled',
        updatedAt: new Date().toISOString(),
      });

      // ServiceFeedPosts státuszának frissítése is, hogy eltűnjön a főoldalról
      const feedPostsQuery = query(
        collection(db, 'serviceFeedPosts'),
        where('pharmaDemandId', '==', demandId)
      );
      const feedPostsSnapshot = await getDocs(feedPostsQuery);
      for (const feedDoc of feedPostsSnapshot.docs) {
        await updateDoc(doc(db, 'serviceFeedPosts', feedDoc.id), {
          status: 'filled'
        });
      }

      // Get demand details for notification
      const demandDoc = await getDoc(doc(db, 'pharmaDemands', demandId));
      const demandData = demandDoc.data();

      // Send notification with push to applicant
      await createNotificationWithPush({
        userId: appData.applicantId,
        type: 'approval_accepted',
        title: market === 'de' ? 'Bewerbung angenommen! ✅' : 'Jelentkezés elfogadva! ✅',
        message: market === 'de'
          ? `${userData.pharmacyName || userData.displayName} hat deine Bewerbung angenommen.`
          : `${userData.pharmacyName || userData.displayName} elfogadta a jelentkezésedet.`,
        data: {
          demandId: demandId,
          pharmacyId: user.uid,
          demandDate: demandData?.date,
          position: demandData?.position,
        },
        url: `/pharmagister/demand/${demandId}`
      });

      alert(market === 'de' ? 'Bewerbung angenommen!' : 'Jelentkezés elfogadva!');
      await loadData();
    } catch (error) {
      console.error('Error accepting application:', error);
      alert(market === 'de' ? 'Fehler bei der Annahme.' : 'Hiba történt az elfogadás során.');
    }
  };

  const handleRejectApplication = async (applicationId) => {
    const reason = prompt(market === 'de' ? 'Gib den Ablehnungsgrund an (optional):' : 'Add meg az elutasítás okát (opcionális):') || (market === 'de' ? 'Position bereits besetzt' : 'Betelt pozíció');

    try {
      // Get application details to send notification
      const appDoc = await getDoc(doc(db, 'pharmaApplications', applicationId));
      const appData = appDoc.data();
      
      await updateDoc(doc(db, 'pharmaApplications', applicationId), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      });

      // Send notification with push to applicant
      await createNotificationWithPush({
        userId: appData.applicantId,
        type: 'approval_rejected',
        title: market === 'de' ? 'Bewerbung abgelehnt ❌' : 'Jelentkezés elutasítva ❌',
        message: market === 'de'
          ? `${userData.pharmacyName || userData.displayName} hat deine Bewerbung abgelehnt. Grund: ${reason}`
          : `${userData.pharmacyName || userData.displayName} elutasította a jelentkezésedet. Indok: ${reason}`,
        data: { demandId: appData.demandId, pharmacyId: user.uid },
        url: '/pharmagister?tab=dashboard'
      });

      alert(market === 'de' ? 'Bewerbung abgelehnt.' : 'Jelentkezés elutasítva.');
      await loadData();
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert(market === 'de' ? 'Fehler bei der Ablehnung.' : 'Hiba történt az elutasítás során.');
    }
  };

  const handleSendMessage = async (application, demand) => {
    try {
      // Check if chat already exists for this specific demand
      const chatsRef = collection(db, 'chats');
      const existingChatQuery = query(
        chatsRef,
        where('members', 'array-contains', user.uid)
      );
      const existingChats = await getDocs(existingChatQuery);
      
      let chatId = null;
      existingChats.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        // Check both: same applicant AND same demand
        if (chatData.members.includes(application.applicantId) && chatData.relatedDemandId === demand.id) {
          chatId = chatDoc.id;
        }
      });
      
      if (chatId) {
        // If chat exists, navigate to it
        router.push(`/chat/${chatId}`);
      } else {
        // Create new chat directly and navigate to it
        const newChatRef = await addDoc(chatsRef, {
          members: [user.uid, application.applicantId],
          memberNames: {
            [user.uid]: userData?.pharmacyName || userData?.displayName || (market === 'de' ? 'Benutzer' : 'Felhasználó'),
            [application.applicantId]: application.applicantName || (market === 'de' ? 'Bewerber' : 'Jelentkező')
          },
          memberPhotos: {
            [user.uid]: userData?.pharmaPhotoURL || userData?.photoURL || null,
            [application.applicantId]: application.photoURL || null
          },
          createdAt: serverTimestamp(),
          lastMessageAt: null,
          lastMessage: null,
          lastMessageSenderId: null,
          relatedDemandId: demand.id,
          relatedDemandDate: demand.date,
          relatedDemandPosition: demand.position,
          relatedDemandPositionLabel: getLocalizedDemandPositionLabel(demand.position, market),
          archivedBy: [],
          deletedBy: [],
          readBy: []
        });
        router.push(`/chat/${newChatRef.id}`);
      }
      
    } catch (error) {
      console.error('Error opening chat:', error);
      alert(market === 'de' ? 'Fehler beim Oeffnen des Chats.' : 'Hiba történt a chat megnyitása során.');
    }
  };

  const handleDeleteDemand = async (demandId) => {
    if (!confirm(market === 'de' ? 'Moechtest du diese Anfrage wirklich loeschen?' : 'Biztosan törlöd ezt az igényt?')) return;

    try {
      // Töröljük az igényhez tartozó jelentkezéseket is
      const applicationsRef = collection(db, 'pharmaApplications');
      const applicationsQuery = query(applicationsRef, where('demandId', '==', demandId));
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      // Összes jelentkezés törlése
      await Promise.all(applicationsSnapshot.docs.map(doc => deleteDoc(doc.ref)));
      
      // Töröljük a serviceFeedPosts-ból is (főoldal)
      const feedPostsQuery = query(
        collection(db, 'serviceFeedPosts'),
        where('pharmaDemandId', '==', demandId)
      );
      const feedPostsSnapshot = await getDocs(feedPostsQuery);
      await Promise.all(feedPostsSnapshot.docs.map(doc => deleteDoc(doc.ref)));
      
      // Soft delete: mark as deleted instead of removing
      await updateDoc(doc(db, 'pharmaDemands', demandId), {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: user.uid
      });
      
      alert(market === 'de' ? 'Anfrage erfolgreich geloescht!' : 'Igény sikeresen törölve!');
      await loadData();
    } catch (error) {
      console.error('Error deleting demand:', error);
      alert(market === 'de' ? 'Fehler beim Loeschen der Anfrage.' : 'Hiba történt az igény törlése során.');
    }
  };

  const handleEditDemand = async (demand) => {
    // Munkaidő
    const newWorkHours = prompt(market === 'de' ? 'Arbeitszeit:' : 'Munkaidő:', demand.workHours || '');
    if (newWorkHours === null) return; // Cancel
    
    // Min. tapasztalat
    const newMinExperience = prompt(market === 'de' ? 'Mindesterfahrung (Jahre):' : 'Minimum tapasztalat (év):', demand.minExperience || '');
    if (newMinExperience === null) return;
    
    // Szoftverismeret - egyszerűsített
    const currentSoftware = demand.requiredSoftware?.join(', ') || '';
    const newRequiredSoftware = prompt(market === 'de' ? 'Softwarekenntnisse (kommagetrennt):' : 'Szoftverismeret (vesszővel elválasztva):', currentSoftware);
    if (newRequiredSoftware === null) return;
    
    // Egyéb szoftver
    const newOtherSoftware = prompt(market === 'de' ? 'Weitere Software:' : 'Egyéb szoftver:', demand.otherSoftware || '');
    if (newOtherSoftware === null) return;
    
    // Max órabér
    const newMaxHourlyRate = prompt(market === 'de' ? 'Maximaler Stundenlohn (EUR):' : 'Maximum órabér (Ft):', demand.maxHourlyRate || '');
    if (newMaxHourlyRate === null) return;
    
    // Egyéb követelmények
    const newAdditionalRequirements = prompt(market === 'de' ? 'Weitere Anforderungen:' : 'Egyéb követelmények:', demand.additionalRequirements || '');
    if (newAdditionalRequirements === null) return;

    try {
      const updateData = {
        workHours: newWorkHours,
        minExperience: newMinExperience,
        requiredSoftware: newRequiredSoftware ? newRequiredSoftware.split(',').map(s => s.trim()) : [],
        otherSoftware: newOtherSoftware,
        maxHourlyRate: newMaxHourlyRate ? parseInt(newMaxHourlyRate) : null,
        additionalRequirements: newAdditionalRequirements,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'pharmaDemands', demand.id), updateData);

      alert(market === 'de' ? 'Anfrage erfolgreich aktualisiert!' : 'Igény sikeresen módosítva!');
      await loadData();
    } catch (error) {
      console.error('Error editing demand:', error);
      alert(market === 'de' ? 'Fehler beim Aktualisieren der Anfrage.' : 'Hiba történt az igény módosítása során.');
    }
  };

  const handleApplyToDemand = async (demandId) => {
    if (!userData?.pharmaProfileComplete) {
      alert(market === 'de' ? 'Bitte fuelle zuerst dein Profil im Tab Mein Profil aus!' : 'Kérlek előbb töltsd ki a profilodat a Profilom fülön!');
      return;
    }

    try {
      // Get demand details to send notification to pharmacy
      const demandDoc = await getDoc(doc(db, 'pharmaDemands', demandId));
      const demandData = demandDoc.data();
      if (!isDocInMarket(demandData, market)) {
        alert(market === 'de' ? 'Diese Anfrage ist in deinem Markt nicht verfuegbar.' : 'Ez az igény a piacodon nem elérhető.');
        return;
      }
      
      // Szerepkör ellenőrzés - KRITIKUS!
      if (!userData.pharmagisterRole || userData.pharmagisterRole === 'pharmacy') {
        alert(market === 'de' ? 'Nur Apotheker und Assistenten koennen sich bewerben!' : 'Csak gyógyszerészek és szakasszisztensek jelentkezhetnek!');
        return;
      }

      // Ellenőrizzük hogy a szerepkör egyezik-e az igénnyel
      const userRole = userData.pharmagisterRole; // 'pharmacist' vagy 'assistant'
      const demandPosition = demandData.position; // 'pharmacist' vagy 'assistant'
      
      if (userRole !== demandPosition) {
        const userRoleLabel = userRole === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'gyógyszerész') : userRole === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'szakasszisztens');
        const demandPositionLabel = demandPosition === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'gyógyszerész') : demandPosition === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'szakasszisztens');
        alert(market === 'de'
          ? `Fuer diese Anfrage koennen sich nur ${demandPositionLabel} bewerben. Du bist als ${userRoleLabel} registriert.`
          : `Erre az igényre csak ${demandPositionLabel}ek jelentkezhetnek! Te ${userRoleLabel}ként vagy regisztrálva.`);
        return;
      }

      const message = prompt(market === 'de' ? 'Nachricht an die Apotheke (optional):' : 'Üzenet a gyógyszertárnak (opcionális):');

      const idToken = await user.getIdToken();
      const response = await fetch('/api/pharmagister/demand-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          demandId,
          message: message || '',
        }),
      });

      const applyResult = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (applyResult?.code === 'DUPLICATE_APPLICATION') {
          alert(market === 'de' ? 'Du hast dich bereits auf diese Anfrage beworben!' : 'Már jelentkeztél erre az igényre!');
          return;
        }
        if (applyResult?.code === 'PHARMACY_NO_CREDITS') {
          alert(market === 'de' ? 'Diese Apotheke kann derzeit keine weiteren Bewerbungen empfangen.' : 'A gyógyszertár jelenleg nem tud több jelentkezést fogadni ehhez a csomagkerethez.');
          return;
        }
        throw new Error(applyResult?.error || 'APPLY_FAILED');
      }

      // Send notification with push to pharmacy owner
      await createNotificationWithPush({
        userId: demandData.pharmacyId,
        type: 'pharma_application',
        title: market === 'de' ? 'Neue Bewerbung! 📝' : 'Új jelentkező! 📝',
        message: market === 'de'
          ? `${user.displayName || 'Jemand'} hat sich auf deine Anfrage beworben.`
          : `${user.displayName || 'Valaki'} jelentkezett az igényedre.`,
        data: { demandId },
        url: `/pharmagister?tab=dashboard&expand=${demandId}`
      });

      alert(market === 'de' ? 'Bewerbung erfolgreich gesendet!' : 'Jelentkezés sikeresen elküldve!');
      await loadData();
    } catch (error) {
      console.error('Error applying to demand:', error);
      alert(market === 'de' ? 'Fehler bei der Bewerbung.' : 'Hiba történt a jelentkezés során.');
    }
  };

  const handleRequestCreditPackage = async () => {
    if (!user) return;

    setRequestingCredits(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/pharmagister/demand-credits/purchase-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'PURCHASE_INTENT_FAILED');
      }

      alert(result?.message || (market === 'de'
        ? 'Kaufanfrage gespeichert.'
        : 'A csomagigeny rogzitve lett.'));
    } catch (error) {
      console.error('Error requesting credit package:', error);
      alert(market === 'de'
        ? 'Fehler beim Speichern der Kaufanfrage.'
        : 'Hiba tortent a csomagigeny rogzitese kozben.');
    } finally {
      setRequestingCredits(false);
    }
  };

  const handleCancelApplication = async (applicationId) => {
    if (!confirm(market === 'de' ? 'Moechtest du deine Bewerbung wirklich zurueckziehen?' : 'Biztosan visszavonod a jelentkezésed?')) return;

    try {
      await deleteDoc(doc(db, 'pharmaApplications', applicationId));
      alert(market === 'de' ? 'Bewerbung zurueckgezogen.' : 'Jelentkezés visszavonva.');
      await loadData();
    } catch (error) {
      console.error('Error canceling application:', error);
      alert(market === 'de' ? 'Fehler beim Zurueckziehen.' : 'Hiba történt a visszavonás során.');
    }
  };

  const handleDeleteApplication = async (applicationId) => {
    if (!confirm(market === 'de' ? 'Moechtest du diese Bewerbung wirklich aus dem Verlauf loeschen?' : 'Biztosan törlöd ezt a jelentkezést az előzményekből?')) return;

    try {
      await deleteDoc(doc(db, 'pharmaApplications', applicationId));
      alert(market === 'de' ? 'Bewerbung aus dem Verlauf geloescht.' : 'Jelentkezés törölve az előzményekből.');
      await loadData();
    } catch (error) {
      console.error('Error deleting application:', error);
      alert(market === 'de' ? 'Fehler beim Loeschen.' : 'Hiba történt a törlés során.');
    }
  };

  const filteredDemands = availableDemands.filter(demand => {
    const searchLower = searchQuery.toLowerCase();
    return (
      demand.pharmacyName?.toLowerCase().includes(searchLower) ||
      demand.pharmacyCity?.toLowerCase().includes(searchLower) ||
      demand.pharmacyZipCode?.includes(searchLower)
    );
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const activeMyDemands = myDemands.filter(demand => (demand.date || '') >= todayStr);
  const olderMyDemands = myDemands.filter(demand => (demand.date || '') < todayStr);
  const creditBalance = getDemandCreditBalance(userData || {});
  const packageOffer = getDemandPackageOffer(userData || {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#6B46C1]" />
      </div>
    );
  }

  return (
    <div>
      {/* Fejléc naptár gombbal */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Dashboard' : 'Vezérlőpult'}</h2>
        <button
          onClick={() => router.push('/pharmagister?tab=calendar')}
          className="flex items-center gap-2 px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3aa3] transition-colors"
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-sm font-medium">{market === 'de' ? 'Kalender' : 'Naptár'}</span>
        </button>
      </div>

      {pharmaRole === 'pharmacy' ? (
        // Gyógyszertár Dashboard
        <div className="space-y-4">
          <div className={`${darkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-[#6B46C1]'} border-l-4 p-3 rounded`}>
            <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} text-sm mb-1`}>{market === 'de' ? 'Ersatzbedarf im Fokus' : 'A helyettesítési igények központja'}</h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              {market === 'de' ? 'Schnell neue Anfrage erstellen, laufende Ausschreibungen verwalten und aeltere Eintraege sehen.' : 'Gyorsan feladhatsz új igényt, kezelheted az aktív hirdetéseidet, és egy helyen látod a korábbiakat is.'}
            </p>
          </div>

          <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#F9FAFB] border-[#E5E7EB]'} border rounded-xl p-3`}>
            <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Anfrage-Credits' : 'Igényfeladási keret'}: {creditBalance.remainingCredits} / {creditBalance.totalCredits}
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
              {market === 'de'
                ? `Ab 01.09.2026: ${packageOffer.packageCredits} Vertretungsanfragen aufgeben = ${packageOffer.basePriceHuf} Ft.`
                : `2026.09.01-tol ${packageOffer.packageCredits} helyettesitesi igeny feladasa = ${packageOffer.basePriceHuf} Ft.`}
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
              {market === 'de'
                ? `Gruendungsapotheken (Registrierung bis 01.09.2026 + vollstaendiges Profil) erhalten ${packageOffer.packageCredits} Vertretungsanfragen fuer ${packageOffer.founderPriceHuf} Ft.`
                : `Alapitoi gyogyszertarak (regisztracio 2026.09.01-ig + hianytalan profil) ${packageOffer.packageCredits} helyettesitesi igeny feladasat ${packageOffer.founderPriceHuf} Ft aron kapnak.`}
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
              {market === 'de'
                ? `Gruendungsrabatt gilt im festen Zeitraum 01.09.2026-01.03.2027${packageOffer.founder?.validUntil ? ` (bis ${new Date(packageOffer.founder.validUntil).toLocaleDateString('de-DE')})` : ''}.`
                : `Az alapitoi kedvezmeny fix idoszakban ervenyes: 2026.09.01-2027.03.01${packageOffer.founder?.validUntil ? ` (eddig: ${new Date(packageOffer.founder.validUntil).toLocaleDateString('hu-HU')})` : ''}.`}
            </p>
            {creditBalance.decreaseActive && (
              <button
                type="button"
                onClick={handleRequestCreditPackage}
                disabled={requestingCredits}
                className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${requestingCredits
                  ? (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed')
                  : 'bg-[#6B46C1] text-white hover:bg-[#5a3aa3]'}`}
              >
                {requestingCredits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {market === 'de' ? 'Neues Paket anfragen' : 'Uj csomag igenylese'}
              </button>
            )}
          </div>

          <div className={`${darkMode ? 'bg-gradient-to-r from-violet-900/50 to-indigo-900/50 border-violet-700' : 'bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200'} border rounded-xl p-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                  {market === 'de' ? 'Neuen Vertretungsbedarf aufgeben' : 'Új helyettesítési igény feladása'}
                </h3>
                <p className={`text-xs mt-1 ${darkMode ? 'text-violet-200' : 'text-violet-800'}`}>
                  {market === 'de' ? 'In wenigen Schritten zur neuen Ausschreibung.' : 'Néhány gyors lépésben feladhatod az új igényt.'}
                </p>
              </div>
              <button
                onClick={() => router.push('/pharmagister?tab=calendar&create=true')}
                className="px-4 py-2.5 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3aa3] transition-colors font-semibold text-sm"
              >
                {market === 'de' ? 'Anfrage erstellen' : 'Igény feladása'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Aktive Anfragen' : 'Aktív igények kezelése'}
            </h3>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
              {market === 'de' ? `${activeMyDemands.length} aktiv` : `${activeMyDemands.length} aktív`}
            </span>
          </div>

          {activeMyDemands.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className={`w-10 h-10 mx-auto ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} mb-2`} />
              <p className={`${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} text-sm`}>{market === 'de' ? 'Keine aktive Anfrage vorhanden.' : 'Jelenleg nincs aktív igényed.'}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#6B7280]'} mt-1`}>{market === 'de' ? 'Erstelle jetzt eine neue Ausschreibung.' : 'Adj fel most egy új helyettesítési igényt.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeMyDemands.map(demand => (
                <div key={demand.id} className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-[#E5E7EB]'} border-b pb-3 pt-2`}>
                  <div
                    onClick={() => {
                      console.log('🔍 Demand ID:', demand.id, '| Expanded:', expandedDemand, '| Match:', expandedDemand === demand.id);
                      setExpandedDemand(expandedDemand === demand.id ? null : demand.id);
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} text-sm`}>
                            {demand.position === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : demand.position === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'Szakasszisztens')}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            demand.status === 'open' ? (darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700') :
                            demand.status === 'filled' ? (darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700') :
                            (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-[#F3F4F6] text-[#111827]')
                          }`}>
                            {demand.status === 'open' ? (market === 'de' ? 'Offen' : 'Nyitott') :
                             demand.status === 'filled' ? (market === 'de' ? 'Besetzt' : 'Betöltve') : (market === 'de' ? 'Geloescht' : 'Törölve')}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          {new Date(demand.date).toLocaleDateString(locale, { 
                            year: 'numeric', month: 'long', day: 'numeric' 
                          })}
                          {demand.workHours && ` • ${demand.workHours}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {demand.applications?.length || 0}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDemand(demand);
                          }}
                          className={`p-1 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-[#F3F4F6]'} rounded`}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDemand(demand.id);
                          }}
                          className={`p-1 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-[#F3F4F6]'} rounded`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                        {expandedDemand === demand.id ? (
                          <ChevronUp className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} />
                        ) : (
                          <ChevronDown className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedDemand === demand.id && (
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-[#F9FAFB] border-[#E5E7EB]'} p-3 border-t mt-2 rounded-b-xl`}>
                      {demand.applications?.length > 0 ? (
                        <div className="space-y-2">
                          <h5 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2 text-sm`}>{market === 'de' ? 'Bewerber:' : 'Jelentkezők:'}</h5>
                          {demand.applications.filter(app => app.status === 'pending').map(application => (
                            <div key={application.id} className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-[#E5E7EB]'} rounded-lg p-3 border`}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} text-sm block truncate`}>{application.applicantName}</span>
                                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                                    {application.appliedAt?.toDate ? application.appliedAt.toDate().toLocaleDateString(locale) : 
                                     application.appliedAt ? new Date(application.appliedAt).toLocaleDateString(locale) : ''}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 ${darkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'} rounded text-xs font-medium whitespace-nowrap ml-2`}>
                                  {market === 'de' ? 'Offen' : 'Függőben'}
                                </span>
                              </div>
                              {application.message && (
                                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} mb-2 italic`}>"{application.message}"</p>
                              )}
                              <div className="grid grid-cols-2 gap-1.5">
                                <button 
                                  onClick={() => router.push(`/profil/${application.applicantId}`)}
                                  className={`px-2 py-1.5 text-xs ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]'} rounded transition-colors text-center`}
                                >
                                  {market === 'de' ? 'Profil' : 'Adatlap'}
                                </button>
                                <button 
                                  onClick={() => handleSendMessage(application, demand)}
                                  className={`px-2 py-1.5 text-xs ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]'} rounded transition-colors flex items-center justify-center gap-1`}
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  {market === 'de' ? 'Nachricht' : 'Üzenet'}
                                </button>
                                <button
                                  onClick={() => handleAcceptApplication(application.id, demand.id)}
                                  className="px-2 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  {market === 'de' ? 'Annehmen' : 'Elfogad'}
                                </button>
                                <button
                                  onClick={() => handleRejectApplication(application.id)}
                                  className="px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                  {market === 'de' ? 'Ablehnen' : 'Elutasít'}
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          {demand.applications.filter(app => app.status === 'accepted').map(application => (
                            <div key={application.id} className="bg-green-50/30 border-b border-green-200 pb-3 pt-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span className="font-semibold text-green-900 text-sm truncate">{application.applicantName}</span>
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                      {market === 'de' ? 'Angenommen' : 'Elfogadva'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-green-700">
                                    {market === 'de' ? 'Die Kontaktdaten der Vertretung sind im Profil sichtbar.' : 'A helyettesítő elérhetőségei láthatók az adatlapján'}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleSendMessage(application, demand)}
                                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    {market === 'de' ? 'Nachricht' : 'Üzenet'}
                                  </button>
                                  <button 
                                    onClick={() => router.push(`/profil/${application.applicantId}`)}
                                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                  >
                                    {market === 'de' ? 'Profil' : 'Adatlap'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[#6B7280] text-center py-4">{market === 'de' ? 'Noch keine Bewerber fuer diese Anfrage.' : 'Még nincs jelentkező erre az igényre.'}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Aeltere Anfragen' : 'Korábbi igények'}
              </h3>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                {market === 'de' ? `${olderMyDemands.length} Eintrag` : `${olderMyDemands.length} tétel`}
              </span>
            </div>

            {olderMyDemands.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#F9FAFB] border-[#E5E7EB]'} border rounded-lg p-3`}>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                  {market === 'de' ? 'Noch keine aelteren Anfragen.' : 'Még nincsenek korábbi igényeid.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {olderMyDemands.map(demand => (
                  <div key={demand.id} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#F9FAFB] border-[#E5E7EB]'} border rounded-lg px-3 py-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-100' : 'text-[#111827]'}`}>
                          {demand.position === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : demand.position === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'Szakasszisztens')}
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                          {new Date(demand.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push('/pharmagister?tab=calendar')}
                        className="px-2.5 py-1.5 text-xs bg-[#6B46C1] text-white rounded hover:bg-[#5a3aa3] transition-colors"
                      >
                        {market === 'de' ? 'Im Kalender' : 'Naptárban'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Helyettesítő Dashboard
        <div className="space-y-6">
          {/* Saját jelentkezések */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Meine Bewerbungen' : 'Jelentkezéseim'} ({myApplications.length})
              </h3>
            </div>

            {/* Szűrő gombok */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-[#6B46C1] text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {market === 'de' ? 'Alle' : 'Összes'} ({myApplications.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {market === 'de' ? 'Offen' : 'Függőben'} ({myApplications.filter(a => a.status === 'pending').length})
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'accepted'
                    ? 'bg-green-500 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {market === 'de' ? 'Angenommen' : 'Elfogadva'} ({myApplications.filter(a => a.status === 'accepted').length})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'rejected'
                    ? 'bg-red-500 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {market === 'de' ? 'Abgelehnt' : 'Elutasítva'} ({myApplications.filter(a => a.status === 'rejected').length})
              </button>
            </div>

            {myApplications.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-8 text-center`}>
                <Calendar className={`w-12 h-12 mx-auto ${darkMode ? 'text-gray-400' : 'text-gray-400'} mb-3`} />
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Du hast noch keine Bewerbungen.' : 'Még nincs jelentkezésed.'}</p>
                <button
                  onClick={() => router.push('/pharmagister?tab=calendar')}
                  className="mt-4 px-4 py-2 bg-[#6B46C1] text-white rounded-lg text-sm hover:bg-[#5a3aa3]"
                >
                  {market === 'de' ? 'Anfragen im Kalender suchen' : 'Keress igényeket a naptárban'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myApplications
                  .filter(app => statusFilter === 'all' || app.status === statusFilter)
                  .map(application => (
                  <div key={application.id} className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} border rounded-xl p-4 ${
                    application.status === 'accepted' ? 'border-l-4 border-l-green-500' :
                    application.status === 'rejected' ? 'border-l-4 border-l-red-500' :
                    'border-l-4 border-l-yellow-500'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} truncate`}>
                            {application.demand?.pharmacyName || (market === 'de' ? 'Unbekannte Apotheke' : 'Ismeretlen gyógyszertár')}
                          </h4>
                          {application.demand?.pharmacyId && <ResponseRateBar pharmacyId={application.demand.pharmacyId} />}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            application.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            application.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {application.status === 'accepted' ? (market === 'de' ? '✓ Angenommen' : '✓ Elfogadva') :
                             application.status === 'rejected' ? (market === 'de' ? '✗ Abgelehnt' : '✗ Elutasítva') : (market === 'de' ? '⏳ Offen' : '⏳ Függőben')}
                          </span>
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          {application.demand?.date && new Date(application.demand.date).toLocaleDateString(locale, {
                            year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </p>
                        {application.demand?.pharmacyCity && (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {application.demand.pharmacyFullAddress || `${application.demand.pharmacyZipCode || ''} ${application.demand.pharmacyCity || ''}`}
                          </p>
                        )}
                        {application.demand?.workHours && (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {application.demand.workHours}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {application.status === 'rejected' && application.rejectionReason && (
                      <div className={`mt-3 p-2 ${darkMode ? 'bg-red-900/30' : 'bg-red-50'} rounded-lg`}>
                        <p className={`text-xs ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                          <strong>{market === 'de' ? 'Ablehnungsgrund:' : 'Elutasítás oka:'}</strong> {application.rejectionReason}
                        </p>
                      </div>
                    )}

                    {application.status === 'accepted' && (
                      <div className={`mt-3 p-2 ${darkMode ? 'bg-green-900/30' : 'bg-green-50'} rounded-lg`}>
                        <p className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                          {market === 'de' ? '🎉 Glueckwunsch! Die Apotheke hat deine Bewerbung angenommen.' : '🎉 Gratulálunk! A gyógyszertár elfogadta a jelentkezésedet.'}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      {application.demand?.pharmacyId && (
                        <button 
                          onClick={() => router.push(`/profil/${application.demand.pharmacyId}`)}
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} rounded-lg transition-colors`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {market === 'de' ? 'Apotheke' : 'Gyógyszertár'}
                        </button>
                      )}
                      <button className={`flex items-center gap-1 px-3 py-1.5 text-xs ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} rounded-lg transition-colors`}>
                        <MessageCircle className="w-3.5 h-3.5" />
                        {market === 'de' ? 'Nachricht' : 'Üzenet'}
                      </button>
                      {application.status === 'pending' && (
                        <button
                          onClick={() => handleCancelApplication(application.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {market === 'de' ? 'Zurueckziehen' : 'Visszavonás'}
                        </button>
                      )}
                      {application.status === 'rejected' && (
                        <button
                          onClick={() => handleDeleteApplication(application.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {market === 'de' ? 'Loeschen' : 'Törlés'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {myApplications.filter(app => statusFilter === 'all' || app.status === statusFilter).length === 0 && (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-6 text-center`}>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                      {market === 'de'
                        ? `Es gibt keine ${statusFilter === 'pending' ? 'offenen' : statusFilter === 'accepted' ? 'angenommenen' : 'abgelehnten'} Bewerbungen.`
                        : `Nincs ${statusFilter === 'pending' ? 'függőben lévő' : statusFilter === 'accepted' ? 'elfogadott' : 'elutasított'} jelentkezésed.`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Elérhető igények keresése */}
          <div>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>{market === 'de' ? 'Suche nach verfuegbaren Anfragen' : 'Elérhető Igények Keresése'}</h3>
            
            <div className="mb-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={market === 'de' ? 'Suche nach Apothekenname oder Postleitzahl...' : 'Keresés gyógyszertár neve vagy irányítószám alapján...'}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1] ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-[#E5E7EB] text-[#111827]'}`}
                />
              </div>
            </div>

            {filteredDemands.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-[#F9FAFB]'} rounded-lg p-8 text-center`}>
                <Calendar className={`w-12 h-12 mx-auto ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} mb-3`} />
                <p className={`${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                  {searchQuery
                    ? (market === 'de' ? 'Keine Treffer zu den Suchkriterien.' : 'Nincs találat a keresési feltételeknek megfelelően.')
                    : (market === 'de' ? 'Derzeit ist keine Anfrage verfuegbar.' : 'Jelenleg nincs elérhető igény.')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDemands.map(demand => (
                  <div key={demand.id} className={`border-b pb-3 pt-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-[#E5E7EB]'}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-1 text-sm`}>{demand.pharmacyName}</h4>
                        <ResponseRateBar pharmacyId={demand.pharmacyId} />
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                          {new Date(demand.date).toLocaleDateString(locale)}
                          {demand.workHours && ` • ${demand.workHours}`}
                          {demand.pharmacyCity && ` • ${demand.pharmacyFullAddress || `${demand.pharmacyZipCode || ''} ${demand.pharmacyCity || ''}`}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleApplyToDemand(demand.id)}
                        className="px-3 py-1.5 bg-[#6B46C1] text-white rounded hover:bg-[#5a3aa3] text-xs font-medium"
                      >
                        {market === 'de' ? 'Bewerben' : 'Jelentkezem'}
                      </button>
                      <button 
                        onClick={() => router.push(`/pharmagister/demand/${demand.id}`)}
                        className={`px-3 py-1.5 border rounded text-xs font-medium ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-600' : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]'}`}
                      >
                        {market === 'de' ? 'Details' : 'Részletek'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
