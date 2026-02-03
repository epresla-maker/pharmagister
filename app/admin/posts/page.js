"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Send } from 'lucide-react';

export default function AdminPostsPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [postText, setPostText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posts, setPosts] = useState([]);

  // Ellenőrizzük hogy admin-e
  useEffect(() => {
    if (user && userData && user.email !== 'epresla@icloud.com') {
      router.push('/');
    }
  }, [user, userData, router]);

  // Posztok betöltése
  useEffect(() => {
    const q = query(
      collection(db, 'serviceFeedPosts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!postText.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'serviceFeedPosts'), {
        userId: user.uid,
        text: postText,
        postType: 'adminPost',
        createdAt: serverTimestamp(),
        authorData: {
          displayName: userData?.displayName || 'Admin',
          photoURL: userData?.photoURL || null
        },
        comments: [],
        reactions: {}
      });

      setPostText('');
      alert('✅ Poszt sikeresen létrehozva!');
    } catch (error) {
      console.error('Error creating post:', error);
      alert('❌ Hiba történt a poszt létrehozásakor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId, postType, pharmaDemandId) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a posztot?')) return;

    try {
      // Poszt törlése a serviceFeedPosts-ból
      await deleteDoc(doc(db, 'serviceFeedPosts', postId));
      
      // Ha pharma demand volt, töröljük a pharmaDemands-ból is
      if (postType === 'pharmaDemand' && pharmaDemandId) {
        await deleteDoc(doc(db, 'pharmaDemands', pharmaDemandId));
      }
      
      alert('✅ Poszt törölve!');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('❌ Hiba történt a törlés során: ' + error.message);
    }
  };

  if (!user || user.email !== 'epresla@icloud.com') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin - Posztok kezelése</h1>
            <button
              onClick={() => router.push('/admin')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Vissza az Admin panelhez
            </button>
          </div>

          {/* Új poszt létrehozása */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Új poszt a hírfolyamba
              </label>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Írj egy posztot..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!postText.trim() || isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {isSubmitting ? 'Közzététel...' : 'Poszt közzététele'}
            </button>
          </form>
        </div>

        {/* Létező posztok listája */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Összes poszt ({posts.length})
          </h2>

          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Még nincs poszt</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.authorData?.photoURL || '/default-avatar.svg'}
                        alt={post.authorData?.displayName}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {post.authorData?.displayName || 'Névtelen'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {post.createdAt?.toDate().toLocaleString('hu-HU') || 'Most'}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {post.postType === 'pharmaDemand' ? '💊 Gyógyszertári igény' : 
                       post.postType === 'adminPost' ? '👑 Admin poszt' : post.postType}
                    </span>
                  </div>

                  {post.text && (
                    <p className="text-gray-900 mb-3 whitespace-pre-wrap">{post.text}</p>
                  )}

                  {post.postType === 'pharmaDemand' && (
                    <div className="bg-green-50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-700">
                        <strong>Gyógyszertár:</strong> {post.pharmacyName} - {post.pharmacyCity}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Pozíció:</strong> {post.positionLabel}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Dátum:</strong> {new Date(post.date).toLocaleDateString('hu-HU')}
                      </p>
                    </div>
                  )}

                  {/* Törlés gomb - minden poszt típusnál megjelenik */}
                  <button
                    onClick={() => handleDelete(post.id, post.postType, post.pharmaDemandId)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm mt-2"
                  >
                    <Trash2 size={16} />
                    Poszt törlése
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
