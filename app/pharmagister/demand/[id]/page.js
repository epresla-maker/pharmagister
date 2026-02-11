"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useParams } from 'next/navigation';
import RouteGuard from '@/app/components/RouteGuard';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, Timestamp, collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
import { MessageCircle } from 'lucide-react';

export default function DemandDetailPage() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const params = useParams();
  const demandId = params.id;

  const [demand, setDemand] = useState(null);
  const [pharmacyData, setPharmacyData] = useState(null);
  const [myApplication, setMyApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [error, setError] = useState(null);
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    const fetchDemand = async () => {
      if (!demandId) return;
      
      try {
        setLoading(true);
        const demandRef = doc(db, 'pharmaDemands', demandId);
        const demandSnap = await getDoc(demandRef);

        if (demandSnap.exists()) {
          const demandData = { id: demandSnap.id, ...demandSnap.data() };
          setDemand(demandData);
          
          // Check if user already applied
          if (user && demandData.applicants?.some(a => a.userId === user.uid)) {
            setHasApplied(true);
          }

          // Fetch pharmacy data
          if (demandData.pharmacyId) {
            const pharmacyRef = doc(db, 'users', demandData.pharmacyId);
            const pharmacySnap = await getDoc(pharmacyRef);
            if (pharmacySnap.exists()) {
              setPharmacyData(pharmacySnap.data());
            }
          }

          // Check user's application status in pharmaApplications collection
          if (user) {
            const appQuery = query(
              collection(db, 'pharmaApplications'),
              where('demandId', '==', demandId),
              where('applicantId', '==', user.uid)
            );
            const appSnapshot = await getDocs(appQuery);
            if (!appSnapshot.empty) {
              const appData = { id: appSnapshot.docs[0].id, ...appSnapshot.docs[0].data() };
              setMyApplication(appData);
              setHasApplied(true);
            }
          }
        } else {
          setError('Az igény nem található.');
        }
      } catch (err) {
        console.error('Error fetching demand:', err);
        setError('Hiba történt az igény betöltésekor.');
      } finally {
        setLoading(false);
      }
    };

    fetchDemand();
  }, [demandId, user]);

  const handleApply = async () => {
    if (!user || !userData) {
      router.push('/login');
      return;
    }

    // Check if user has pharmagister role
    if (!userData.pharmagisterRole || userData.pharmagisterRole === 'pharmacy') {
      alert('Csak gyógyszerészek és szakasszisztensek jelentkezhetnek!');
      return;
    }

    // Check if profile is complete
    if (!userData.pharmaProfileComplete) {
      alert('Kérlek először töltsd ki a profilodat!');
      return;
    }

    // Check if user's role matches the demand position
    const userRole = userData.pharmagisterRole; // 'pharmacist' or 'assistant'
    const demandPosition = demand.position; // 'pharmacist' or 'assistant'
    
    console.log('🔍 Szerepkör ellenőrzés:', {
      userRole,
      demandPosition,
      matches: userRole === demandPosition
    });
    
    if (userRole !== demandPosition) {
      const userRoleLabel = userRole === 'pharmacist' ? 'gyógyszerész' : 'szakasszisztens';
      const demandPositionLabel = demandPosition === 'pharmacist' ? 'gyógyszerész' : 'szakasszisztens';
      console.log('❌ Szerepkör nem egyezik! User:', userRoleLabel, '| Demand:', demandPositionLabel);
      alert(`Erre az igényre csak ${demandPositionLabel}ek jelentkezhetnek. Te ${userRoleLabel}ként vagy regisztrálva.`);
      return;
    }
    
    console.log('✅ Szerepkör egyezik, folytatás...');

    try {
      setApplying(true);

      const applicantData = {
        applicantId: user.uid,
        userId: user.uid,
        displayName: userData.displayName || 'Névtelen',
        photoURL: userData.photoURL || null,
        pharmagisterRole: userData.pharmagisterRole,
        email: userData.email,
        phone: userData.pharmaPhone || userData.phone || null,
        experience: userData.pharmaYearsOfExperience || null,
        hourlyRate: userData.pharmaHourlyRate || null,
        software: userData.pharmaSoftwareKnowledge || [],
        bio: userData.pharmaBio || '',
        appliedAt: Timestamp.now(),
        status: 'pending' // pending, accepted, rejected
      };

      // 1. Mentés az igény documentbe (gyors olvasáshoz)
      const demandRef = doc(db, 'pharmaDemands', demandId);
      await updateDoc(demandRef, {
        applicants: arrayUnion(applicantData)
      });

      // 2. Külön document létrehozása a pharmaApplications collection-ben (kezeléshez)
      await addDoc(collection(db, 'pharmaApplications'), {
        demandId: demandId,
        pharmacyId: demand.pharmacyId,
        applicantId: user.uid,
        displayName: userData.displayName || 'Névtelen',
        photoURL: userData.photoURL || null,
        pharmagisterRole: userData.pharmagisterRole,
        email: userData.email,
        phone: userData.pharmaPhone || userData.phone || null,
        experience: userData.pharmaYearsOfExperience || null,
        hourlyRate: userData.pharmaHourlyRate || null,
        software: userData.pharmaSoftwareKnowledge || [],
        bio: userData.pharmaBio || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Értesítés küldése gyógyszertárnak push-sal
      console.log('📧 Értesítés küldése gyógyszertárnak:', {
        pharmacyId: demand.pharmacyId,
        demandDate: demand.date,
        applicantName: userData.displayName
      });
      
      await createNotificationWithPush({
        userId: demand.pharmacyId,
        type: 'pharma_application',
        title: 'Új jelentkező! 📝',
        message: `${userData.displayName || 'Valaki'} jelentkezett a ${new Date(demand.date).toLocaleDateString('hu-HU')}-i helyettesítésre.`,
        data: {
          demandId: demandId,
          applicantId: user.uid,
        },
        url: `/pharmagister?tab=dashboard&expand=${demandId}`
      });
      
      console.log('✅ Értesítés sikeresen létrehozva!');

      setHasApplied(true);
      alert('Sikeres jelentkezés! A gyógyszertár hamarosan értesítést kap és felveszi veled a kapcsolatot.');

    } catch (err) {
      console.error('Error applying:', err);
      alert('Hiba történt a jelentkezés során. Kérjük, próbáld újra.');
    } finally {
      setApplying(false);
    }
  };

  const handleOpenChat = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    setOpeningChat(true);
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
        // Check both: same pharmacy AND same demand
        if (chatData.members.includes(demand.pharmacyId) && chatData.relatedDemandId === demandId) {
          chatId = chatDoc.id;
        }
      });
      
      if (chatId) {
        // If chat exists, navigate to it
        router.push(`/chat/${chatId}`);
      } else {
        // Create new chat directly and navigate to it
        const newChatRef = await addDoc(chatsRef, {
          members: [user.uid, demand.pharmacyId],
          memberNames: {
            [user.uid]: userData?.displayName || 'Felhasználó',
            [demand.pharmacyId]: demand.pharmacyName || 'Gyógyszertár'
          },
          memberPhotos: {
            [user.uid]: userData?.photoURL || null,
            [demand.pharmacyId]: pharmacyData?.pharmaPhotoURL || pharmacyData?.photoURL || null
          },
          createdAt: serverTimestamp(),
          lastMessageAt: null,
          lastMessage: null,
          lastMessageSenderId: null,
          relatedDemandId: demandId,
          relatedDemandDate: demand.date,
          relatedDemandPosition: demand.position,
          relatedDemandPositionLabel: demand.position === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens',
          archivedBy: [],
          deletedBy: [],
          readBy: []
        });
        router.push(`/chat/${newChatRef.id}`);
      }
      
    } catch (err) {
      console.error('Error opening chat:', err);
      alert('Hiba történt a chat megnyitásakor.');
    } finally {
      setOpeningChat(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </RouteGuard>
    );
  }

  if (error || !demand) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} p-4`}>
          <div className="max-w-lg mx-auto pt-20 text-center">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-xl font-bold mb-2">{error || 'Hiba történt'}</h1>
            <button
              onClick={() => router.back()}
              className="mt-4 text-green-600 hover:text-green-700 font-medium"
            >
              ← Vissza
            </button>
          </div>
        </div>
      </RouteGuard>
    );
  }

  const positionLabels = {
    pharmacist: 'Gyógyszerész',
    assistant: 'Szakasszisztens'
  };

  const getMonogram = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isOwnDemand = user?.uid === demand.pharmacyId;
  const isPendingApproval = userData?.pharmaPendingApproval && !userData?.pharmaProfileComplete;
  const roleMatches = userData?.pharmagisterRole === demand.position;
  const canApply = userData?.pharmagisterRole && 
                   userData.pharmagisterRole !== 'pharmacy' &&
                   !isOwnDemand &&
                   demand.status === 'open' &&
                   roleMatches &&
                   !isPendingApproval;
  
  // Debug log
  console.log('🔍 Demand Detail Debug:', {
    isOwnDemand,
    userUid: user?.uid,
    pharmacyId: demand.pharmacyId,
    userRole: userData?.pharmagisterRole,
    demandPosition: demand.position,
    roleMatches,
    canApply,
    isPendingApproval,
    pharmaProfileComplete: userData?.pharmaProfileComplete,
    hasUser: !!user
  });

  // Show buttons for any logged-in user (always show if user exists)
  const showBottomButtons = !!user;

  return (
    <RouteGuard>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} pb-32`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Helyettesítési igény</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          {/* Application Status Banner */}
          {myApplication && (
            <div className={`p-4 rounded-xl border ${
              myApplication.status === 'accepted' 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                : myApplication.status === 'rejected'
                ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {myApplication.status === 'accepted' ? '✅' : myApplication.status === 'rejected' ? '❌' : '⏳'}
                </span>
                <div className="flex-1">
                  <h3 className={`font-semibold ${
                    myApplication.status === 'accepted' 
                      ? 'text-green-800 dark:text-green-300' 
                      : myApplication.status === 'rejected'
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {myApplication.status === 'accepted' 
                      ? 'Jelentkezésed elfogadva!' 
                      : myApplication.status === 'rejected'
                      ? 'Jelentkezésed elutasítva'
                      : 'Jelentkezésed elbírálás alatt'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    myApplication.status === 'accepted' 
                      ? 'text-green-700 dark:text-green-400' 
                      : myApplication.status === 'rejected'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-yellow-700 dark:text-yellow-400'
                  }`}>
                    {myApplication.status === 'accepted' 
                      ? 'A gyógyszertár elfogadta a jelentkezésedet. Az elérhetőségeik lent találhatók!' 
                      : myApplication.status === 'rejected'
                      ? `Indok: ${myApplication.rejectionReason || 'Nincs megadva'}`
                      : 'A gyógyszertár hamarosan válaszol a jelentkezésedre.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pharmacy Info Card */}
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl overflow-hidden`}>
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                {pharmacyData?.photoURL ? (
                  <img 
                    src={pharmacyData.photoURL} 
                    alt={demand.pharmacyName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-green-600"
                  />
                ) : (
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center border-2 border-green-700">
                    <span className="text-white font-bold text-xl">
                      {getMonogram(demand.pharmacyName)}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-lg">{demand.pharmacyName}</h2>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {demand.pharmacyFullAddress || `${demand.pharmacyZipCode || ''} ${demand.pharmacyCity || ''}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Demand Status Badge */}
            <div className="px-4 pt-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                demand.status === 'open' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : demand.status === 'filled'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {demand.status === 'open' ? '🟢 Aktív' : demand.status === 'filled' ? '✅ Betöltve' : '⚪ Lezárva'}
              </span>
            </div>

            {/* Details */}
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg">
                {positionLabels[demand.position] || demand.position} helyettesítés
              </h3>

              <div className={`space-y-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Dátum</p>
                    <p className="font-medium">
                      {new Date(demand.date).toLocaleDateString('hu-HU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long'
                      })}
                    </p>
                  </div>
                </div>

                {demand.workHours && (
                  <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Munkaidő</p>
                      <p className="font-medium">{demand.workHours}</p>
                    </div>
                  </div>
                )}

                {demand.minExperience && (
                  <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Elvárt tapasztalat</p>
                      <p className="font-medium">{demand.minExperience}</p>
                    </div>
                  </div>
                )}

                {demand.maxHourlyRate && (
                  <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Maximum órabér</p>
                      <p className="font-medium">{demand.maxHourlyRate} Ft/óra</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Required Software */}
              {demand.requiredSoftware && demand.requiredSoftware.length > 0 && (
                <div className="pt-2">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
                    Elvárt szoftverismeret:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {demand.requiredSoftware.map((software, idx) => (
                      <span 
                        key={idx} 
                        className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'} px-3 py-1 rounded-full text-sm`}
                      >
                        {software}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Requirements */}
              {demand.additionalRequirements && (
                <div className={`pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
                    További információk:
                  </p>
                  <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {demand.additionalRequirements}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Pharmacy Contact Details - Show only if application accepted */}
          {myApplication?.status === 'accepted' && pharmacyData && (
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6`}>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>📞</span>
                Gyógyszertár elérhetőségei
              </h3>
              
              <div className="space-y-4">
                {pharmacyData.pharmacyPhone && (
                  <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-2xl">📱</span>
                    <div className="flex-1">
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Telefon</p>
                      <a href={`tel:${pharmacyData.pharmacyPhone}`} className="font-semibold text-purple-600 hover:underline">
                        {pharmacyData.pharmacyPhone}
                      </a>
                    </div>
                  </div>
                )}

                {pharmacyData.email && (
                  <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-2xl">📧</span>
                    <div className="flex-1">
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                      <a href={`mailto:${pharmacyData.email}`} className="font-semibold text-purple-600 hover:underline">
                        {pharmacyData.email}
                      </a>
                    </div>
                  </div>
                )}

                {pharmacyData.pharmacyNKK && (
                  <div className="flex items-center gap-3 py-3">
                    <span className="text-2xl">🏥</span>
                    <div className="flex-1">
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>NKK szám</p>
                      <p className="font-semibold">{pharmacyData.pharmacyNKK}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-green-900/20' : 'bg-green-50'}`}>
                <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                  💡 <strong>Tipp:</strong> Vedd fel a kapcsolatot a gyógyszertárral mielőbb, hogy megbeszéljétek a részleteket!
                </p>
              </div>

              {/* Chat button */}
              <button
                onClick={handleOpenChat}
                disabled={openingChat}
                className="w-full mt-4 px-4 py-3 bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors font-semibold flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-5 h-5" />
                {openingChat ? 'Megnyitás...' : 'Üzenet küldése'}
              </button>
            </div>
          )}

          {/* Applicants count for pharmacy owners */}
          {isOwnDemand && demand.applicants && demand.applicants.length > 0 && (
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-4`}>
              <h3 className="font-semibold mb-3">
                Jelentkezők ({demand.applicants.length})
              </h3>
              <div className="space-y-3">
                {demand.applicants.map((applicant, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
                  >
                    {applicant.photoURL ? (
                      <img 
                        src={applicant.photoURL} 
                        alt={applicant.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {getMonogram(applicant.displayName)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{applicant.displayName}</p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {applicant.pharmagisterRole === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens'}
                        {applicant.experience && ` • ${applicant.experience}`}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/profil/${applicant.userId}`)}
                      className="text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      Profil →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed Bottom */}
        {!isOwnDemand && demand.status === 'open' && (
          <div className={`fixed bottom-20 left-0 right-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t p-4 z-10 shadow-lg`}>
            <div className="max-w-lg mx-auto flex gap-3">
              {roleMatches ? (
                <>
                  {!hasApplied ? (
                    <button
                      onClick={handleApply}
                      disabled={applying || isPendingApproval}
                      className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {applying ? 'Jelentkezés...' : 'Jelentkezem'}
                    </button>
                  ) : (
                    <div className="flex-1 px-4 py-3 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-xl font-semibold text-center">
                      ✅ Jelentkeztél
                    </div>
                  )}
                  <button
                    onClick={handleOpenChat}
                    disabled={openingChat}
                    className="px-4 py-3 bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors font-semibold flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <MessageCircle className="w-5 h-5" />
                    {openingChat ? 'Megnyitás...' : 'Üzenet'}
                  </button>
                </>
              ) : (
                <div className={`flex-1 px-4 py-3 rounded-xl text-center font-semibold ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                  {demand.position === 'pharmacist' ? 'Csak gyógyszerészeknek' : 'Csak szakasszisztenseknek'}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </RouteGuard>
  );
}
