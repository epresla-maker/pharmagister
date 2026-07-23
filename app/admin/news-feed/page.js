"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { EyeOff } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';

const ADMIN_EMAILS = ['epresla@icloud.com'];

// Ugyanaz a szöveg-szűrés mint a useServiceFeed
function looksHungarianText(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return false;
  if (/[áéíóöőúüű]/.test(text)) return true;
  const huSignals = [
    'gyogyszer', 'helyettesites', 'helyettesitest', 'hiany', 'beosztas',
    'szakasszisztens', 'jelentkezes', 'patika', 'budapesten'
  ];
  return huSignals.some((signal) => text.includes(signal));
}

export default function NewsFeedPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin auth ellenőrzés
  useEffect(() => {
    if (user && userData && !ADMIN_EMAILS.includes(user.email)) {
      router.push('/');
    }
  }, [user, userData, router]);

  // Szűrés az ADMIN HÍRFOLYAMHOZ (teszt: AI posztok is látszanak, még pending-ek is)
  const filterPostsForAdminNewsFeed = useCallback((postsToFilter) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return postsToFilter.filter(post => {
      // Market szűrés
      if (!isDocInMarket(post, market)) {
        return false;
      }

      // reactionActivity kiszűrése
      if (post.postType === 'reactionActivity') return false;

      // Német piacon magyar szövegek kiszűrése
      if (market === 'de' && (post.postType === 'userPost' || post.postType === 'adminPost')) {
        if (looksHungarianText(post.text)) {
          return false;
        }
      }
      
      // Elfogadott/kitöltött igények kiszűrése
      if (post.status === 'accepted' || post.status === 'filled') return false;
      
      // Múltbeli igények kiszűrése
      if ((post.postType === 'pharmaDemand' || post.postType === 'tutoDemand' || post.postType === 'beautyDemand') && post.date) {
        if (post.date < todayStr) {
          return false;
        }
      }
      
      // ADMIN TESZT: AI posztok (pending + approved) is megjelennek
      // Az élő feedben csak approved AI posztok lennének, de itt minden látszik
      
      return true;
    });
  }, [market]);

  // Posztok betöltése
  useEffect(() => {
    const q = query(
      collection(db, 'serviceFeedPosts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPostsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Alkalmazzuk az ADMIN teszt szűréseit (AI posztok is látszanak)
      const filteredPosts = filterPostsForAdminNewsFeed(allPostsData);
      setPosts(filteredPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterPostsForAdminNewsFeed]);

  // Szűrjük az admin teszt logika szerint
  const filteredPosts = filterPostsForAdminNewsFeed(posts);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('hu-HU');
  };

  const getSourceBadge = (source) => {
    if (source === 'llm_auto_feed') {
      return <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">Auto (AI)</span>;
    }
    return <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Manuális</span>;
  };

  const getApprovalBadge = (approvalStatus) => {
    if (approvalStatus === 'approved') {
      return <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">✅ Jóváhagyva</span>;
    }
    return <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded">⏳ Jóváhagyásra vár</span>;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Hozzáférés megtagadva</h1>
          <p className="text-gray-600 mt-2">Nincs jogosultságod ezt az oldalt megtekinteni.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner border-4 border-gray-200 border-t-blue-500 rounded-full w-12 h-12 mx-auto animate-spin"></div>
          <p className="text-gray-600 mt-4">Posztok betöltése...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📰 Hírfolyam - Admin Nézet</h1>
          <p className="text-gray-600">Összes poszt áttekintése</p>
        </div>

        {/* Posztok listája */}
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">Nincsenek posztok a kiválasztott szűrőkhöz.</p>
            </div>
          ) : (
            filteredPosts.map(post => (
              <div key={post.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      {getSourceBadge(post.source)}
                      {getApprovalBadge(post.approvalStatus)}
                      {post.hidden && (
                        <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded items-center gap-1">
                          <EyeOff size={14} /> Rejtett
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      📅 {formatDate(post.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Poszt szövege */}
                <div className="mb-4">
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>
                </div>

                {/* Kép */}
                {post.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={post.imageUrl}
                      alt="Poszt kép"
                      className="max-w-xs rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Szerző info */}
                <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
                  <p><strong>Szerző:</strong> {post.authorName || post.authorEmail || 'Ismeretlen'}</p>
                  {post.source === 'llm_auto_feed' && (
                    <>
                      <p><strong>Típus:</strong> {post.promptType || 'N/A'}</p>
                      {post.generatedDateKey && <p><strong>Nap:</strong> {post.generatedDateKey}</p>}
                    </>
                  )}
                </div>

                {/* Link a poszthoz */}
                <div className="mt-4 text-right">
                  <a
                    href={`/admin/posts?postId=${post.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Szerkesztés →
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
