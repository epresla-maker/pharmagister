'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, MessageCircle, Send, MoreHorizontal, Calendar, Clock, MapPin, Briefcase, User } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

function CommentItem({ comment, postId, depth = 0, onReply, replyingTo, setReplyingTo, userData, user, formatTime, currentMarket }) {
  const maxDepth = 5;
  const isHighlighted = replyingTo?.commentId === comment.id;

  return (
    <div className={`${depth > 0 ? 'ml-10 border-l-2 border-gray-200 dark:border-gray-600 pl-4' : ''}`}>
      {/* Komment */}
      <div className="flex gap-2">
        <img
          src={comment.userPhoto || '/default-avatar.svg'}
          alt="Commenter"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-3 ${isHighlighted ? 'ring-2 ring-purple-500' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {comment.userName}
              </span>
              {comment.createdAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(comment.createdAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
              {comment.text}
            </p>
          </div>
          {depth < maxDepth && (
            <button 
              onClick={() => setReplyingTo({ commentId: comment.id, userName: comment.userName })}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 font-semibold mt-1 px-2"
            >
              {currentMarket === 'de' ? 'Antworten' : 'Válasz'}
            </button>
          )}
        </div>
      </div>

      {/* Rekurzív válaszok */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              onReply={onReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              userData={userData}
              user={user}
              formatTime={formatTime}
              currentMarket={currentMarket}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const market = getClientMarket();
  const searchParams = useSearchParams();
  const collectionName = searchParams.get('collection') || 'serviceFeedPosts';
  const { user, userData } = useAuth();
  const currentMarket = userData?.market || market;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { commentId, userName }
  const [replyTo, setReplyTo] = useState({});
  const [replyText, setReplyText] = useState({});
  const [showComments, setShowComments] = useState(false); // Hozzászólások összecsukva/kinyitva

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return currentMarket === 'de' ? 'Gerade eben' : 'Most';
    if (minutes < 60) return currentMarket === 'de' ? `vor ${minutes} Min.` : `${minutes} perce`;
    if (hours < 24) return currentMarket === 'de' ? `vor ${hours} Std.` : `${hours} órája`;
    if (days < 7) return currentMarket === 'de' ? `vor ${days} Tagen` : `${days} napja`;
    return date.toLocaleDateString(currentMarket === 'de' ? 'de-DE' : 'hu-HU');
  };

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postDoc = await getDoc(doc(db, collectionName, params.id));
        if (postDoc.exists()) {
          setPost({ id: postDoc.id, ...postDoc.data() });
        }
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchPost();
    }
  }, [params.id, collectionName]);

  const handleComment = async () => {
    if (!commentText.trim() || !user) return;

    try {
      const newComment = {
        id: Date.now().toString(),
        text: commentText,
        userId: user.uid,
        userName: userData?.displayName || (currentMarket === 'de' ? 'Unbekannt' : 'Névtelen'),
        userPhoto: userData?.photoURL || user.photoURL || '',
        createdAt: Timestamp.now(),
        replies: []
      };

      const postRef = doc(db, collectionName, params.id);
      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });

      setPost(prev => ({
        ...prev,
        comments: [...(prev.comments || []), newComment]
      }));
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleReply = async (postId, parentCommentId) => {
    if (!commentText.trim() || !user) return;

    try {
      const newReply = {
        id: Date.now().toString(),
        text: commentText,
        userId: user.uid,
        userName: userData?.displayName || (currentMarket === 'de' ? 'Unbekannt' : 'Névtelen'),
        userPhoto: userData?.photoURL || user.photoURL || '',
        createdAt: Timestamp.now(),
        replies: []
      };

      const addReplyToComment = (comments) => {
        return comments.map(comment => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply]
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: addReplyToComment(comment.replies)
            };
          }
          return comment;
        });
      };

      const updatedComments = addReplyToComment(post.comments || []);
      
      const postRef = doc(db, collectionName, postId);
      await updateDoc(postRef, {
        comments: updatedComments
      });

      setPost(prev => ({ ...prev, comments: updatedComments }));
      setCommentText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  // Unified submit handler
  const handleSubmit = () => {
    if (replyingTo) {
      handleReply(post.id, replyingTo.commentId);
    } else {
      handleComment();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{currentMarket === 'de' ? 'Beitrag nicht gefunden' : 'Poszt nem található'}</h2>
          <button
            onClick={() => router.push('/')}
            className="text-cyan-500 hover:text-cyan-600"
          >
            {currentMarket === 'de' ? 'Zurueck zur Startseite' : 'Vissza a főoldalra'}
          </button>
        </div>
      </div>
    );
  }

  const commentsCount = post.comments?.length || 0;
  const totalReplies = (post.comments || []).reduce((sum, comment) => {
    const countReplies = (replies) => {
      if (!replies || replies.length === 0) return 0;
      return replies.length + replies.reduce((s, r) => s + countReplies(r.replies || []), 0);
    };
    return sum + countReplies(comment.replies || []);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 pt-safe-small">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {post.authorData?.displayName || (currentMarket === 'de' ? 'Unbekannt' : 'Névtelen')}
            </h1>
            <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border-b-8 border-gray-200 dark:border-gray-700">
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
                  className="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                  onClick={() => post.userId && router.push(`/profil/${post.userId}`)}
                >
                  {post.authorData?.displayName || (currentMarket === 'de' ? 'Unbekannt' : 'Névtelen')}
                </h3>
                <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div className="pb-2">
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap px-3 sm:px-4">{post.text || post.rssTitle}</p>
            {post.rssDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 px-3 sm:px-4">{post.rssDescription}</p>
            )}
            {post.rssLink && (
              <a
                href={post.rssLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-500 hover:text-cyan-600 text-sm mt-1 block px-3 sm:px-4"
              >
                {currentMarket === 'de' ? 'Zur Website →' : 'Tovább az oldalra →'}
              </a>
            )}
          </div>

          {/* Pharmacy Demand specific content */}
          {post.postType === 'pharmacyDemand' && (
            <div className="px-3 sm:px-4 py-3 space-y-2">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4 space-y-3">
                {post.demandDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm text-gray-900 dark:text-white font-medium">{post.demandDate}</span>
                  </div>
                )}
                {post.shiftType && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{post.shiftType}</span>
                  </div>
                )}
                {post.pharmacyName && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{post.pharmacyName}</span>
                  </div>
                )}
                {post.pharmacyAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{post.pharmacyAddress}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push(`/pharmagister/demand/${post.demandId}`)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-2.5 rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all"
              >
                {currentMarket === 'de' ? 'Ansehen' : 'Megnézem'}
              </button>
            </div>
          )}

          {/* Available Slot specific content */}
          {post.postType === 'availableSlot' && post.slotDate && (
            <div className="px-3 sm:px-4 pb-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 space-y-2">
                {post.slotDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">📅 {currentMarket === 'de' ? 'Datum' : 'Dátum'}</span>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{post.slotDate}</span>
                  </div>
                )}
                {post.slotTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">🕐 {currentMarket === 'de' ? 'Uhrzeit' : 'Időpont'}</span>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{post.slotTime}</span>
                  </div>
                )}
                {post.serviceName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{currentMarket === 'de' ? 'Leistung' : 'Szolgáltatás'}</span>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{post.serviceName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Images */}
          {post.serviceImages && post.serviceImages.length > 0 && (
            <div className={`px-3 sm:px-4 pb-3 grid gap-2 ${post.serviceImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {post.serviceImages.slice(0, 4).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Service image ${idx + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
              ))}
            </div>
          )}
          {post.imageUrl && (
            <div className="px-3 sm:px-4 pb-3">
              <img
                src={post.imageUrl}
                alt="Post image"
                className="w-full object-cover max-h-96 rounded-lg"
              />
            </div>
          )}

          {/* Hozzászólások gomb */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-2">
              <button
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{commentsCount + totalReplies} {currentMarket === 'de' ? 'Kommentare' : 'hozzászólás'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Comments Section - csak ha showComments true */}
        {showComments && (
          <div className="bg-white dark:bg-gray-800 border-b-8 border-gray-200 dark:border-gray-700 py-4 px-4 pb-32">
            {/* Comments List */}
            <div className="space-y-4">
              {(post.comments || []).map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  postId={post.id}
                  depth={0}
                  onReply={handleReply}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  userData={userData}
                  user={user}
                  formatTime={formatTime}
                  currentMarket={currentMarket}
                />
              ))}
            </div>

            {commentsCount === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                <p>{currentMarket === 'de' ? 'Noch keine Kommentare' : 'Még nincs hozzászólás'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Comment Input - csak ha showComments true */}
      {showComments && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {/* Reply indicator */}
          {replyingTo && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentMarket === 'de' ? 'Antwort an' : 'Válasz'} <span className="font-semibold text-gray-900 dark:text-white">{replyingTo.userName}</span> {currentMarket === 'de' ? '' : 'számára'}
              </span>
              <button 
                onClick={() => setReplyingTo(null)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {currentMarket === 'de' ? 'Abbrechen' : 'Mégsem'}
              </button>
            </div>
          )}
          
          {/* Input area */}
          {user ? (
            <div className="px-4 py-3 flex items-center gap-2">
              <img
                src={userData?.photoURL || user?.photoURL || '/default-avatar.svg'}
                alt="Your avatar"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={replyingTo ? (currentMarket === 'de' ? `Antwort an ${replyingTo.userName}...` : `Válasz ${replyingTo.userName} számára...`) : (currentMarket === 'de' ? 'Schreibe einen Kommentar...' : 'Írj hozzászólást...')}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!commentText.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <button 
                  onClick={() => router.push('/login')}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                >
                  {currentMarket === 'de' ? 'Melde dich an' : 'Jelentkezz be'}
                </button>
                {' '}{currentMarket === 'de' ? 'um zu kommentieren' : 'a hozzászóláshoz'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
