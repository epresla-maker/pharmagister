"use client";
import { useState, useRef, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import RouteGuard from '@/app/components/RouteGuard';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { getClientMarket, getLocalizedDemandPositionLabel } from '@/lib/marketI18n';
import ChatComposer from '@/app/components/chat/ChatComposer';

function NewChatContent() {
  const { user, userData } = useAuth();
  const market = getClientMarket();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const recipientId = searchParams.get('recipientId');
  const recipientName = searchParams.get('recipientName');
  const recipientPhoto = searchParams.get('recipientPhoto');
  const demandId = searchParams.get('demandId');
  const demandDate = searchParams.get('demandDate');
  const demandPosition = searchParams.get('demandPosition');
  const demandPositionLabel = searchParams.get('demandPositionLabel');
  const localizedDemandPositionLabel = getLocalizedDemandPositionLabel(demandPosition, market, demandPositionLabel);

  // Load dark mode setting
  useEffect(() => {
    if (!user) return;
    const loadDarkMode = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const isDark = userDoc.data().chatSettings?.darkMode ?? true;
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
    document.body.style.backgroundColor = darkMode ? '#000000' : '';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [darkMode]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;

    setSending(true);
    try {
      // Check if chat already exists
      const chatsRef = collection(db, 'chats');
      const existingChatQuery = query(
        chatsRef,
        where('members', 'array-contains', user.uid)
      );
      const existingChats = await getDocs(existingChatQuery);
      
      let chatId = null;
      existingChats.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        if (chatData.members.includes(recipientId) && chatData.relatedDemandId === demandId) {
          chatId = chatDoc.id;
        }
      });

      // Create new chat if doesn't exist
      if (!chatId) {
        const newChatRef = await addDoc(chatsRef, {
          members: [user.uid, recipientId],
          memberNames: {
            [user.uid]: userData?.pharmacyName || userData?.displayName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó'),
            [recipientId]: recipientName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó')
          },
          memberPhotos: {
            [user.uid]: userData?.pharmaPhotoURL || userData?.photoURL || null,
            [recipientId]: recipientPhoto || null
          },
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: messageText.trim(),
          relatedDemandId: demandId,
          relatedDemandDate: demandDate,
          relatedDemandPosition: demandPosition,
          relatedDemandPositionLabel: localizedDemandPositionLabel,
          archivedBy: [],
          deletedBy: []
        });
        chatId = newChatRef.id;
      }

      // Add first message (same schema as /chat/[chatId])
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: userData?.pharmacyName || userData?.displayName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó'),
        text: messageText.trim(),
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        readBy: [user.uid],
        read: false
      });

      // Ensure chat list visibility and unread logic are updated consistently
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: messageText.trim(),
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        readBy: [user.uid],
        deletedBy: arrayRemove(user.uid),
        archivedBy: arrayRemove(user.uid)
      });

      // Push notification küldése a címzettnek
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            userId: recipientId,
            title: market === 'de' ? 'Neue Nachricht' : 'Új üzenet',
            body: messageText.trim().length > 100 ? messageText.trim().substring(0, 100) + '...' : messageText.trim(),
            url: `/chat/${chatId}`,
            tag: `chat-${chatId}`
          })
        });
      } catch (pushError) {
        console.log('Push notification failed (non-critical):', pushError);
      }

      // Navigate to the new chat
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error creating chat:', error);
      alert(market === 'de' ? 'Fehler beim Senden der Nachricht.' : 'Hiba történt az üzenet küldése során.');
      setSending(false);
    }
  };

  return (
    <RouteGuard>
      <div className={`min-h-[100dvh] flex flex-col overflow-hidden ${darkMode ? 'bg-black' : 'bg-gray-100'}`}>
        {/* Header - same style as chat page */}
        <div className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 sticky top-0 z-10 pt-safe-small`}>
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 flex-1">
              {recipientPhoto ? (
                <img
                  src={recipientPhoto}
                  alt={recipientName}
                  className={`w-10 h-10 rounded-full object-cover border-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                  <span className={`text-lg ${darkMode ? 'text-white' : 'text-gray-700'}`}>{recipientName?.charAt(0) || '?'}</span>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h2 className={`font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {recipientName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó')}
                </h2>
                {demandDate && (
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {localizedDemandPositionLabel} • {new Date(demandDate).toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-40">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">💬</div>
            <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? 'Neue Unterhaltung' : 'Új beszélgetés'}
            </h3>
            <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {market === 'de'
                ? <>Schreibe eine Nachricht, um die Unterhaltung mit {recipientName || 'dem Benutzer'} zu starten.</>
                : <>Írj egy üzenetet, hogy elindítsd a beszélgetést {recipientName || 'a felhasználóval'}.</>}
            </p>
          </div>
        </div>

        <ChatComposer
          value={messageText}
          onChange={setMessageText}
          onSubmit={handleSendMessage}
          darkMode={darkMode}
          market={market}
          placeholder={market === 'de' ? 'Nachricht schreiben...' : 'Írj üzenetet...'}
          sending={sending}
        />
      </div>
    </RouteGuard>
  );
}

export default function NewChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <NewChatContent />
    </Suspense>
  );
}
