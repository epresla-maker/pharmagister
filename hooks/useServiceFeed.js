// hooks/useServiceFeed.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  where,
  getDocsFromCache,
  getDocsFromServer
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 30000; // 30 seconds

/**
 * Optimized Service Feed Hook
 * - Paginated fetching with getDocs()
 * - Firestore NATIVE cache (no IndexedDB needed - faster!)
 * - Cache-first strategy for instant loading
 * - Background polling for new posts
 * - Module-based filtering (pharmagister, tutomagister, etc.)
 * - NO real-time onSnapshot listeners
 */
export function useServiceFeed({ userData }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [error, setError] = useState(null);
  
  const lastDocRef = useRef(null);
  const newestTimestampRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Get user's accessible modules
  const getUserModules = useCallback(() => {
    const modules = [];
    if (userData?.pharmagisterRole) modules.push('pharmagister');
    if (userData?.tutomagisterRole) modules.push('tutomagister');
    if (userData?.beautyRole) modules.push('beauty');
    return modules;
  }, [userData]);

  // Filter posts by user's accessible modules
  const filterPostsByModule = useCallback((postsToFilter) => {
    const userModules = getUserModules();
    
    // Mai dátum a múltbeli igények szűréséhez (lokális időzóna!)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return postsToFilter.filter(post => {
      // Filter out reactionActivity posts
      if (post.postType === 'reactionActivity') return false;
      
      // Filter out accepted/filled demands - they should not appear in the feed
      if (post.status === 'accepted' || post.status === 'filled') return false;
      
      // Szűrjük ki a múltbeli dátumú igényeket (pharmaDemand, tutoDemand, beautyDemand)
      if ((post.postType === 'pharmaDemand' || post.postType === 'tutoDemand' || post.postType === 'beautyDemand') && post.date) {
        if (post.date < todayStr) {
          return false; // Múltbeli igényt kiszűrjük
        }
      }
      
      // Module-specific posts
      if (post.module) {
        return userModules.includes(post.module);
      }
      
      // Post type based filtering
      if (post.postType === 'pharmaDemand') return userModules.includes('pharmagister');
      if (post.postType === 'tutoDemand') return userModules.includes('tutomagister');
      if (post.postType === 'beautyDemand') return userModules.includes('beauty');
      
      // New provider and service posts are visible to everyone
      if (post.postType === 'newProvider' || post.postType === 'providerWorkPost' || post.postType === 'availableSlot') return true;
      
      // General user posts are visible to everyone
      if (post.postType === 'userPost' && !post.module) return true;
      
      // Default: visible
      return true;
    });
  }, [getUserModules]);

  // Fetch posts - Cache first, then server
  const fetchPosts = useCallback(async (isInitial = true) => {
    if (!isMountedRef.current) return;
    
    try {
      if (isInitial) {
        setLoading(true);
        lastDocRef.current = null;
      } else {
        setLoadingMore(true);
      }

      // Build query
      let q = query(
        collection(db, 'serviceFeedPosts'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (!isInitial && lastDocRef.current) {
        q = query(
          collection(db, 'serviceFeedPosts'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocRef.current),
          limit(PAGE_SIZE)
        );
      }

      let snapshot;
      
      // Cache-first strategy for initial load
      if (isInitial) {
        try {
          // Try Firestore native cache first for instant display
          snapshot = await getDocsFromCache(q);
          
          if (snapshot.empty) {
            // No cache, fetch from server
            snapshot = await getDocsFromServer(q);
          } else {
            // Show cached data immediately
            const cachedPosts = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data(),
              _doc: docSnap,
            }));
            
            const filteredPosts = filterPostsByModule(cachedPosts);
            
            if (isMountedRef.current) {
              setPosts(filteredPosts);
              setLoading(false);
              
              if (cachedPosts.length > 0 && cachedPosts[0].createdAt) {
                newestTimestampRef.current = cachedPosts[0].createdAt;
              }
              lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
              setHasMore(snapshot.docs.length === PAGE_SIZE);
            }
            
            // Background refresh from server (non-blocking)
            getDocsFromServer(q).then(serverSnapshot => {
              if (!isMountedRef.current) return;
              
              const serverPosts = serverSnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
                _doc: docSnap,
              }));
              
              const serverFiltered = filterPostsByModule(serverPosts);
              setPosts(serverFiltered);
              
              if (serverPosts.length > 0 && serverPosts[0].createdAt) {
                newestTimestampRef.current = serverPosts[0].createdAt;
              }
              lastDocRef.current = serverSnapshot.docs[serverSnapshot.docs.length - 1] || null;
              setHasMore(serverSnapshot.docs.length === PAGE_SIZE);
            }).catch(err => {
              console.warn('[useServiceFeed] Background refresh failed:', err);
            });
            
            return;
          }
        } catch (cacheError) {
          // Cache miss, fetch from server
          console.log('[useServiceFeed] Cache miss, fetching from server');
          snapshot = await getDocsFromServer(q);
        }
      } else {
        // Load more - always from server
        snapshot = await getDocs(q);
      }

      const newPosts = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        _doc: docSnap,
      }));

      const filteredPosts = filterPostsByModule(newPosts);

      if (!isMountedRef.current) return;

      if (isInitial) {
        setPosts(filteredPosts);
        
        if (newPosts.length > 0 && newPosts[0].createdAt) {
          newestTimestampRef.current = newPosts[0].createdAt;
        }
      } else {
        setPosts(prev => [...prev, ...filteredPosts]);
      }

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      console.error('[useServiceFeed] Error fetching posts:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filterPostsByModule]);

  // Background polling for new posts
  const checkForNewPosts = useCallback(async () => {
    if (!newestTimestampRef.current || !isMountedRef.current) return;

    try {
      const q = query(
        collection(db, 'serviceFeedPosts'),
        where('createdAt', '>', newestTimestampRef.current),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty && isMountedRef.current) {
        setHasNewPosts(true);
      }
    } catch (err) {
      console.warn('[useServiceFeed] Error checking for new posts:', err);
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    lastDocRef.current = null;
    newestTimestampRef.current = null;
    setHasNewPosts(false);
    setPosts([]);
    setError(null);
    await fetchPosts(true);
  }, [fetchPosts]);

  // Load more posts (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore && !loading) {
      await fetchPosts(false);
    }
  }, [loadingMore, hasMore, loading, fetchPosts]);

  // Update a single post in the local state (for optimistic updates)
  const updatePostLocally = useCallback((postId, updates) => {
    setPosts(prev => prev.map(post => 
      post.id === postId ? { ...post, ...updates } : post
    ));
  }, []);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    
    if (userData !== undefined) {
      fetchPosts(true);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [userData]); // Re-fetch when userData changes

  // Background polling
  useEffect(() => {
    pollIntervalRef.current = setInterval(checkForNewPosts, POLL_INTERVAL);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [checkForNewPosts]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    hasNewPosts,
    error,
    refresh,
    loadMore,
    updatePostLocally,
  };
}
