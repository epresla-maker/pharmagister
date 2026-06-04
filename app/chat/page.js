// app/chat/page.js
"use client";

import { useState, useEffect, useRef } from "react"; 
import { useRouter } from "next/navigation";
import Image from "next/image";
// Framer-motion eltávolítva a jobb teljesítmény érdekében
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import ChatBottomNavigation from "@/app/components/ChatBottomNavigation";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  getDocs,
  serverTimestamp,
  updateDoc, 
  arrayUnion, 
} from "firebase/firestore";
import ReportModal from "@/app/components/ReportModal";
import BlockUserModal from "@/app/components/BlockUserModal";
import { getClientMarket, t } from '@/lib/marketI18n';

// --- Segédfüggvény az idő formázásához ---
function formatChatTimestamp(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// --- Segédfüggvény a (már aktív) chat partnerek adatainak lekéréséhez ---
async function getChatPartnerDetails(chats, currentUserId) {
  const partnerIds = chats.map(chat => chat.members.find(id => id !== currentUserId));
  const uniquePartnerIds = [...new Set(partnerIds.filter(id => id))];
  const partnerDataMap = new Map();

  for (const id of uniquePartnerIds) {
    try {
      const userDoc = await getDoc(doc(db, "users", id));
      if (userDoc.exists()) {
        const data = userDoc.data();
        // Gyógyszertár esetén a pharmacyName-et használjuk, egyébként displayName
        const name = data.pharmagisterRole === 'pharmacy' && data.pharmacyName 
          ? data.pharmacyName 
          : (data.displayName || "Ismeretlen");
        const photoURL = data.pharmaPhotoURL || data.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${name.replace(/\s/g, '%20')}`;
        partnerDataMap.set(id, { name, photoURL });
      }
    } catch (error) {
      console.error("Hiba a partner adatainak lekérésekor:", error);
      partnerDataMap.set(id, { name: "Ismeretlen", photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=Ismeretlen` });
    }
  }
  return partnerDataMap;
}

// --- Segédfüggvény: Az összes ISMERŐS adatának lekérése a keresőhöz ---
async function fetchFriendData(friendIds) {
  if (!friendIds || friendIds.length === 0) return [];
  const friendData = [];
  for (const id of friendIds) {
    try {
      const docSnap = await getDoc(doc(db, "users", id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const name = data.displayName || "Ismeretlen";
        const photoURL = data.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${name.replace(/\s/g, '%20')}`;
        friendData.push({ id, name, photoURL });
      }
    } catch (error) { 
      console.error("Hiba az ismerős adatainak lekérésekor:", error);
    } 
  }
  return friendData.sort((a, b) => a.name.localeCompare(b.name));
}

// =================================================================
// --- Megerősítő Modal a Törléshez ---
// =================================================================
function DeleteConfirmModal({ isOpen, onClose, onArchive, onDelete, onReport, onBlock, chatName, darkMode, market }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className={`w-full max-w-sm rounded-2xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {market === 'de' ? 'Chat entfernen' : 'Beszélgetés törlése'}
        </h3>
        <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {market === 'de' ? 'Was moechtest du mit dem Chat' : 'Mit szeretnél tenni a(z)'} <span className="font-medium">{chatName}</span>{market === 'de' ? '?' : ' beszélgetéssel?'}
        </p>
        
        <div className="space-y-3">
          {/* Lomtárba helyezés (archiválás) */}
          <button
            onClick={onArchive}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors
              ${darkMode 
                ? 'bg-cyan-900/50 text-cyan-400 hover:bg-cyan-900' 
                : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
            {market === 'de' ? 'Archivieren' : 'Lomtárba helyezés'}
          </button>
          
          {/* Végleges törlés */}
          <button
            onClick={onDelete}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors
              ${darkMode 
                ? 'bg-red-900/50 text-red-400 hover:bg-red-900' 
                : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            {market === 'de' ? 'Endgueltig loeschen' : 'Végleges törlés'}
          </button>
          
          {/* Jelentés */}
          <button
            onClick={onReport}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors
              ${darkMode 
                ? 'bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900' 
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            {market === 'de' ? 'Benutzer melden' : 'Felhasználó jelentése'}
          </button>
          
          {/* Letiltás */}
          <button
            onClick={onBlock}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors
              ${darkMode 
                ? 'bg-orange-900/50 text-orange-400 hover:bg-orange-900' 
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            {market === 'de' ? 'Benutzer blockieren' : 'Felhasználó letiltása'}
          </button>
          
          {/* Mégse */}
          <button
            onClick={onClose}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-colors
              ${darkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {market === 'de' ? 'Abbrechen' : 'Mégse'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// --- Chat Elem Komponens (törlés gombbal) ---
// =================================================================
function ChatItem({ chat, onArchive, onDelete, onNavigate, onReport, onBlock, isUnread, darkMode, demandInfo, market }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };
  
  const handleArchive = () => {
    setShowDeleteModal(false);
    onArchive(chat.id);
  };
  
  const handleDelete = () => {
    setShowDeleteModal(false);
    onDelete(chat.id);
  };
  
  return (
    <>
      <div
        onClick={() => onNavigate(chat.id)}
        className={`relative flex items-center p-4 ${darkMode ? 'bg-black hover:bg-gray-900' : 'bg-white hover:bg-gray-50'} cursor-pointer transition duration-200`}
      >
        <div className="relative">
          <Image
            src={chat.otherUserPhotoURL}
            alt={chat.otherUserName}
            width={50}
            height={50}
            className={`rounded-full object-cover mr-4 border-2 ${darkMode ? 'border-gray-700' : 'border-[#E5E7EB]'}`}
            unoptimized
          />
          {isUnread && (
            <div className="absolute top-0 right-3 w-3 h-3 bg-blue-500 rounded-full border-2 border-gray-800"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg truncate ${isUnread ? (darkMode ? 'font-bold text-white' : 'font-bold text-[#111827]') : (darkMode ? 'font-semibold text-gray-300' : 'font-semibold text-gray-700')}`}>
            {chat.otherUserName}
          </h2>
          {demandInfo ? (
            <p className={`text-xs truncate ${isUnread ? (darkMode ? 'font-semibold text-gray-400' : 'font-semibold text-[#374151]') : (darkMode ? 'text-gray-500' : 'text-[#6B7280]')}`}>
              {demandInfo}
            </p>
          ) : (
            <p className={`text-sm truncate ${isUnread ? (darkMode ? 'font-semibold text-gray-400' : 'font-semibold text-[#374151]') : (darkMode ? 'text-gray-500' : 'text-[#6B7280]')}`}>
              {chat.lastMessage}
            </p>
          )}
        </div>
        
        {/* Időpont és törlés gomb */}
        <div className="flex items-center gap-2 ml-2">
          <div className="text-right whitespace-nowrap flex flex-col items-end">
            <p className={`text-xs ${isUnread ? 'text-blue-400 font-semibold' : (darkMode ? 'text-gray-500' : 'text-gray-500')}`}>
              {formatChatTimestamp(chat.lastMessageAt)}
            </p>
            {isUnread && (
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
            )}
          </div>
          
          {/* Törlés gomb */}
          <button
            onClick={handleDeleteClick}
            className={`p-2 rounded-full transition-colors ${
              darkMode 
                ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' 
                : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
            }`}
            title={market === 'de' ? 'Chat entfernen' : 'Beszélgetés törlése'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Törlés megerősítő modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onReport={() => {
          setShowDeleteModal(false);
          onReport(chat.otherUserId, chat.otherUserName);
        }}
        onBlock={() => {
          setShowDeleteModal(false);
          onBlock(chat.otherUserId, chat.otherUserName);
        }}
        chatName={chat.otherUserName}
        darkMode={darkMode}
        market={market}
      />
    </>
  );
}


// =================================================================
// --- FŐ KOMPONENS: Chat Lista Oldal ---
// =================================================================
export default function ChatListPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  
  const [chats, setChats] = useState([]);
  const [isFetchingChats, setIsFetchingChats] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [messageSearchResults, setMessageSearchResults] = useState([]);
  const [friendList, setFriendList] = useState([]); 
  const [isFetchingFriends, setIsFetchingFriends] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [autoStartingChat, setAutoStartingChat] = useState(false);
  const [autoStartUserName, setAutoStartUserName] = useState("");
  const autoStartProcessedRef = useRef(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Jelentés és letiltás állapotok
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // { userId, userName }
  const [blockTarget, setBlockTarget] = useState(null); // { userId, userName, isBlocked }
  
  // Olvasatlan üzenetek számolása
  const unreadMessagesCount = chats.filter(chat => chat.isUnread).length;

  // Load dark mode setting
  useEffect(() => {
    if (!user) return;
    const loadDarkMode = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const isDark = userDoc.data().chatSettings?.darkMode ?? false;
          setDarkMode(isDark);
        }
      } catch (error) {
        console.error("Error loading dark mode:", error);
      }
    };
    loadDarkMode();
  }, [user]); 

  // Apply dark mode to body
  useEffect(() => {
    if (darkMode) {
      document.body.style.backgroundColor = '#000000';
    } else {
      document.body.style.backgroundColor = '';
    }
    
    // Cleanup when leaving page
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [darkMode]); 

  // --- 1. useEffect: Aktív beszélgetések figyelése (JAVÍTOTT LEKÉRDEZÉS) ---
  useEffect(() => {
    if (loading || !user) return;

    // ----- EZ A JAVÍTOTT LEKÉRDEZÉS -----
    // Csak a legalapvetőbb szűrést végezzük itt el (tagja vagyok + rendezés)
    // Az összes többi szűrést (szellem, archivált, törölt) a kliens oldalon végezzük
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );
    // -------------------------------------

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setIsFetchingChats(true);
      const rawChats = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // --- SZŰRÉS: Csak azok a chatek jelenjenek meg, ahol van üzenet ---
      const filteredRawChats = rawChats.filter(chat => {
        const isArchived = chat.archivedBy?.includes(user.uid);
        const isDeleted = chat.deletedBy?.includes(user.uid);
        // Chat csak akkor látszik, ha van legalább egy üzenet (lastMessage nem üres)
        const hasMessages = chat.lastMessage && chat.lastMessage.trim() !== '';
        return !isArchived && !isDeleted && hasMessages;
      });
      // --- VÉGE: SZŰRÉS ---

      // A partner adatokat már csak a szűrt lista alapján kérjük le
      const partnerDetailsMap = await getChatPartnerDetails(filteredRawChats, user.uid);

      const chatList = filteredRawChats.map(chat => {
        const otherUserId = chat.members.find(id => id !== user.uid);
        const partner = partnerDetailsMap.get(otherUserId) || 
                        { name: "Ismeretlen", photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=Ismeretlen` };
        
        let lastMessagePreview = chat.lastMessage;
        if (chat.lastMessageSenderId === user.uid) {
          lastMessagePreview = `${market === 'de' ? 'Du' : 'Te'}: ${chat.lastMessage}`;
        }

        // Ellenőrizzük hogy olvasatlan-e
        const isUnread = chat.lastMessageSenderId && 
                        chat.lastMessageSenderId !== user.uid && 
                        (!chat.readBy || !chat.readBy.includes(user.uid));

        // Pozíció és dátum külön mezőben
        let demandInfo = null;
        if (chat.relatedDemandPosition && chat.relatedDemandDate) {
          const positionLabel = chat.relatedDemandPositionLabel || 
            (chat.relatedDemandPosition === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : (market === 'de' ? 'Assistent/in' : 'Szakasszisztens'));
          const demandDate = new Date(chat.relatedDemandDate);
          const formattedDate = demandDate.toLocaleDateString('hu-HU', { 
            month: '2-digit', 
            day: '2-digit' 
          }).replace('. ', '.');
          demandInfo = `${positionLabel} • ${formattedDate}`;
        }

        return {
          id: chat.id,
          otherUserName: partner.name,
          otherUserPhotoURL: partner.photoURL,
          lastMessage: lastMessagePreview,
          lastMessageAt: chat.lastMessageAt?.toDate(),
          isUnread: isUnread,
          demandInfo: demandInfo,
          otherUserId: otherUserId,
        };
      });
      
      setChats(chatList);
      setIsFetchingChats(false);
    }, (error) => {
      // Itt már csak akkor lehet hiba, ha a 'members' és 'lastMessageAt' index hiányzik
      console.error("Hiba a chatek figyelésekor (alap index hiba):", error);
      setIsFetchingChats(false);
    });

    return () => unsubscribe();
  }, [user, loading]);

  // --- 2. useEffect: Ismerősök betöltése a keresőhöz ---
  useEffect(() => {
    if (userData && userData.friends && userData.friends.length > 0) {
      setIsFetchingFriends(true);
      fetchFriendData(userData.friends)
        .then(data => {
          setFriendList(data);
        })
        .catch(err => {
          console.error("Hiba az ismerősök betöltésekor:", err);
        })
        .finally(() => {
          setIsFetchingFriends(false);
        });
    } else if (userData) {
      setIsFetchingFriends(false);
    }
  }, [userData]);

  // --- 3. useEffect: Auto-start chat from URL parameter ---
  useEffect(() => {
    if (loading || !user || autoStartProcessedRef.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get('userId');
    
    if (targetUserId && targetUserId !== user.uid) {
      console.log('🚀 Auto-starting chat with userId:', targetUserId);
      autoStartProcessedRef.current = true;
      setAutoStartingChat(true);
      
      const startChat = async () => {
        try {
          // Fetch target user name first for display
          const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
          if (targetUserDoc.exists()) {
            setAutoStartUserName(targetUserDoc.data().displayName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó'));
          }

          // Először keresünk olyan chat-et ahol mindkét user tag
          const q = query(
            collection(db, "chats"),
            where("members", "array-contains", user.uid)
          );
          const querySnapshot = await getDocs(q);
          
          // Manuálisan szűrjük hogy megtaláljuk azt ahol a target is benne van
          // DE CSAK akkor használjuk, ha egyik fél sem törölte
          let existingChatId = null;
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const members = data.members;
            if (members.includes(targetUserId)) {
              // Csak akkor használjuk a meglévő chatet, ha egyik fél sem törölte
              const isDeletedByMe = data.deletedBy?.includes(user.uid);
              const isDeletedByOther = data.deletedBy?.includes(targetUserId);
              if (!isDeletedByMe && !isDeletedByOther) {
                existingChatId = doc.id;
              }
            }
          });
          
          if (existingChatId) {
            console.log('✅ Existing chat found:', existingChatId);
            router.push(`/chat/${existingChatId}`);
          } else {
            console.log('📝 Creating new chat...');
            const newChatRef = await addDoc(collection(db, "chats"), {
              members: [user.uid, targetUserId],
              createdAt: serverTimestamp(),
              lastMessage: market === 'de' ? 'Noch keine Nachricht.' : 'Még nincs üzenet.',
              lastMessageAt: serverTimestamp(),
              lastMessageSenderId: null,
              archivedBy: [],
              deletedBy: []
            });
            console.log('✅ New chat created:', newChatRef.id);
            router.push(`/chat/${newChatRef.id}`);
          }
        } catch (error) {
          console.error("❌ Hiba a chat indításakor:", error);
          setAutoStartingChat(false);
          autoStartProcessedRef.current = false;
        }
      };
      
      startChat();
    }
  }, [user, loading, router]); 

  // --- Végleges FUNKCIÓ: Chat indítása ---
  const handleStartChat = async (targetUserId) => {
    if (!user || isCreatingChat) return;
    setIsCreatingChat(true);

    try {
      // Először keresünk olyan chat-et ahol mindkét user tag
      const q = query(
        collection(db, "chats"),
        where("members", "array-contains", user.uid)
      );
      const querySnapshot = await getDocs(q);
      
      // Manuálisan szűrjük hogy megtaláljuk azt ahol a target is benne van
      // DE CSAK akkor használjuk, ha egyik fél sem törölte
      let existingChatId = null;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const members = data.members;
        if (members.includes(targetUserId)) {
          // Csak akkor használjuk a meglévő chatet, ha egyik fél sem törölte
          const isDeletedByMe = data.deletedBy?.includes(user.uid);
          const isDeletedByOther = data.deletedBy?.includes(targetUserId);
          if (!isDeletedByMe && !isDeletedByOther) {
            existingChatId = doc.id;
          }
        }
      });
      
      if (existingChatId) {
        console.log('✅ Existing chat found:', existingChatId);
        router.push(`/chat/${existingChatId}`);
      } else {
        console.log('📝 Creating new chat with:', targetUserId);
        const newChatRef = await addDoc(collection(db, "chats"), {
          members: [user.uid, targetUserId],
          createdAt: serverTimestamp(),
          lastMessage: market === 'de' ? 'Noch keine Nachricht.' : 'Még nincs üzenet.',
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: null,
          archivedBy: [],
          deletedBy: [] 
        });
        console.log('✅ New chat created:', newChatRef.id);
        router.push(`/chat/${newChatRef.id}`);
      }
    } catch (error) {
      console.error("❌ Hiba a chat indításakor:", error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  // --- KERESÉSI FUNKCIÓ ---
  const handleSearch = async (term) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      setMessageSearchResults([]);
      return;
    }

    // Üzenet keresés a beszélgetésekben
    const results = [];
    for (const chat of chats) {
      try {
        const messagesRef = collection(db, "chats", chat.id, "messages");
        const q = query(messagesRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        snapshot.forEach((doc) => {
          const msg = doc.data();
          if (msg.text && msg.text.toLowerCase().includes(term.toLowerCase())) {
            // Szavakra bontás és kontextus kivonása
            const words = msg.text.split(/\s+/);
            const searchWords = term.toLowerCase().split(/\s+/);
            
            // Megkeressük a match pozícióját
            let matchIndex = -1;
            for (let i = 0; i < words.length; i++) {
              if (words[i].toLowerCase().includes(searchWords[0].toLowerCase())) {
                matchIndex = i;
                break;
              }
            }
            
            if (matchIndex !== -1) {
              // 2 szó előtte és 2 szó utána
              const start = Math.max(0, matchIndex - 2);
              const end = Math.min(words.length, matchIndex + 3);
              const context = words.slice(start, end).join(' ');
              
              results.push({
                chatId: chat.id,
                chatName: chat.otherUserName,
                chatPhoto: chat.otherUserPhotoURL,
                messageId: doc.id,
                messageText: msg.text,
                context: context,
                timestamp: msg.createdAt?.toDate()
              });
            }
          }
        });
      } catch (error) {
        console.error("Error searching messages:", error);
      }
    }
    
    setMessageSearchResults(results);
  };

  // --- FUNKCIÓK A SWIPE-HOZ ---
  const handleArchive = async (chatId) => {
    if (!user) return;
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    try {
      const chatDocRef = doc(db, "chats", chatId);
      await updateDoc(chatDocRef, {
        archivedBy: arrayUnion(user.uid) 
      });
    } catch (error) {
      console.error("Hiba az archiváláskor:", error);
    }
  };

  const handleDelete = async (chatId) => {
    if (!user) return;
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    try {
      const chatDocRef = doc(db, "chats", chatId);
      // Tároljuk a törlés időpontját is
      await updateDoc(chatDocRef, {
        deletedBy: arrayUnion(user.uid),
        [`deletedAt.${user.uid}`]: serverTimestamp() // Időpont amikor törölte
      });
    } catch (error) {
      console.error("Hiba a (soft) törléskor:", error);
    }
  };

  const handleNavigate = (chatId) => {
    router.push(`/chat/${chatId}`);
  };

  // Szűrt ismerősök lista
  const filteredFriends = searchTerm
    ? friendList.filter(friend => 
        friend.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Szűrt chatok lista - beszélgetések neve alapján
  const filteredChats = searchTerm && messageSearchResults.length === 0
    ? chats.filter(chat => 
        chat.otherUserName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : chats;

  // Check if user is Basic status - Basic users cannot access PM
  if (!loading && userData && userData.status === 'Basic') {
    return (
      <main className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 pb-40">
        <div className="max-w-md w-full text-center bg-white border-2 border-red-500 rounded-2xl p-8">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
          </svg>
          <h2 className="text-2xl font-bold text-[#111827] mb-4">Privát üzenetek letiltva</h2>
          <p className="text-[#374151] mb-6">
            {market === 'de'
              ? 'Nutzer mit Basic-Status haben keinen Zugriff auf private Nachrichten. Bitte warte auf die Freigabe fuer den Full-Tag-Status.'
              : 'Basic státuszú felhasználóknak nincs hozzáférése a privát üzenetekhez. Várj a jóváhagyásra Full Tag státuszhoz.'}
          </p>
        </div>
      </main>
    );
  }

  // Betöltés
  const pageLoading = loading || isFetchingChats || !userData || isFetchingFriends;
  if (pageLoading && !chats.length) { 
    return (
      <main className="min-h-screen bg-[#F9FAFB] flex items-center justify-center pb-40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-[#374151]">{market === 'de' ? 'Chats werden geladen...' : 'Beszélgetések betöltése...'}</p>
        </div>
      </main>
    );
  }

  // --- KÉPERNYŐ TARTALOM ---
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-[#F9FAFB] text-[#111827]'} pb-40`}>
      <main className="flex-grow w-full">
        <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
            {t('messagesTitle', market)}
          </h1>
        </div>
        
        {/* Auto-start loading overlay */}
        {autoStartingChat && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-purple-500 rounded-2xl p-8 shadow-2xl max-w-md mx-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <h3 className="text-2xl font-bold text-[#111827] mb-2 text-center">
                {market === 'de' ? 'Chat starten' : 'Beszélgetés indítása'}
              </h3>
              <p className="text-[#374151] text-center">
                {autoStartUserName ? `${autoStartUserName}...` : t('loading', market)}
              </p>
            </div>
          </div>
        )}
        
        {/* --- Univerzális kereső --- */}
        <div className="mb-6 px-4">
          <input
            type="text"
            placeholder={market === 'de' ? 'Suche...' : 'Keresés...'}
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className={`w-full p-4 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-[#E5E7EB] text-[#111827]'} border-2 rounded-2xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all`}
          />
        </div>

        {/* --- Keresési eredmények --- */}
        {searchTerm && (
          <div className={`mb-6 mx-4 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-[#E5E7EB]'} border-2 rounded-2xl overflow-hidden shadow-xl`}>
            
            {/* Ismerősök találatok */}
            {filteredFriends.length > 0 && (
              <>
                <h3 className={`p-4 text-sm font-semibold ${darkMode ? 'text-gray-400 border-gray-700' : 'text-[#6B7280] border-[#E5E7EB]'} border-b`}>
                  {market === 'de' ? 'Kontakte' : 'Ismerősök'}
                </h3>
                <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`} style={{ opacity: isCreatingChat ? 0.5 : 1 }}>
                  {filteredFriends.map(friend => (
                    <div
                      key={friend.id}
                      onClick={() => !isCreatingChat && handleStartChat(friend.id)}
                      className={`flex items-center p-4 cursor-pointer ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition duration-200`}
                    >
                      <Image 
                        src={friend.photoURL} 
                        alt={friend.name} 
                        width={40} 
                        height={40} 
                        className="rounded-full object-cover mr-3" 
                        unoptimized 
                      />
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{friend.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Üzenet találatok */}
            {messageSearchResults.length > 0 && (
              <>
                <h3 className={`p-4 text-sm font-semibold ${darkMode ? 'text-gray-400 border-gray-700' : 'text-[#6B7280] border-[#E5E7EB]'} border-b ${filteredFriends.length > 0 ? 'border-t' : ''}`}>
                  {market === 'de' ? 'Nachrichten' : 'Üzenetek'} ({messageSearchResults.length})
                </h3>
                <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {messageSearchResults.map((result, index) => (
                    <div
                      key={index}
                      onClick={() => router.push(`/chat/${result.chatId}?highlightMessage=${result.messageId}`)}
                      className={`p-4 cursor-pointer ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition duration-200`}
                    >
                      <div className="flex items-start gap-3">
                        <Image 
                          src={result.chatPhoto} 
                          alt={result.chatName} 
                          width={40} 
                          height={40} 
                          className="rounded-full object-cover" 
                          unoptimized 
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-1`}>{result.chatName}</p>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} line-clamp-2`}>
                            ...{result.context}...
                          </p>
                          {result.timestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {result.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} {result.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Nincs találat */}
            {filteredFriends.length === 0 && messageSearchResults.length === 0 && (
              <p className={`p-4 text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} text-center`}>{market === 'de' ? 'Kein Treffer.' : 'Nincs találat.'}</p>
            )}
          </div>
        )}

        {/* --- CHAT LISTA (törlés gombbal) --- */}
        {!searchTerm && filteredChats.length > 0 ? (
          <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} overflow-hidden`}>
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onNavigate={handleNavigate}
                  onReport={(userId, userName) => {
                    setReportTarget({ userId, userName });
                    setShowReportModal(true);
                  }}
                  onBlock={(userId, userName) => {
                    setBlockTarget({ userId, userName, isBlocked: false });
                    setShowBlockModal(true);
                  }}
                  isUnread={chat.isUnread}
                  darkMode={darkMode}
                  demandInfo={chat.demandInfo}
                  market={market}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-[#111827]'} p-8 text-center`}>
            <svg className={`w-16 h-16 ${darkMode ? 'text-gray-500' : 'text-gray-600'} mx-auto mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className={`${darkMode ? 'text-white' : 'text-[#111827]'} font-semibold text-lg mb-2`}>
              {market === 'de' ? 'Du hast keine aktiven Gespraeche' : 'Nincsenek aktív beszélgetéseid'}
            </p>
            <p className={`${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
              {market === 'de' ? 'Suche oben nach einem Kontakt, um einen Chat zu starten.' : 'Keress rá egy ismerősödre fentebb a chat indításához!'}
            </p> 
          </div>
        )}
        </div>
      </main>

      {/* Hamburger menü overlay és panel */}
      {isMenuOpen && (
        <>
          {/* Teljes képernyős menü panel */}
          <div className={`fixed inset-0 ${darkMode ? 'bg-gray-900' : 'bg-white'} z-50`}>
            {/* Menü fejléc */}
            <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Menue' : 'Menü'}</h2>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Profil - egyszerű megjelenítés kártya nélkül */}
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                {userData?.photoURL && (
                  <Image
                    src={userData.photoURL}
                    alt={userData.displayName || "Profil"}
                    width={48}
                    height={48}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                <div className="flex-1">
                  <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{userData?.displayName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó')}</p>
                </div>
              </div>
            </div>

            {/* Menüpontok */}
            <div className="p-4 space-y-2">
              {/* Beállítások */}
              <button
                onClick={() => {
                  router.push('/chat/settings');
                }}
                className={`w-full flex items-center gap-4 p-4 text-left ${darkMode ? 'text-white bg-gray-800 hover:bg-gray-700' : 'text-gray-900 bg-gray-100 hover:bg-gray-200'} rounded-xl transition-colors`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <span className="flex-1">{market === 'de' ? 'Einstellungen' : 'Beállítások'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/*Archivált üzenetek */}
              <button
                onClick={() => {
                  router.push('/chat/archive');
                }}
                className={`w-full flex items-center gap-4 p-4 text-left ${darkMode ? 'text-white bg-gray-800 hover:bg-gray-700' : 'text-gray-900 bg-gray-100 hover:bg-gray-200'} rounded-xl transition-colors`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
                <span className="flex-1">{market === 'de' ? 'Archivierte Nachrichten' : 'Archivált üzenetek'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Padding a bottom navbar-hoz */}
      <div className="h-20"></div>

      {/* Chat specifikus bottom navigation */}
      <ChatBottomNavigation 
        isVisible={true} 
        onMenuOpen={() => setIsMenuOpen(true)} 
      />

      {/* Jelentés modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTarget(null);
        }}
        reportType="user"
        reportedUserId={reportTarget?.userId}
        reportedUserName={reportTarget?.userName}
        itemId={null}
        itemContent={null}
      />

      {/* Letiltás modal */}
      <BlockUserModal
        isOpen={showBlockModal}
        onClose={() => {
          setShowBlockModal(false);
          setBlockTarget(null);
        }}
        targetUserId={blockTarget?.userId}
        targetUserName={blockTarget?.userName}
        isCurrentlyBlocked={blockTarget?.isBlocked || false}
        onBlockChange={() => {
          setShowBlockModal(false);
          setBlockTarget(null);
        }}
      />
    </div>
  );
}
