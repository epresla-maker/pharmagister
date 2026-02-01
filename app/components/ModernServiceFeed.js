'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useServiceFeed } from '@/hooks/useServiceFeed';
import { 
  collection, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  arrayUnion, 
  arrayRemove,
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  where,
  deleteField
} from 'firebase/firestore';
import { Star, MessageCircle, Share2, Send, MoreHorizontal, X, Heart, Laugh, Frown, Angry, Zap, Image as ImageIcon, ImagePlus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

const REACTIONS = [
  { type: 'like', emoji: '⭐', icon: Star, label: 'Tetszik', color: 'text-yellow-500' },
  { type: 'love', emoji: '❤️', icon: Heart, label: 'Imádom', color: 'text-red-500' },
  { type: 'haha', emoji: '😄', icon: Laugh, label: 'Haha', color: 'text-yellow-500' },
  { type: 'wow', emoji: '😮', icon: Zap, label: 'Wow', color: 'text-orange-500' },
  { type: 'sad', emoji: '😢', icon: Frown, label: 'Szomorú', color: 'text-gray-500' },
  { type: 'angry', emoji: '😠', icon: Angry, label: 'Dühös', color: 'text-red-600' }
];

export default function ModernServiceFeed() {
  // ✅ ÚJ: Optimalizált feed hook használata (onSnapshot helyett)
  const { user, userData } = useAuth();
  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    hasNewPosts,
    error,
    refresh,
    loadMore,
    updatePostLocally,
  } = useServiceFeed({ userData });

  // Lokális UI állapotok
  const [newPostText, setNewPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [showReactions, setShowReactions] = useState({});
  const [hoveredReaction, setHoveredReaction] = useState({}); // Melyik emoji van hover alatt
  const [lightboxImage, setLightboxImage] = useState(null); // Kép modal
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [selectedPostReactions, setSelectedPostReactions] = useState(null);
  
  // Pull to refresh - most már a hook refresh()-ét hívja
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshThreshold = 80;
  
  // Infinite scroll ref
  const loadMoreRef = useRef(null);
  
  const router = useRouter();
  const reactionTimeouts = useRef({});
  const reactionRefs = useRef({});
  const reactionPositions = useRef({}); // Bezier pozíciók tárolása
  const pickerContainerRefs = useRef({}); // Picker container ref-ek

  // ✅ ÚJ: Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadMoreRef.current);
    
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // Scroll letiltása amikor reakció picker látható
  useEffect(() => {
    const hasActiveReactions = Object.values(showReactions).some(val => val === true);
    
    if (hasActiveReactions) {
      // Letiltjuk a scroll-t
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.touchAction = 'none';
      
      // Globális touchmove esemény letiltása
      const preventScroll = (e) => {
        e.preventDefault();
      };
      document.addEventListener('touchmove', preventScroll, { passive: false });
      
      return () => {
        document.removeEventListener('touchmove', preventScroll);
      };
    } else {
      // Visszaállítjuk
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.touchAction = '';
    }
    
    // Cleanup
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.touchAction = '';
    };
  }, [showReactions]);

  // Pull to refresh kezelés - ✅ MOST MÁR A HOOK REFRESH()-ÉT HÍVJA
  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && !isRefreshing) {
        setPullStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e) => {
      if (pullStartY === 0 || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const distance = currentY - pullStartY;
      
      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(distance, refreshThreshold * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= refreshThreshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(0);
        
        // ✅ ÚJ: Hook refresh() használata az onSnapshot helyett
        await refresh();
        
        setTimeout(() => {
          setIsRefreshing(false);
        }, 500);
      } else {
        setPullDistance(0);
      }
      setPullStartY(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullStartY, pullDistance, isRefreshing, refresh]);

  // ✅ TÖRÖLT: Régi onSnapshot kód eltávolítva - mostantól useServiceFeed hook kezeli

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async () => {
    if ((!newPostText.trim() && !selectedImage) || !user) return;

    try {
      setUploading(true);
      let imageUrl = null;

      // Kép feltöltése Cloudinary-ra ha van
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        formData.append('userId', user.uid);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Képfeltöltés sikertelen');
        }

        imageUrl = data.url;
      }

      await addDoc(collection(db, 'serviceFeedPosts'), {
        postType: 'userPost',
        userId: user.uid,
        text: newPostText.trim(),
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        reactions: {},
        comments: [],
        shares: 0
      });
      
      setNewPostText('');
      removeImage();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Hiba történt a poszt létrehozása során: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReaction = async (postId, reactionType) => {
    if (!user) return;

    const postRef = doc(db, 'serviceFeedPosts', postId);
    const post = posts.find(p => p.id === postId);
    const reactions = post.reactions || {};
    // Reakciók el lettek távolítva
  };

  const getReactionSummary = (reactions) => {
    if (!reactions || Object.keys(reactions).length === 0) return null;
    
    const counts = {};
    Object.values(reactions).forEach(type => {
      if (type) counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
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

  // ✅ ÚJ: Loading state
  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // ✅ ÚJ: Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Hiba történt: {error}</p>
        <button
          onClick={refresh}
          className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
        >
          Újrapróbálás
        </button>
      </div>
    );
  }

  return (
    <div className="w-full divide-y-4 divide-double divide-gray-300 dark:divide-gray-600">

      {/* ✅ ÚJ: New Posts Banner */}
      {hasNewPosts && (
        <div
          onClick={refresh}
          className="sticky top-0 z-50 bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 px-4 text-center cursor-pointer hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
        >
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-semibold">Új bejegyzések érhetők el - Koppints a frissítéshez</span>
          </div>
        </div>
      )}

      {/* Pull to Refresh Loading Indicator */}
      {(isRefreshing || pullDistance > 0) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all duration-300"
          style={{ 
            paddingTop: `${Math.min(pullDistance, refreshThreshold) / 2}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / refreshThreshold, 1)
          }}
        >
          <div 
            className="rounded-lg shadow-lg flex items-center justify-center"
            style={{ 
              width: '80px', 
              height: '80px',
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
            }}
          >
            <div className="text-6xl">🎯</div>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Jelenleg nincsenek megjeleníthető posztok.</p>
        </div>
      ) : (
        posts.map((post) => {
          const reactionSummary = getReactionSummary(post.reactions);
          const userReaction = user && post.reactions?.[user.uid];
          const commentsCount = (post.comments || []).length;
          
          // Rekurzív válaszok számolása
          const countReplies = (comments) => {
            let count = 0;
            comments?.forEach(comment => {
              count += (comment.replies?.length || 0);
              if (comment.replies) {
                count += countReplies(comment.replies);
              }
            });
            return count;
          };
          const totalReplies = countReplies(post.comments);

          // Pharmagister poszt - speciális kezelés
          if (post.postType === 'pharmaDemand') {
            // Monogram generálás
            const getMonogram = (name) => {
              if (!name) return '?';
              const words = name.trim().split(' ');
              if (words.length >= 2) {
                return (words[0][0] + words[1][0]).toUpperCase();
              }
              return name.substring(0, 2).toUpperCase();
            };

            // Színek pozíció szerint - mint a naptárban
            const isPharmacist = post.position === 'pharmacist';
            const colorScheme = isPharmacist 
              ? {
                  gradient: 'from-blue-500 to-indigo-600',
                  gradientLight: 'from-blue-50 to-indigo-50',
                  gradientDark: 'from-blue-900/20 to-indigo-900/20',
                  border: 'border-blue-500',
                  bg: 'bg-blue-500',
                  bgHover: 'hover:bg-blue-600',
                  text: 'text-blue-600',
                  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                  icon: '�'
                }
              : {
                  gradient: 'from-emerald-500 to-teal-600',
                  gradientLight: 'from-emerald-50 to-teal-50',
                  gradientDark: 'from-emerald-900/20 to-teal-900/20',
                  border: 'border-emerald-500',
                  bg: 'bg-emerald-500',
                  bgHover: 'hover:bg-emerald-600',
                  text: 'text-emerald-600',
                  badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
                  icon: '💉'
                };

            return (
              <div key={post.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                {/* Színes felső csík */}
                <div className={`h-2 bg-gradient-to-r ${colorScheme.gradient}`}></div>
                
                {/* Header */}
                <div className={`p-4 bg-gradient-to-r ${colorScheme.gradientLight} dark:${colorScheme.gradientDark}`}>
                  <div className="flex items-center gap-3">
                    {/* Profilkép vagy monogram */}
                    <div className="relative">
                      {post.pharmacyPhotoURL ? (
                        <img 
                          src={post.pharmacyPhotoURL} 
                          alt={post.pharmacyName}
                          className={`w-14 h-14 rounded-xl object-cover border-2 ${colorScheme.border} shadow-sm`}
                        />
                      ) : (
                        <div className={`w-14 h-14 ${colorScheme.bg} rounded-xl flex items-center justify-center shadow-sm`}>
                          <span className="text-white font-bold text-xl">
                            {getMonogram(post.pharmacyName)}
                          </span>
                        </div>
                      )}
                      {/* Pozíció ikon */}
                      <div className="absolute -bottom-1 -right-1 text-lg bg-white dark:bg-gray-800 rounded-full w-7 h-7 flex items-center justify-center shadow-sm">
                        {colorScheme.icon}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">
                        {post.pharmacyName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">{post.pharmacyFullAddress || `${post.pharmacyZipCode || ''} ${post.pharmacyCity || ''}`}</span>
                      </p>
                    </div>
                    
                    {/* Pozíció badge */}
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${colorScheme.badge}`}>
                      {isPharmacist ? 'Gyógyszerész' : 'Szakasszisztens'}
                    </div>
                  </div>
                </div>

                {/* Fő tartalom */}
                <div className="p-4">
                  {/* Dátum kiemelt kártya */}
                  <div className={`flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r ${colorScheme.gradientLight} dark:${colorScheme.gradientDark} mb-4`}>
                    <div className={`w-14 h-14 ${colorScheme.bg} rounded-xl flex flex-col items-center justify-center text-white shadow-sm`}>
                      <span className="text-xs font-medium uppercase">
                        {new Date(post.date).toLocaleDateString('hu-HU', { month: 'short' })}
                      </span>
                      <span className="text-xl font-bold">
                        {new Date(post.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {new Date(post.date).toLocaleDateString('hu-HU', { weekday: 'long' })}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(post.date).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Részletek grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {post.workHours && (
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="text-lg">🕐</span>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Munkaidő</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{post.workHours}</p>
                        </div>
                      </div>
                    )}

                    {post.minExperience && (
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="text-lg">⭐</span>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tapasztalat</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{post.minExperience}</p>
                        </div>
                      </div>
                    )}

                    {post.maxHourlyRate && (
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="text-lg">💰</span>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Max. órabér</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{post.maxHourlyRate} Ft</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Szoftverek */}
                  {post.requiredSoftware && post.requiredSoftware.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                        <span>💻</span> Elvárt szoftverismeret
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {post.requiredSoftware.map((software, idx) => (
                          <span key={idx} className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorScheme.badge}`}>
                            {software}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Megjegyzés */}
                  {post.additionalRequirements && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-gray-300 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                        "{post.additionalRequirements}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Akció gomb */}
                <div className="p-4 pt-0">
                  <button
                    onClick={() => router.push(`/pharmagister/demand/${post.pharmaDemandId}`)}
                    className={`w-full ${colorScheme.bg} ${colorScheme.bgHover} text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md`}
                  >
                    <span>Részletek megtekintése</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          }

          // Activity post rendering - Facebook style
          if (post.postType === 'reactionActivity') {
            return (
              <div key={post.id} className="bg-white dark:bg-gray-800 py-3 px-3">
                <div className="flex gap-3">
                  <img
                    src={post.authorData?.photoURL || '/default-avatar.svg'}
                    alt="Author"
                    className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80"
                    onClick={() => post.userId && router.push(`/profile/${post.userId}`)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        className="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                        onClick={() => post.userId && router.push(`/profile/${post.userId}`)}
                      >
                        {post.authorData?.displayName || 'Névtelen'}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">
                        {post.reactionLabel || 'reagált'}
                      </span>
                      <span className="text-2xl">
                        {REACTIONS.find(r => r.type === post.reactionType)?.emoji || '👍'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatTime(post.createdAt)}</p>
                    
                    {/* Original post preview */}
                    {post.originalPostText && (
                      <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {post.originalPostText}
                        </p>
                        {post.originalPostImage && (
                          <img 
                            src={post.originalPostImage} 
                            alt="Post preview"
                            className="mt-2 rounded-lg w-full max-h-48 object-cover"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ✅ ÚJ: New Provider/Service Post Rendering
          if (post.postType === 'newProvider' || post.postType === 'providerWorkPost' || post.postType === 'availableSlot') {
            return (
              <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10">
                  <div className="flex items-center gap-3">
                    <img
                      src={post.authorData?.photoURL || '/default-avatar.svg'}
                      alt={post.authorData?.displayName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-cyan-400 cursor-pointer hover:opacity-80"
                      onClick={() => post.userId && router.push(`/profile/${post.userId}`)}
                    />
                    <div className="flex-1">
                      <h3 
                        className="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                        onClick={() => post.userId && router.push(`/profile/${post.userId}`)}
                      >
                        {post.authorData?.displayName || 'Névtelen'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {post.serviceCategory || 'Szolgáltató'}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        post.postType === 'newProvider' 
                          ? 'bg-cyan-500 text-white' 
                          : post.postType === 'availableSlot'
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {post.postType === 'newProvider' && '🎉 Új szolgáltató'}
                        {post.postType === 'providerWorkPost' && '📸 Munka'}
                        {post.postType === 'availableSlot' && '📅 Szabad időpont'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{formatTime(post.createdAt)}</p>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Text */}
                  {post.text && (
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap mb-3">{post.text}</p>
                  )}

                  {/* Service details for new provider */}
                  {post.postType === 'newProvider' && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 text-sm">Szolgáltatás</span>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{post.serviceName}</span>
                      </div>
                      {post.servicePrice && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Ár</span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{post.servicePrice} Ft</span>
                        </div>
                      )}
                      {post.serviceDuration && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Időtartam</span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{post.serviceDuration} perc</span>
                        </div>
                      )}
                      {post.serviceLocation && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Helyszín</span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{post.serviceLocation}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Available slot details */}
                  {post.postType === 'availableSlot' && post.slotDate && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 text-sm">📅 Dátum</span>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {new Date(post.slotDate).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' })}
                        </span>
                      </div>
                      {post.slotTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-sm">🕐 Időpont</span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{post.slotTime}</span>
                        </div>
                      )}
                      {post.serviceName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Szolgáltatás</span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{post.serviceName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Images */}
                  {post.serviceImages && post.serviceImages.length > 0 && (
                    <div className={`grid gap-2 ${post.serviceImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {post.serviceImages.slice(0, 4).map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Service image ${idx + 1}`}
                          className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                          onClick={() => setLightboxImage(img)}
                        />
                      ))}
                    </div>
                  )}
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt="Post image"
                      className="w-full object-cover max-h-96 rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setLightboxImage(post.imageUrl)}
                    />
                  )}
                </div>

                {/* Reaction Summary - csak hozzászólások */}
                {(commentsCount + totalReplies > 0) && (
                  <div className="px-4 pb-1.5 flex items-center text-sm text-gray-500">
                    <div className="flex-1 flex justify-end gap-3">
                      {commentsCount + totalReplies > 0 ? (
                        <span>{commentsCount + totalReplies} hozzászólás</span>
                      ) : (
                        <span>Nincs még hozzászólás</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="border-t border-gray-200 dark:border-gray-700 py-2 flex items-center justify-around px-4">
                  <button
                    onClick={() => router.push(`/post/${post.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  >
                    <MessageCircle size={16} />
                    <span className="text-sm">Hozzászólás</span>
                  </button>
                  {post.postType === 'availableSlot' && (
                    <button
                      onClick={() => router.push(`/szakember/${post.serviceId}?book=true`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium text-sm"
                    >
                      📅 Foglalás
                    </button>
                  )}
                </div>

                {/* Comments megjelenítése eltávolítva - mostmár külön oldalon */}
              </div>
            );
          }

          return (
            <div key={post.id} className="bg-white dark:bg-gray-800">
              {/* Post Header */}
              <div className="py-3 flex items-start justify-between px-3 sm:px-4">
                <div className="flex gap-3">
                  <img
                    src={post.authorData?.photoURL || '/default-avatar.svg'}
                    alt="Author"
                    className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80"
                    onClick={() => post.userId && router.push(`/profile/${post.userId}`)}
                  />
                  <div>
                    <h3 
                      className="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                      onClick={() => post.userId && router.push(`/profile/${post.userId}`)}
                    >
                      {post.authorData?.displayName || 'Névtelen'}
                    </h3>
                    <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              {/* Post Content */}
              <div className="pb-2">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap px-3 sm:px-4">{post.text || post.rssTitle}</p>
                {post.rssDescription && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 px-3 sm:px-4">{post.rssDescription}</p>
                )}
                {/* User uploaded image */}
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt="Post image"
                    className="w-full object-cover max-h-96 cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => setLightboxImage(post.imageUrl)}
                  />
                )}
                {/* RSS feed image */}
                {post.rssImageUrl && (
                  <img
                    src={post.rssImageUrl}
                    alt="Post image"
                    className="w-full object-cover max-h-96"
                  />
                )}
              </div>

              {/* Hozzászólások summary */}
              {(commentsCount + totalReplies > 0) && (
                <div className="pb-1.5 flex items-center text-sm text-gray-500 px-3 sm:px-4">
                  <div 
                    className="flex-1 flex justify-end gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors py-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/post/${post.id}`);
                    }}
                  >
                    {commentsCount + totalReplies > 0 ? (
                      <span>{commentsCount + totalReplies} hozzászólás</span>
                    ) : (
                      <span>Nincs még hozzászólás</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t border-gray-200 dark:border-gray-700 py-2 flex items-center justify-center">
                <button
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  <MessageCircle size={16} />
                  <span className="text-sm">Hozzászólás</span>
                </button>
              </div>

              {/* Comments megjelenítése eltávolítva - mostmár külön oldalon */}
            </div>
          );
        })
      )}

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

      {/* Reaction Modal */}
      {showReactionModal && selectedPostReactions && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowReactionModal(false);
            setSelectedPostReactions(null);
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reakciók ({selectedPostReactions.length})
              </h3>
              <button
                onClick={() => {
                  setShowReactionModal(false);
                  setSelectedPostReactions(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Reactions List */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
              {selectedPostReactions.map(({ userId, reactionType, userData }) => {
                const reaction = REACTIONS.find(r => r.type === reactionType);
                return (
                  <div
                    key={userId}
                    onClick={() => {
                      router.push(`/profile/${userId}`);
                      setShowReactionModal(false);
                      setSelectedPostReactions(null);
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <img
                      src={userData?.photoURL || '/default-avatar.svg'}
                      alt={userData?.displayName || 'Felhasználó'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {userData?.displayName || 'Névtelen'}
                      </p>
                      {userData?.profession && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {userData.profession}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl">
                      {reaction?.emoji}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ✅ ÚJ: Infinite Scroll Trigger */}
      <div ref={loadMoreRef} className="h-10">
        {loadingMore && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
          </div>
        )}
      </div>

      {/* ✅ ÚJ: End of Feed Message */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          🎉 Elérted a hírfolyam végét
        </div>
      )}
    </div>
  );
}
