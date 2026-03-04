"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import RouteGuard from '@/app/components/RouteGuard';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  limit,
  startAfter,
  where
} from 'firebase/firestore';
import { Star, Send, MoreHorizontal, X, Heart, Laugh, Frown, Angry, Zap, ImagePlus, RefreshCw, Trash2, Edit3 } from 'lucide-react';

const PAGE_SIZE = 20;

function AllandoKeresContent() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();

  // Posts state
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef(null);

  // Post editor state
  const [showPostEditor, setShowPostEditor] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [postStyle, setPostStyle] = useState({
    backgroundColor: '#ffffff',
    textColor: '#000000',
    fontSize: 16,
    fontFamily: 'default'
  });

  // Edit/Delete state
  const [openMenuPostId, setOpenMenuPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleting, setDeleting] = useState(null);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState(null);

  // Infinite scroll ref
  const loadMoreRef = useRef(null);

  // Scroll hide navbar
  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Fetch posts from 'allandoKeresPosts' collection
  const fetchPosts = useCallback(async (afterDoc = null) => {
    try {
      let q;
      if (afterDoc) {
        q = query(
          collection(db, 'allandoKeresPosts'),
          orderBy('createdAt', 'desc'),
          startAfter(afterDoc),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, 'allandoKeresPosts'),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);
      const newPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      if (afterDoc) {
        setPosts(prev => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }

      setHasMore(snapshot.docs.length >= PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching állandóra keres posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          fetchPosts(lastDocRef.current);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchPosts]);

  // Menu close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuPostId && !e.target.closest('.relative')) {
        setOpenMenuPostId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuPostId]);

  // Lock scroll when editor is open
  useEffect(() => {
    if (showPostEditor) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.documentElement.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.documentElement.style.overflow = '';
    };
  }, [showPostEditor]);

  // Scroll handler for navbar hide
  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY < lastScrollY.current) {
            setShowNavbar(true);
          } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
            setShowNavbar(false);
          }
          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Image handling
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Create post
  const handleCreatePost = async () => {
    if ((!newPostText.trim() && !selectedImage) || !user) return;

    try {
      setUploading(true);
      let imageUrl = null;

      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        formData.append('userId', user.uid);

        const idToken = await user.getIdToken();
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Képfeltöltés sikertelen');
        imageUrl = data.url;
      }

      await addDoc(collection(db, 'allandoKeresPosts'), {
        postType: 'allandoKeres',
        userId: user.uid,
        text: newPostText.trim(),
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        authorData: {
          displayName: userData?.displayName || user?.displayName || 'Névtelen',
          photoURL: userData?.photoURL || user?.photoURL || null
        },
        pharmaRole: userData?.pharmagisterRole || null,
        style: postStyle.backgroundColor !== '#ffffff' || postStyle.textColor !== '#000000' || postStyle.fontSize !== 16 || postStyle.fontFamily !== 'default'
          ? postStyle
          : null,
        reactions: {},
        comments: [],
      });

      setNewPostText('');
      removeImage();
      setShowPostEditor(false);
      setPostStyle({
        backgroundColor: '#ffffff',
        textColor: '#000000',
        fontSize: 16,
        fontFamily: 'default'
      });

      // Refresh
      lastDocRef.current = null;
      setLoading(true);
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Hiba történt a bejegyzés létrehozása során: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Delete post
  const handleDeletePost = async (postId) => {
    if (!user || !window.confirm('Biztosan törölni szeretnéd ezt a bejegyzést?')) return;

    setDeleting(postId);
    try {
      await deleteDoc(doc(db, 'allandoKeresPosts', postId));
      setOpenMenuPostId(null);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Hiba történt a bejegyzés törlése során.');
    } finally {
      setDeleting(null);
    }
  };

  // Edit post
  const handleSaveEdit = async () => {
    if (!editingPost || !editText.trim()) return;

    try {
      await updateDoc(doc(db, 'allandoKeresPosts', editingPost), {
        text: editText.trim(),
        editedAt: serverTimestamp()
      });
      setPosts(prev => prev.map(p => p.id === editingPost ? { ...p, text: editText.trim(), editedAt: new Date() } : p));
      setEditingPost(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing post:', error);
      alert('Hiba történt a bejegyzés szerkesztése során.');
    }
  };

  const startEditing = (post) => {
    setEditingPost(post.id);
    setEditText(post.text || '');
    setOpenMenuPostId(null);
  };

  const cancelEditing = () => {
    setEditingPost(null);
    setEditText('');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'most';
    if (diff < 3600) return `${Math.floor(diff / 60)} perce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} órája`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} napja`;
    return date.toLocaleDateString('hu-HU');
  };

  // Loading state
  if (loading && posts.length === 0) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} pb-24`}>
        {/* Header */}
        <div className={`sticky top-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b z-10 shadow-sm pt-safe-small`}>
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between min-h-[56px] relative">
            {/* Vissza gomb */}
            <button
              onClick={() => router.push('/pharmagister')}
              className="text-purple-600 font-medium flex items-center gap-1 z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              vissza
            </button>

            {/* Cím - középre */}
            <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-purple-600 whitespace-nowrap">
              Állást keres
            </h1>

            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-xl mx-auto">
          {/* Poszt létrehozása mező */}
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-3 border-b`}>
            <div className="flex items-center gap-3">
              {/* Profilkép */}
              <div
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-green-500 flex-shrink-0 cursor-pointer"
                onClick={() => user && router.push(`/profil/${user.uid}`)}
              >
                {userData?.photoURL ? (
                  <img
                    src={userData.photoURL}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                    {userData?.displayName?.[0] || 'P'}
                  </div>
                )}
              </div>

              {/* Input mező */}
              <div
                className="flex-1 relative cursor-pointer"
                onClick={() => setShowPostEditor(true)}
              >
                <div className={`w-full px-4 py-2.5 ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'} rounded-full text-sm`}>
                  Írj valamit...
                </div>
              </div>
            </div>
          </div>

          {/* Poszt szerkesztő modal */}
          {showPostEditor && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 overflow-hidden"
              style={{ touchAction: 'none' }}
            >
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} w-full sm:max-w-lg sm:rounded-xl rounded-xl mx-2 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button
                    onClick={() => {
                      setShowPostEditor(false);
                      setNewPostText('');
                      setPostStyle({ backgroundColor: '#ffffff', textColor: '#000000', fontSize: 16, fontFamily: 'default' });
                    }}
                    className={`${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <X size={24} />
                  </button>
                  <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Állást keres</h2>
                  <button
                    onClick={handleCreatePost}
                    disabled={!newPostText.trim() || uploading}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Küldés...' : 'Közzététel'}
                  </button>
                </div>

                {/* Szerkesztő */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div
                    className="min-h-[120px] p-4 rounded-xl mb-4 transition-all"
                    style={{
                      backgroundColor: postStyle.backgroundColor,
                      color: postStyle.textColor,
                      fontSize: `${postStyle.fontSize}px`,
                      fontFamily: postStyle.fontFamily === 'default' ? 'inherit'
                        : postStyle.fontFamily === 'serif' ? 'Georgia, serif'
                        : postStyle.fontFamily === 'mono' ? 'monospace'
                        : postStyle.fontFamily === 'cursive' ? 'cursive'
                        : 'inherit'
                    }}
                  >
                    <textarea
                      value={newPostText}
                      onChange={(e) => setNewPostText(e.target.value)}
                      placeholder="Írd le, kit keresel állandó munkaviszonyra..."
                      className="w-full h-full min-h-[100px] bg-transparent resize-none focus:outline-none placeholder-current opacity-50"
                      style={{
                        color: postStyle.textColor,
                        fontSize: `${postStyle.fontSize}px`,
                        fontFamily: postStyle.fontFamily === 'default' ? 'inherit'
                          : postStyle.fontFamily === 'serif' ? 'Georgia, serif'
                          : postStyle.fontFamily === 'mono' ? 'monospace'
                          : postStyle.fontFamily === 'cursive' ? 'cursive'
                          : 'inherit'
                      }}
                      autoFocus
                    />
                  </div>

                  {/* Kép előnézet */}
                  {imagePreview && (
                    <div className="relative mb-4">
                      <img src={imagePreview} alt="Preview" className="w-full rounded-lg max-h-48 object-cover" />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Kép feltöltés gomb */}
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
                    >
                      <ImagePlus size={18} />
                      <span className="text-sm">Kép</span>
                    </button>
                  </div>

                  {/* Stílus beállítások */}
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Háttérszín</label>
                      <div className="flex flex-wrap gap-2">
                        {['#ffffff', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#f3e8ff', '#fee2e2', '#1f2937', '#7c3aed', '#059669'].map(color => (
                          <button
                            key={color}
                            onClick={() => setPostStyle(prev => ({
                              ...prev,
                              backgroundColor: color,
                              textColor: color === '#1f2937' ? '#ffffff' : prev.textColor === '#ffffff' && color !== '#1f2937' ? '#000000' : prev.textColor
                            }))}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${postStyle.backgroundColor === color ? 'border-purple-500 scale-110' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Szövegszín</label>
                      <div className="flex flex-wrap gap-2">
                        {['#000000', '#374151', '#dc2626', '#059669', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ffffff'].map(color => (
                          <button
                            key={color}
                            onClick={() => setPostStyle(prev => ({ ...prev, textColor: color }))}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${postStyle.textColor === color ? 'border-purple-500 scale-110' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Betűtípus</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'default', label: 'Alap' },
                          { value: 'serif', label: 'Serif' },
                          { value: 'mono', label: 'Mono' },
                          { value: 'cursive', label: 'Kézírásos' }
                        ].map(font => (
                          <button
                            key={font.value}
                            onClick={() => setPostStyle(prev => ({ ...prev, fontFamily: font.value }))}
                            className={`px-3 py-1.5 rounded-lg border transition-all ${postStyle.fontFamily === font.value ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-gray-300 dark:border-gray-600'}`}
                            style={{
                              fontFamily: font.value === 'default' ? 'inherit'
                                : font.value === 'serif' ? 'Georgia, serif'
                                : font.value === 'mono' ? 'monospace'
                                : 'cursive'
                            }}
                          >
                            {font.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Posts Feed */}
          <div className={`w-full divide-y-4 divide-double ${darkMode ? 'divide-gray-600' : 'divide-gray-300'}`}>
            {posts.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-12 text-center`}>
                <div className="text-4xl mb-4">📋</div>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Még nincsenek bejegyzések.</p>
              </div>
            ) : (
              posts.map((post) => {
                return (
                  <div key={post.id} className={`${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    {/* Post Header */}
                    <div className="py-3 flex items-start justify-between px-3 sm:px-4">
                      <div className="flex gap-3">
                        <img
                          src={post.authorData?.photoURL || '/default-avatar.svg'}
                          alt="Author"
                          className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80"
                          onClick={() => post.userId && router.push(`/profil/${post.userId}`)}
                        />
                        <div>
                          <h3
                            className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} hover:underline cursor-pointer`}
                            onClick={() => post.userId && router.push(`/profil/${post.userId}`)}
                          >
                            {post.authorData?.displayName || 'Névtelen'}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                            {post.editedAt && <span className="text-xs text-gray-400">(szerkesztve)</span>}
                            {post.pharmaRole && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                post.pharmaRole === 'pharmacy' 
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' 
                                  : post.pharmaRole === 'pharmacist'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              }`}>
                                {post.pharmaRole === 'pharmacy' ? 'Gyógyszertár' : post.pharmaRole === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Menü - csak saját posztokhoz */}
                      {user && post.userId === user.uid && (
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                            className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                          >
                            <MoreHorizontal size={20} className="text-gray-500" />
                          </button>

                          {openMenuPostId === post.id && (
                            <div className={`absolute right-0 top-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-lg border py-1 z-50 min-w-[150px]`}>
                              <button
                                onClick={() => startEditing(post)}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                              >
                                <Edit3 size={16} />
                                <span>Szerkesztés</span>
                              </button>
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                disabled={deleting === post.id}
                                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                              >
                                {deleting === post.id ? (
                                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                                <span>Törlés</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Post Content */}
                    <div className="pb-2">
                      {editingPost === post.id ? (
                        <div className="px-3 sm:px-4">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className={`w-full p-3 border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} rounded-lg resize-none focus:ring-2 focus:ring-purple-500 outline-none`}
                            rows={4}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={cancelEditing}
                              className={`px-4 py-2 ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} rounded-lg`}
                            >
                              Mégse
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!editText.trim()}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                            >
                              Mentés
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {post.style ? (
                            <div
                              className="mx-3 sm:mx-4 p-4 rounded-xl whitespace-pre-wrap"
                              style={{
                                backgroundColor: post.style.backgroundColor || '#ffffff',
                                color: post.style.textColor || '#000000',
                                fontSize: `${post.style.fontSize || 16}px`,
                                fontFamily: post.style.fontFamily === 'serif' ? 'Georgia, serif'
                                  : post.style.fontFamily === 'mono' ? 'monospace'
                                  : post.style.fontFamily === 'cursive' ? 'cursive'
                                  : 'inherit'
                              }}
                            >
                              {post.text}
                            </div>
                          ) : (
                            <p className={`${darkMode ? 'text-white' : 'text-gray-900'} whitespace-pre-wrap px-3 sm:px-4`}>{post.text}</p>
                          )}
                        </>
                      )}
                      {/* Image */}
                      {post.imageUrl && (
                        <div className="relative w-full mt-2" style={{ maxHeight: '384px' }}>
                          <img
                            src={post.imageUrl}
                            alt="Post image"
                            className="w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            style={{ maxHeight: '384px' }}
                            onClick={() => setLightboxImage(post.imageUrl)}
                          />
                        </div>
                      )}
                    </div>


                  </div>
                );
              })
            )}
          </div>

          {/* Infinite Scroll Trigger */}
          <div ref={loadMoreRef} className="h-10">
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
              </div>
            )}
          </div>

          {!hasMore && posts.length > 0 && (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Elérted a bejegyzések végét
            </div>
          )}
        </div>

        {/* Image Lightbox Modal */}
        {lightboxImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

export default function AllandoKeresPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      </div>
    }>
      <AllandoKeresContent />
    </Suspense>
  );
}
