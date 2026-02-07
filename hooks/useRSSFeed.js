import { useState, useEffect } from 'react';

// Cache az RSS hírekhez
let rssCache = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 perc cache (gyakoribb frissítés)

export function useRSSFeed() {
  const [rssPosts, setRssPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRSSPosts();
  }, []);

  const fetchRSSPosts = async () => {
    // Ha van friss cache, használjuk azt
    const now = Date.now();
    if (rssCache && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
      setRssPosts(rssCache);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/rss/semmelweis');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'RSS betöltési hiba');
      }

      // Cache frissítése
      rssCache = data.posts || [];
      lastFetchTime = now;
      
      setRssPosts(data.posts || []);
    } catch (err) {
      console.error('RSS fetch error:', err);
      setError(err.message);
      setRssPosts([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    rssPosts,
    loading,
    error,
    refetch: fetchRSSPosts,
  };
}
