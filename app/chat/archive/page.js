// app/chat/archive/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getClientMarket } from '@/lib/marketI18n';
import ChatBottomNavigation from "../../components/ChatBottomNavigation";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc, // <- Új
  arrayRemove, // <- Új
} from "firebase/firestore";

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
async function getChatPartnerDetails(chats, currentUserId, market) {
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
          : (data.displayName || (market === 'de' ? 'Unbekannt' : 'Ismeretlen'));
        const photoURL = data.pharmaPhotoURL || data.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${name.replace(/\s/g, '%20')}`;
        partnerDataMap.set(id, { name, photoURL });
      }
    } catch (error) {
      console.error("Hiba a partner adatainak lekérésekor:", error);
      partnerDataMap.set(id, { name: market === 'de' ? 'Unbekannt' : 'Ismeretlen', photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=${market === 'de' ? 'Unbekannt' : 'Ismeretlen'}` });
    }
  }
  return partnerDataMap;
}


export default function ArchivePage() {
  const { user, userData, loading } = useAuth();
  const market = getClientMarket();
  const router = useRouter();
  
  const [archivedChats, setArchivedChats] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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

  // --- useEffect: Csak az archivált beszélgetések figyelése ---
  useEffect(() => {
    if (loading || !user) return;

    // ----- EZ A LEKÉRDEZÉS VÁLTOZOTT -----
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid),
      // EZ A LÉNYEG: Csak azokat mutatjuk, amiket ÉN archiváltam
      where("archivedBy", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );
    // -------------------------------------

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setIsFetching(true);
      const rawChats = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      const partnerDetailsMap = await getChatPartnerDetails(rawChats, user.uid, market);

      const chatList = rawChats.map(chat => {
        const otherUserId = chat.members.find(id => id !== user.uid);
        const partner = partnerDetailsMap.get(otherUserId) || 
                        { name: market === 'de' ? 'Unbekannt' : 'Ismeretlen', photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=${market === 'de' ? 'Unbekannt' : 'Ismeretlen'}` };
        
        let lastMessagePreview = chat.lastMessage;
        if (chat.lastMessageSenderId === user.uid) {
          lastMessagePreview = `${market === 'de' ? 'Du' : 'Te'}: ${chat.lastMessage}`;
        }

        return {
          id: chat.id,
          otherUserName: partner.name,
          otherUserPhotoURL: partner.photoURL,
          lastMessage: lastMessagePreview,
          lastMessageAt: chat.lastMessageAt?.toDate(),
        };
      });
      
      setArchivedChats(chatList);
      setIsFetching(false);
    }, (error) => {
      console.error("Hiba az archivált chatek figyelésekor:", error);
      setIsFetching(false);
    });

    return () => unsubscribe();
  }, [user, loading, market]);

  // --- ÚJ FUNKCIÓ: Visszaállítás (Un-archive) ---
  const handleUnarchive = async (chatId) => {
    if (!user) return;
    
    // Optimista UI: azonnal eltávolítjuk a listáról
    setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));

    try {
      const chatDocRef = doc(db, "chats", chatId);
      await updateDoc(chatDocRef, {
        archivedBy: arrayRemove(user.uid) // Eltávolítjuk az UID-t a tömbből
      });
    } catch (error) {
      console.error("Hiba a visszaállításkor:", error);
      // Hiba esetén vissza kellene tölteni a listát, de ez most egyszerűsítve van
    }
  };

  // Betöltés
  if (loading || isFetching || !userData) {
    return (
      <main className={`min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'} flex items-center justify-center pb-40`}>
        <p className="text-xl">{market === 'de' ? 'Archiv wird geladen...' : 'Archívum betöltése...'}</p>
      </main>
    );
  }

  // --- KÉPERNYŐ TARTALOM ---
  return (
    <main className={`min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'} p-4 pb-40`}>
      <div className="max-w-md mx-auto">
        
        {/* --- FEJLÉC --- */}
        <div className="flex items-center mb-4 pt-2">
          <button
            onClick={() => router.push("/chat")} // Vissza a fő chat listára
            className={`${darkMode ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-500'} transition duration-200 p-1`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className={`text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-800'} ml-2`}>
            {market === 'de' ? 'Archiv' : 'Archívum'}
          </h1>
        </div>

        {/* --- MEGLÉVŐ: Aktív beszélgetések --- */}
        <h2 className={`text-lg font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>{market === 'de' ? 'Archivierte Unterhaltungen' : 'Archivált beszélgetések'}</h2>
        
        {archivedChats.length > 0 ? (
          <div className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg border overflow-hidden`}>
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {archivedChats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center p-4 transition duration-200"
                >
                  <Image
                    src={chat.otherUserPhotoURL}
                    alt={chat.otherUserName}
                    width={50}
                    height={50}
                    className="rounded-full object-cover mr-4"
                    unoptimized
                  />
                  <div 
                    onClick={() => router.push(`/chat/${chat.id}`)} // A chat továbbra is megnyitható
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} truncate`}>{chat.otherUserName}</h2>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm truncate`}>{chat.lastMessage}</p>
                  </div>
                  {/* Visszaállítás gomb */}
                  <button
                    onClick={() => handleUnarchive(chat.id)}
                    className={`ml-4 ${darkMode ? 'bg-cyan-900 text-cyan-300 hover:bg-cyan-800' : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'} text-xs font-semibold py-1 px-3 rounded-full`}
                    title={market === 'de' ? 'Wiederherstellen' : 'Visszaállítás'}
                  >
                    {market === 'de' ? 'Zurueck' : 'Vissza'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-6 rounded-xl shadow-lg border text-center`}>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{market === 'de' ? 'Dein Archiv ist leer.' : 'Az archívumod üres.'}</p>
          </div>
        )}
      </div>

      {/* Bottom padding for safe area */}
      <div className="h-20"></div>

      {/* Chat specifikus bottom navigation */}
      <ChatBottomNavigation 
        isVisible={true} 
        onMenuOpen={() => router.push('/chat')} 
      />
    </main>
  );
}
