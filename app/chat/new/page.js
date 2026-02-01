"use client";
import { useState, useRef, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import RouteGuard from '@/app/components/RouteGuard';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';

function NewChatContent() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef(null);

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
            [user.uid]: userData?.pharmacyName || userData?.displayName || 'Felhasználó',
            [recipientId]: recipientName || 'Felhasználó'
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
          relatedDemandPositionLabel: demandPositionLabel,
          archivedBy: [],
          deletedBy: []
        });
        chatId = newChatRef.id;
      }

      // Add first message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: userData?.pharmacyName || userData?.displayName || 'Felhasználó',
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        read: false
      });

      // Push notification küldése a címzettnek
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: recipientId,
            title: 'Új üzenet',
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
      alert('Hiba történt az üzenet küldése során.');
      setSending(false);
    }
  };

  return (
    <RouteGuard>
      <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-black' : 'bg-gray-100'}`}>
        {/* Header - same style as chat page */}
        <div className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 sticky top-0 z-10`}>
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
                  {recipientName || 'Felhasználó'}
                </h2>
                {demandDate && (
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {demandPositionLabel} • {new Date(demandDate).toLocaleDateString('hu-HU')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">💬</div>
            <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Új beszélgetés
            </h3>
            <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Írj egy üzenetet, hogy elindítsd a beszélgetést {recipientName || 'a felhasználóval'}.
            </p>
          </div>
        </div>

        {/* Message input - same style as chat page */}
        <div className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-t px-4 py-4 fixed bottom-0 left-0 right-0`}>
          <div className="max-w-4xl mx-auto flex gap-2 items-end">
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !sending && handleSendMessage()}
              placeholder="Írj üzenetet..."
              className={`flex-1 px-4 py-3 rounded-3xl border focus:outline-none focus:border-cyan-500 ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                  : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              disabled={sending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold p-3 rounded-full transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Send className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
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
