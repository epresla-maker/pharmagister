"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, addDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
import { Loader2, Search, ChevronDown, ChevronUp, MapPin, Clock, CheckCircle, XCircle, MessageCircle, User, Calendar, Edit2, Trash2, Eye, CalendarDays, Filter } from 'lucide-react';

export default function PharmaDashboard({ pharmaRole, expandDemandId }) {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myApplications, setMyApplications] = useState([]);
  const [myDemands, setMyDemands] = useState([]);
  const [availableDemands, setAvailableDemands] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDemand, setExpandedDemand] = useState(expandDemandId || null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'accepted', 'rejected'

  useEffect(() => {
    console.log('🔄 PharmaDashboard useEffect triggered - user:', user?.uid, 'pharmaRole:', pharmaRole);
    loadData();
  }, [user, pharmaRole]);

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
    
    // Szűrjük ki a múltbeli dátumú igényeket (lokális időzóna!)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const demandsData = demandsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(demand => {
        // Csak olyan igényeket tartunk meg, amelyek dátuma ma vagy jövőbeli
        return demand.date >= todayStr;
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
        // Csak olyan igényeket tartunk meg, amelyek dátuma ma vagy jövőbeli
        return demand.date >= todayStr2;
      });

    // Szűrés: amelyekre még nem jelentkezett
    const appliedDemandIds = applicationsData.map(app => app.demandId);
    const available = demandsData.filter(d => !appliedDemandIds.includes(d.id));

    setAvailableDemands(available);
  };

  const handleAcceptApplication = async (applicationId, demandId) => {
    if (!confirm('Biztosan elfogadod ezt a jelentkezést?')) return;

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
        title: 'Jelentkezés elfogadva! ✅',
        message: `${userData.pharmacyName || userData.displayName} elfogadta a jelentkezésedet.`,
        data: {
          demandId: demandId,
          pharmacyId: user.uid,
          demandDate: demandData?.date,
          position: demandData?.position,
        },
        url: `/pharmagister/demand/${demandId}`
      });

      alert('Jelentkezés elfogadva!');
      await loadData();
    } catch (error) {
      console.error('Error accepting application:', error);
      alert('Hiba történt az elfogadás során.');
    }
  };

  const handleRejectApplication = async (applicationId) => {
    const reason = prompt('Add meg az elutasítás okát (opcionális):') || 'Betelt pozíció';

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
        title: 'Jelentkezés elutasítva ❌',
        message: `${userData.pharmacyName || userData.displayName} elutasította a jelentkezésedet. Indok: ${reason}`,
        url: '/pharmagister?tab=dashboard'
      });

      alert('Jelentkezés elutasítva.');
      await loadData();
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert('Hiba történt az elutasítás során.');
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
            [user.uid]: userData?.pharmacyName || userData?.displayName || 'Felhasználó',
            [application.applicantId]: application.applicantName || 'Jelentkező'
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
          relatedDemandPositionLabel: demand.position === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens',
          archivedBy: [],
          deletedBy: [],
          readBy: []
        });
        router.push(`/chat/${newChatRef.id}`);
      }
      
    } catch (error) {
      console.error('Error opening chat:', error);
      alert('Hiba történt a chat megnyitása során.');
    }
  };

  const handleDeleteDemand = async (demandId) => {
    if (!confirm('Biztosan törlöd ezt az igényt? Ez a művelet nem vonható vissza!')) return;

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
      
      // Igény törlése
      await deleteDoc(doc(db, 'pharmaDemands', demandId));
      
      alert('Igény sikeresen törölve!');
      await loadData();
    } catch (error) {
      console.error('Error deleting demand:', error);
      alert('Hiba történt az igény törlése során.');
    }
  };

  const handleEditDemand = async (demand) => {
    // Munkaidő
    const newWorkHours = prompt('Munkaidő:', demand.workHours || '');
    if (newWorkHours === null) return; // Cancel
    
    // Min. tapasztalat
    const newMinExperience = prompt('Minimum tapasztalat (év):', demand.minExperience || '');
    if (newMinExperience === null) return;
    
    // Szoftverismeret - egyszerűsített
    const currentSoftware = demand.requiredSoftware?.join(', ') || '';
    const newRequiredSoftware = prompt('Szoftverismeret (vesszővel elválasztva):', currentSoftware);
    if (newRequiredSoftware === null) return;
    
    // Egyéb szoftver
    const newOtherSoftware = prompt('Egyéb szoftver:', demand.otherSoftware || '');
    if (newOtherSoftware === null) return;
    
    // Max órabér
    const newMaxHourlyRate = prompt('Maximum órabér (Ft):', demand.maxHourlyRate || '');
    if (newMaxHourlyRate === null) return;
    
    // Egyéb követelmények
    const newAdditionalRequirements = prompt('Egyéb követelmények:', demand.additionalRequirements || '');
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

      alert('Igény sikeresen módosítva!');
      await loadData();
    } catch (error) {
      console.error('Error editing demand:', error);
      alert('Hiba történt az igény módosítása során.');
    }
  };

  const handleApplyToDemand = async (demandId) => {
    if (!userData?.pharmaProfileComplete) {
      alert('Kérlek előbb töltsd ki a profilodat a Profilom fülön!');
      return;
    }

    try {
      // Get demand details to send notification to pharmacy
      const demandDoc = await getDoc(doc(db, 'pharmaDemands', demandId));
      const demandData = demandDoc.data();
      
      // Szerepkör ellenőrzés - KRITIKUS!
      if (!userData.pharmagisterRole || userData.pharmagisterRole === 'pharmacy') {
        alert('Csak gyógyszerészek és szakasszisztensek jelentkezhetnek!');
        return;
      }

      // Ellenőrizzük hogy a szerepkör egyezik-e az igénnyel
      const userRole = userData.pharmagisterRole; // 'pharmacist' vagy 'assistant'
      const demandPosition = demandData.position; // 'pharmacist' vagy 'assistant'
      
      if (userRole !== demandPosition) {
        const userRoleLabel = userRole === 'pharmacist' ? 'gyógyszerész' : 'szakasszisztens';
        const demandPositionLabel = demandPosition === 'pharmacist' ? 'gyógyszerész' : 'szakasszisztens';
        alert(`Erre az igényre csak ${demandPositionLabel}ek jelentkezhetnek! Te ${userRoleLabel}ként vagy regisztrálva.`);
        return;
      }

    const message = prompt('Üzenet a gyógyszertárnak (opcionális):');
      
      await addDoc(collection(db, 'pharmaApplications'), {
        demandId,
        applicantId: user.uid,
        applicantName: user.displayName || 'Ismeretlen',
        applicantRole: pharmaRole,
        status: 'pending',
        message: message || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Send notification with push to pharmacy owner
      await createNotificationWithPush({
        userId: demandData.pharmacyId,
        type: 'pharma_application',
        title: 'Új jelentkező! 📝',
        message: `${user.displayName || 'Valaki'} jelentkezett az igényedre.`,
        data: { demandId },
        url: `/pharmagister?tab=dashboard&expand=${demandId}`
      });

      alert('Jelentkezés sikeresen elküldve!');
      await loadData();
    } catch (error) {
      console.error('Error applying to demand:', error);
      alert('Hiba történt a jelentkezés során.');
    }
  };

  const handleCancelApplication = async (applicationId) => {
    if (!confirm('Biztosan visszavonod a jelentkezésed?')) return;

    try {
      await deleteDoc(doc(db, 'pharmaApplications', applicationId));
      alert('Jelentkezés visszavonva.');
      await loadData();
    } catch (error) {
      console.error('Error canceling application:', error);
      alert('Hiba történt a visszavonás során.');
    }
  };

  const handleDeleteApplication = async (applicationId) => {
    if (!confirm('Biztosan törlöd ezt a jelentkezést az előzményekből?')) return;

    try {
      await deleteDoc(doc(db, 'pharmaApplications', applicationId));
      alert('Jelentkezés törölve az előzményekből.');
      await loadData();
    } catch (error) {
      console.error('Error deleting application:', error);
      alert('Hiba történt a törlés során.');
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
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Vezérlőpult</h2>
        <button
          onClick={() => router.push('/pharmagister?tab=calendar')}
          className="flex items-center gap-2 px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3aa3] transition-colors"
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-sm font-medium">Naptár</span>
        </button>
      </div>

      {pharmaRole === 'pharmacy' ? (
        // Gyógyszertár Dashboard
        <div className="space-y-4">
          <div className={`${darkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-[#6B46C1]'} border-l-4 p-3 rounded`}>
            <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} text-sm mb-1`}>Meghirdetett Igényeim Kezelése</h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              Itt kezelheted az általad feladott igényeket és a jelentkezőket.
            </p>
          </div>

          {myDemands.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className={`w-10 h-10 mx-auto ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} mb-2`} />
              <p className={`${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} text-sm`}>Még nincs feladott igényed.</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#6B7280]'} mt-1`}>Menj a Naptár fülre és adj fel egy igényt!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myDemands.map(demand => (
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
                            {demand.position === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens'}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            demand.status === 'open' ? (darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700') :
                            demand.status === 'filled' ? (darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700') :
                            (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-[#F3F4F6] text-[#111827]')
                          }`}>
                            {demand.status === 'open' ? 'Nyitott' :
                             demand.status === 'filled' ? 'Betöltve' : 'Törölve'}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          {new Date(demand.date).toLocaleDateString('hu-HU', { 
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
                          <h5 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2 text-sm`}>Jelentkezők:</h5>
                          {demand.applications.filter(app => app.status === 'pending').map(application => (
                            <div key={application.id} className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-[#E5E7EB]'} rounded-lg p-3 border`}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} text-sm block truncate`}>{application.applicantName}</span>
                                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                                    {application.appliedAt?.toDate ? application.appliedAt.toDate().toLocaleDateString('hu-HU') : 
                                     application.appliedAt ? new Date(application.appliedAt).toLocaleDateString('hu-HU') : ''}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 ${darkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'} rounded text-xs font-medium whitespace-nowrap ml-2`}>
                                  Függőben
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
                                  Adatlap
                                </button>
                                <button 
                                  onClick={() => handleSendMessage(application, demand)}
                                  className={`px-2 py-1.5 text-xs ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]'} rounded transition-colors flex items-center justify-center gap-1`}
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  Üzenet
                                </button>
                                <button
                                  onClick={() => handleAcceptApplication(application.id, demand.id)}
                                  className="px-2 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Elfogad
                                </button>
                                <button
                                  onClick={() => handleRejectApplication(application.id)}
                                  className="px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Elutasít
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
                                      Elfogadva
                                    </span>
                                  </div>
                                  <p className="text-xs text-green-700">
                                    A helyettesítő elérhetőségei láthatók az adatlapján
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleSendMessage(application, demand)}
                                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    Üzenet
                                  </button>
                                  <button 
                                    onClick={() => router.push(`/profil/${application.applicantId}`)}
                                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                  >
                                    Adatlap
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[#6B7280] text-center py-4">Még nincs jelentkező erre az igényre.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Helyettesítő Dashboard
        <div className="space-y-6">
          {/* Saját jelentkezések */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                Jelentkezéseim ({myApplications.length})
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
                Összes ({myApplications.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Függőben ({myApplications.filter(a => a.status === 'pending').length})
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'accepted'
                    ? 'bg-green-500 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Elfogadva ({myApplications.filter(a => a.status === 'accepted').length})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'rejected'
                    ? 'bg-red-500 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Elutasítva ({myApplications.filter(a => a.status === 'rejected').length})
              </button>
            </div>

            {myApplications.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-8 text-center`}>
                <Calendar className={`w-12 h-12 mx-auto ${darkMode ? 'text-gray-400' : 'text-gray-400'} mb-3`} />
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Még nincs jelentkezésed.</p>
                <button
                  onClick={() => router.push('/pharmagister?tab=calendar')}
                  className="mt-4 px-4 py-2 bg-[#6B46C1] text-white rounded-lg text-sm hover:bg-[#5a3aa3]"
                >
                  Keress igényeket a naptárban
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
                            {application.demand?.pharmacyName || 'Ismeretlen gyógyszertár'}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            application.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            application.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {application.status === 'accepted' ? '✓ Elfogadva' :
                             application.status === 'rejected' ? '✗ Elutasítva' : '⏳ Függőben'}
                          </span>
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          {application.demand?.date && new Date(application.demand.date).toLocaleDateString('hu-HU', {
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
                          <strong>Elutasítás oka:</strong> {application.rejectionReason}
                        </p>
                      </div>
                    )}

                    {application.status === 'accepted' && (
                      <div className={`mt-3 p-2 ${darkMode ? 'bg-green-900/30' : 'bg-green-50'} rounded-lg`}>
                        <p className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                          🎉 Gratulálunk! A gyógyszertár elfogadta a jelentkezésedet.
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
                          Gyógyszertár
                        </button>
                      )}
                      <button className={`flex items-center gap-1 px-3 py-1.5 text-xs ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} rounded-lg transition-colors`}>
                        <MessageCircle className="w-3.5 h-3.5" />
                        Üzenet
                      </button>
                      {application.status === 'pending' && (
                        <button
                          onClick={() => handleCancelApplication(application.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Visszavonás
                        </button>
                      )}
                      {application.status === 'rejected' && (
                        <button
                          onClick={() => handleDeleteApplication(application.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Törlés
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {myApplications.filter(app => statusFilter === 'all' || app.status === statusFilter).length === 0 && (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-6 text-center`}>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                      Nincs {statusFilter === 'pending' ? 'függőben lévő' : statusFilter === 'accepted' ? 'elfogadott' : 'elutasított'} jelentkezésed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Elérhető igények keresése */}
          <div>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Elérhető Igények Keresése</h3>
            
            <div className="mb-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keresés gyógyszertár neve vagy irányítószám alapján..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1] ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-[#E5E7EB] text-[#111827]'}`}
                />
              </div>
            </div>

            {filteredDemands.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-[#F9FAFB]'} rounded-lg p-8 text-center`}>
                <Calendar className={`w-12 h-12 mx-auto ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} mb-3`} />
                <p className={`${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                  {searchQuery ? 'Nincs találat a keresési feltételeknek megfelelően.' : 'Jelenleg nincs elérhető igény.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDemands.map(demand => (
                  <div key={demand.id} className={`border-b pb-3 pt-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-[#E5E7EB]'}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-1 text-sm`}>{demand.pharmacyName}</h4>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                          {new Date(demand.date).toLocaleDateString('hu-HU')}
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
                        Jelentkezem
                      </button>
                      <button 
                        onClick={() => router.push(`/pharmagister/demand/${demand.id}`)}
                        className={`px-3 py-1.5 border rounded text-xs font-medium ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-600' : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]'}`}
                      >
                        Részletek
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
