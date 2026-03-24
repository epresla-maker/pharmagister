'use client';

import { useState, useRef } from 'react';
import { useRSSFeed } from '@/hooks/useRSSFeed';
import { useAuth } from '@/context/AuthContext';
import { ExternalLink, Calendar, User, AlertCircle, MessageCircle, Send, MoreHorizontal, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect } from 'react';
import { createNotificationWithPush } from '@/lib/notifications';

function RSSComments({ postId }) {
  const { user, userData } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [reportComment, setReportComment] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const longPressTimer = useRef(null);

  const handleLongPressStart = (comment) => {
    longPressTimer.current = setTimeout(() => {
      setReportComment(comment);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleReportComment = async () => {
    if (!user || !reportComment) return;
    setReportSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        type: 'rssComment',
        postId: postId,
        commentId: reportComment.id,
        commentText: reportComment.text,
        reportedBy: user.uid,
        reason: 'Nem megfelelő tartalom',
        createdAt: serverTimestamp(),
      });
      await createNotificationWithPush({
        userId: 'AcBMMwkqMvWAjrodNPPBjFdjjhw2',
        type: 'content_report',
        title: '⚠️ Hír hozzászólás jelentés',
        message: `Hír hozzászólás jelentve: "${reportComment.text?.substring(0, 80) || ''}"`,
        data: { url: '/kozosseg' },
        url: '/kozosseg'
      }).catch(() => {});
      setReportComment(null);
      alert('Jelentés elküldve. Köszönjük!');
    } catch (error) {
      console.error('Error reporting comment:', error);
    } finally {
      setReportSubmitting(false);
    }
  };

  useEffect(() => {
    if (!postId) return;

    const q = query(
      collection(db, 'rssComments', postId, 'comments'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [postId]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'rssComments', postId, 'comments'), {
        text: newComment.trim(),
        userId: user.uid,
        userName: userData?.displayName || 'Névtelen',
        userPhoto: userData?.photoURL || null,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error('Comment error:', error);
      alert('Hiba történt a komment küldésekor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* Comment gomb */}
      <div className="px-4 py-2">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{comments.length} hozzászólás</span>
        </button>
      </div>

      {/* Comment szekció */}
      {showComments && (
        <div className="px-4 pb-4 space-y-4">
          {/* Új komment */}
          {user ? (
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <img
                src={userData?.photoURL || '/default-avatar.svg'}
                alt="You"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Írj hozzászólást..."
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={submitting}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Jelentkezz be a hozzászóláshoz
            </p>
          )}

          {/* Kommentek listája */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-2"
                  onTouchStart={() => handleLongPressStart(comment)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onContextMenu={(e) => { e.preventDefault(); setReportComment(comment); }}
                >
                  <img
                    src={comment.userPhoto || '/default-avatar.svg'}
                    alt={comment.userName}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {comment.userName}
                      </span>
                      {comment.createdAt && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(comment.createdAt.toDate(), {
                            addSuffix: true,
                            locale: hu
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Még nincs hozzászólás
            </p>
          )}

          {/* Report comment overlay */}
          {reportComment && (
            <div 
              className="fixed inset-0 z-[60] flex items-center justify-center px-4"
              onClick={() => setReportComment(null)}
            >
              <div className="fixed inset-0 bg-black/40" />
              <div 
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-sm p-4 rounded-2xl border shadow-2xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flag size={20} className="text-red-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">Hozzászólás jelentése</span>
                  </div>
                  <button 
                    onClick={() => setReportComment(null)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <MoreHorizontal size={20} className="text-gray-500 rotate-90" />
                  </button>
                </div>

                <div className="rounded-xl px-3 py-2 mb-4 bg-gray-100 dark:bg-gray-700">
                  <p className="text-xs font-semibold mb-1 text-gray-500">
                    {reportComment.userName || 'Felhasználó'}
                  </p>
                  <p className="text-sm line-clamp-3 text-gray-700 dark:text-gray-300">
                    {reportComment.text}
                  </p>
                </div>

                <button
                  onClick={handleReportComment}
                  disabled={reportSubmitting}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {reportSubmitting ? 'Küldés...' : 'Jelentés küldése'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RSSFeedDisplay() {
  const { rssPosts, loading, error, refetch } = useRSSFeed();
  const { user } = useAuth();
  const [hiddenRssIds, setHiddenRssIds] = useState(new Set());
  const [loadingHidden, setLoadingHidden] = useState(true);
  const [openMenuPostId, setOpenMenuPostId] = useState(null);

  // Rejtett RSS hírek betöltése
  useEffect(() => {
    const fetchHiddenIds = async () => {
      try {
        const hiddenSnapshot = await getDocs(collection(db, 'hiddenRssPosts'));
        const hiddenIds = new Set(hiddenSnapshot.docs.map(doc => doc.id));
        setHiddenRssIds(hiddenIds);
      } catch (error) {
        console.error('Error fetching hidden RSS IDs:', error);
      } finally {
        setLoadingHidden(false);
      }
    };

    fetchHiddenIds();
  }, []);

  // Szűrt RSS hírek (rejtettek kiszűrése)
  const filteredRssPosts = rssPosts.filter(post => !hiddenRssIds.has(post.id));

  if (loading || loadingHidden) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">
              RSS betöltési hiba
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!filteredRssPosts || filteredRssPosts.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Nincsenek elérhető RSS hírek
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* RSS hírek */}
      {filteredRssPosts.map((post) => (
        <div
          key={post.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
        >
          {/* Header */}
          <div className="p-4 pb-3">
            <div className="flex items-start gap-3">
              {/* Semmelweis logo/avatar */}
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">SE</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Semmelweis Egyetem
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    Egészségügy
                  </span>
                </div>
                
                {post.pubDate && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(post.pubDate), { 
                      addSuffix: true,
                      locale: hu 
                    })}
                  </div>
                )}
              </div>

              {/* Három pont menü - Jelentés */}
              {user && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <MoreHorizontal size={20} className="text-gray-500" />
                  </button>

                  {openMenuPostId === post.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[150px]">
                      <button
                        onClick={async () => {
                          setOpenMenuPostId(null);
                          try {
                            await addDoc(collection(db, 'reports'), {
                              type: 'rssPost',
                              postId: post.id,
                              postTitle: post.title,
                              reportedBy: user.uid,
                              reason: 'Nem megfelelő tartalom',
                              createdAt: serverTimestamp(),
                            });
                            await createNotificationWithPush({
                              userId: 'AcBMMwkqMvWAjrodNPPBjFdjjhw2',
                              type: 'content_report',
                              title: '⚠️ Hír poszt jelentés',
                              message: `Hír poszt jelentve: "${(post.title || '').substring(0, 80)}"`,
                              data: { url: '/kozosseg' },
                              url: '/kozosseg'
                            }).catch(() => {});
                            alert('Jelentés elküldve. Köszönjük!');
                          } catch (error) {
                            console.error('Error reporting post:', error);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        <Flag size={16} />
                        <span>Jelentés</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Kép ha van */}
          {post.imageUrl && (
            <div className="relative w-full bg-gray-100 dark:bg-gray-800" style={{ paddingBottom: '56.25%' }}>
              <img
                src={post.imageUrl}
                alt={post.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Ha a kép nem tölt be, elrejtjük
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Tartalom */}
          <div className="p-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
              {post.title}
            </h3>
            
            {post.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                {post.description}
              </p>
            )}

            {/* Kategóriák */}
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {post.categories.slice(0, 3).map((cat, idx) => (
                  <span 
                    key={idx}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Tovább gomb */}
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <span>Teljes cikk elolvasása</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Hozzászólások */}
          <RSSComments postId={post.id} />
        </div>
      ))}
    </div>
  );
}
