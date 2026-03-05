"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  limit,
  startAfter,
  getDoc
} from 'firebase/firestore';
import {
  ArrowLeft,
  Plus,
  Send,
  MessageCircle,
  Star,
  Heart,
  Laugh,
  Frown,
  Zap,
  Angry,
  X,
  Filter,
  Tag,
  AlertTriangle,
  Flag,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronUp,
  Hash,
  Users,
  Eye,
  EyeOff,
  Shield,
  Palette,
  Type
} from 'lucide-react';

// ============================================
// CONSTANTS
// ============================================
const CATEGORIES = [
  { id: 'altalanos', label: 'Általános', emoji: '💬', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { id: 'szakmai', label: 'Szakmai kérdés', emoji: '🔬', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'tapasztalat', label: 'Tapasztalat', emoji: '💡', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  { id: 'munkahely', label: 'Munkahelyi', emoji: '🏥', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { id: 'jogszabaly', label: 'Jogszabály', emoji: '⚖️', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  { id: 'kepzes', label: 'Képzés / Oktatás', emoji: '📚', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { id: 'egyeb', label: 'Egyéb', emoji: '📌', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
];

const REACTIONS = [
  { type: 'like', emoji: '⭐', label: 'Tetszik', color: 'text-yellow-500' },
  { type: 'love', emoji: '❤️', label: 'Imádom', color: 'text-red-500' },
  { type: 'haha', emoji: '😄', label: 'Haha', color: 'text-yellow-500' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-orange-500' },
  { type: 'sad', emoji: '😢', label: 'Szomorú', color: 'text-gray-500' },
  { type: 'angry', emoji: '😠', label: 'Dühös', color: 'text-red-600' }
];

const ADMIN_EMAIL = 'epresla@icloud.com';

const COLOR_PRESETS = [
  { name: 'Alapértelmezett', bg: '#ffffff', text: '#1f2937' },
  { name: 'Sötét', bg: '#1a1a2e', text: '#e0e0e0' },
  { name: 'Kék', bg: '#1e3a5f', text: '#ffffff' },
  { name: 'Zöld', bg: '#1b4332', text: '#d8f3dc' },
  { name: 'Lila', bg: '#3c096c', text: '#e0aaff' },
  { name: 'Meleg', bg: '#7f5539', text: '#ffe8d6' },
  { name: 'Piros', bg: '#6a040f', text: '#ffddd2' },
  { name: 'Arany', bg: '#ffd60a', text: '#001d3d' },
  { name: 'Narancs', bg: '#f48c06', text: '#ffffff' },
  { name: 'Türkiz', bg: '#0a9396', text: '#ffffff' },
];

const FONT_OPTIONS = [
  { value: 'sans', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
  { value: 'cursive', label: 'Kézírásos' },
];

const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28];

const getFontFamilyCSS = (family) => {
  switch (family) {
    case 'serif': return 'Georgia, serif';
    case 'mono': return 'monospace';
    case 'cursive': return 'cursive';
    default: return 'inherit';
  }
};

// ============================================
// POST CREATION MODAL
// ============================================
function CreatePostModal({ darkMode, user, onClose, onSuccess }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('altalanos');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [style, setStyle] = useState({
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    fontSize: 16,
    fontFamily: 'sans',
  });
  const textareaRef = useRef(null);

  const hasCustomStyle = style.backgroundColor !== '#ffffff' || style.textColor !== '#1f2937' || style.fontSize !== 16 || style.fontFamily !== 'sans';

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && tags.length < 5 && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    try {
      const postData = {
        text: text.trim(),
        category,
        tags,
        userId: user.uid,
        isAnonymous,
        style: hasCustomStyle ? style : null,
        createdAt: serverTimestamp(),
        reactions: {},
        comments: [],
        reportCount: 0,
        isHidden: false,
      };

      // Ha nem anonim, mentsük el a szerző adatait
      if (!isAnonymous) {
        postData.authorData = {
          displayName: user.displayName || 'Felhasználó',
          photoURL: user.photoURL || null,
        };
      }

      await addDoc(collection(db, 'communityPosts'), postData);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating community post:', error);
      alert('Hiba történt a poszt létrehozásakor.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = CATEGORIES.find(c => c.id === category);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-full sm:max-w-lg rounded-2xl shadow-2xl my-2 mx-2 sm:mx-auto ${
        darkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header - sticky */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b rounded-t-2xl ${
          darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Új poszt létrehozása
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-full ${
            darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anonim checkbox */}
        <div className="mx-4 mt-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Poszt küldése anonimként
            </span>
          </label>
        </div>

        {/* Kategória választó */}
        <div className="px-4 mt-3">
          <button
            type="button"
            onClick={() => setShowCategoryPicker(!showCategoryPicker)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory.color}`}
          >
            <span>{selectedCategory.emoji}</span>
            <span>{selectedCategory.label}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>

          {showCategoryPicker && (
            <div className={`mt-2 grid grid-cols-2 gap-1.5 p-2 rounded-xl border ${
              darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setCategory(cat.id); setShowCategoryPicker(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    category === cat.id
                      ? `${cat.color} ring-2 ring-offset-1 ${darkMode ? 'ring-gray-500' : 'ring-gray-300'}`
                      : darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stílus gomb */}
        <div className="px-4 mt-3">
          <button
            type="button"
            onClick={() => setShowStylePanel(!showStylePanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              hasCustomStyle
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Stílus testreszabása</span>
            {showStylePanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showStylePanel && (
            <div className={`mt-2 p-3 rounded-xl border space-y-4 ${
              darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              {/* Színsémák */}
              <div>
                <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Színsémák
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setStyle(s => ({ ...s, backgroundColor: preset.bg, textColor: preset.text }))}
                      className={`relative rounded-lg p-1 transition-all ${
                        style.backgroundColor === preset.bg && style.textColor === preset.text
                          ? 'ring-2 ring-blue-500 ring-offset-1 scale-105'
                          : 'hover:scale-105'
                      }`}
                      title={preset.name}
                    >
                      <div
                        className="w-full h-8 rounded-md border border-black/10 flex items-center justify-center"
                        style={{ backgroundColor: preset.bg }}
                      >
                        <span style={{ color: preset.text, fontSize: '10px', fontWeight: 600 }}>Aa</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Egyéni színek */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Háttér</label>
                  <input
                    type="color"
                    value={style.backgroundColor}
                    onChange={(e) => setStyle(s => ({ ...s, backgroundColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Szöveg</label>
                  <input
                    type="color"
                    value={style.textColor}
                    onChange={(e) => setStyle(s => ({ ...s, textColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0"
                  />
                </div>
              </div>

              {/* Betűtípus és méret */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className={`text-xs font-medium mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Type className="w-3 h-3 inline mr-1" />Betűtípus
                  </label>
                  <select
                    value={style.fontFamily}
                    onChange={(e) => setStyle(s => ({ ...s, fontFamily: e.target.value }))}
                    className={`w-full px-2 py-1.5 rounded-lg text-sm border ${
                      darkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className={`text-xs font-medium mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Betűméret
                  </label>
                  <select
                    value={style.fontSize}
                    onChange={(e) => setStyle(s => ({ ...s, fontSize: Number(e.target.value) }))}
                    className={`w-full px-2 py-1.5 rounded-lg text-sm border ${
                      darkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    {FONT_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}px</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reset gomb */}
              {hasCustomStyle && (
                <button
                  type="button"
                  onClick={() => setStyle({ backgroundColor: '#ffffff', textColor: '#1f2937', fontSize: 16, fontFamily: 'sans' })}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    darkMode ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  ↺ Alapértelmezés visszaállítása
                </button>
              )}
            </div>
          )}
        </div>

        {/* Szövegmező élő előnézettel */}
        <div className="px-4 mt-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Írd meg a gondolataidat..."
            rows={5}
            style={{
              backgroundColor: style.backgroundColor,
              color: style.textColor,
              fontSize: `${style.fontSize}px`,
              fontFamily: getFontFamilyCSS(style.fontFamily),
            }}
            className="w-full px-4 py-3 rounded-xl border resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className={`flex justify-end mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {text.length} karakter
          </div>
        </div>

        {/* Hashtag-ek */}
        <div className="px-4 mt-2 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  darkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'
                }`}
              >
                #{tag}
                <button onClick={() => setTags(tags.filter(t => t !== tag))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {tags.length < 5 && (
              <div className="flex items-center gap-1">
                <Hash className={`w-3.5 h-3.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}}
                  placeholder="Címke hozzáadása..."
                  className={`text-xs border-none outline-none bg-transparent w-32 ${
                    darkMode ? 'text-gray-300 placeholder-gray-600' : 'text-gray-700 placeholder-gray-400'
                  }`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 flex items-center justify-between px-4 py-3 border-t rounded-b-2xl ${
          darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {isAnonymous ? (
              <><EyeOff className="w-3 h-3 inline mr-1" />Anonim közzététel</>
            ) : (
              <><Eye className="w-3 h-3 inline mr-1" />Nyilvános közzététel</>
            )}
          </p>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Közzététel...' : 'Közzététel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMMENT SECTION
// ============================================
function CommentSection({ postId, comments, darkMode, user, isAdmin, onUpdate }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [isAnonComment, setIsAnonComment] = useState(true);

  const countAllComments = (cmts) => {
    let count = cmts?.length || 0;
    cmts?.forEach(c => { count += (c.replies?.length || 0); });
    return count;
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || submitting || !user) return;
    setSubmitting(true);

    try {
      const postRef = doc(db, 'communityPosts', postId);
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: commentText.trim(),
        userId: user.uid,
        isAnonymous: isAnonComment,
        createdAt: new Date().toISOString(),
        replies: [],
      };

      if (!isAnonComment) {
        newComment.authorData = {
          displayName: user.displayName || 'Felhasználó',
          photoURL: user.photoURL || null,
        };
      }

      if (replyTo) {
        // Reply to existing comment
        const updatedComments = comments.map(c => {
          if (c.id === replyTo) {
            return { ...c, replies: [...(c.replies || []), newComment] };
          }
          return c;
        });
        await updateDoc(postRef, { comments: updatedComments });
      } else {
        const updatedComments = [...(comments || []), newComment];
        await updateDoc(postRef, { comments: updatedComments });
      }

      setCommentText('');
      setReplyTo(null);
      onUpdate();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCount = countAllComments(comments);

  const formatCommentTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'most';
    if (diff < 3600) return `${Math.floor(diff / 60)} perce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} órája`;
    return date.toLocaleDateString('hu-HU');
  };

  return (
    <div>
      {/* Toggle */}
      <button
        onClick={() => setShowComments(!showComments)}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
          darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        {totalCount > 0 ? `${totalCount} hozzászólás` : 'Hozzászólás'}
        {showComments ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showComments && (
        <div className="mt-3 space-y-3">
          {/* Comment list */}
          {(comments || []).map((comment) => (
            <div key={comment.id} className={`rounded-xl p-3 ${
              darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {comment.isAnonymous !== false ? (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600'
                    }`}>
                      <EyeOff className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <img
                      src={comment.authorData?.photoURL || '/default-avatar.svg'}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  )}
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {comment.isAnonymous !== false ? 'Anonim felhasználó' : (comment.authorData?.displayName || 'Felhasználó')}
                  </span>
                  {isAdmin && comment.isAnonymous !== false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                      ID: {comment.userId?.slice(0, 6)}...
                    </span>
                  )}
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {formatCommentTime(comment.createdAt)}
                </span>
              </div>
              <p className={`text-sm ml-9 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {comment.text}
              </p>

              {/* Reply button */}
              <button
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                className={`ml-9 mt-1 text-xs font-medium ${
                  darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                Válasz
              </button>

              {/* Replies */}
              {comment.replies?.map((reply) => (
                <div key={reply.id} className={`ml-9 mt-2 pl-3 border-l-2 ${
                  darkMode ? 'border-gray-600' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    {reply.isAnonymous !== false ? (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        darkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500'
                      }`}>
                        <EyeOff className="w-2.5 h-2.5" />
                      </div>
                    ) : (
                      <img src={reply.authorData?.photoURL || '/default-avatar.svg'} alt="" className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {reply.isAnonymous !== false ? 'Anonim felhasználó' : (reply.authorData?.displayName || 'Felhasználó')}
                    </span>
                    {isAdmin && reply.isAnonymous !== false && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                        {reply.userId?.slice(0, 6)}
                      </span>
                    )}
                    <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formatCommentTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className={`text-xs ml-7 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{reply.text}</p>
                </div>
              ))}

              {/* Reply input */}
              {replyTo === comment.id && (
                <div className="ml-9 mt-2 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                    placeholder="Válasz írása..."
                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm border ${
                      darkMode ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || submitting}
                    className="p-1.5 rounded-lg bg-blue-600 text-white disabled:bg-gray-400"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* New comment input */}
          {!replyTo && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAnonComment(!isAnonComment)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isAnonComment
                      ? darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                  }`}
                  title={isAnonComment ? 'Anonim – kattints a váltáshoz' : 'Nyilvános – kattints a váltáshoz'}
                >
                  {isAnonComment ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                    placeholder={isAnonComment ? 'Anonim hozzászólás...' : 'Hozzászólás a neveddel...'}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm border ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || submitting}
                    className="p-2 rounded-xl bg-blue-600 text-white disabled:bg-gray-400 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SINGLE POST CARD
// ============================================
function PostCard({ post, darkMode, user, isAdmin, onUpdate }) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const reactionTimeout = useRef(null);

  const userReaction = user ? post.reactions?.[user.uid] : null;

  const getReactionSummary = () => {
    if (!post.reactions || Object.keys(post.reactions).length === 0) return null;
    const counts = {};
    Object.values(post.reactions).forEach(type => {
      if (type) counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  };

  const totalReactions = post.reactions ? Object.keys(post.reactions).filter(k => post.reactions[k]).length : 0;

  const handleReaction = async (type) => {
    if (!user) return;
    setShowReactions(false);

    try {
      const postRef = doc(db, 'communityPosts', post.id);
      const currentReaction = post.reactions?.[user.uid];

      if (currentReaction === type) {
        // Remove reaction
        const newReactions = { ...post.reactions };
        delete newReactions[user.uid];
        await updateDoc(postRef, { reactions: newReactions });
      } else {
        await updateDoc(postRef, { [`reactions.${user.uid}`]: type });
      }
      onUpdate();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const handleReport = async () => {
    if (!user) return;
    setShowMenu(false);
    try {
      await addDoc(collection(db, 'reports'), {
        type: 'communityPost',
        postId: post.id,
        reportedBy: user.uid,
        reason: 'Nem megfelelő tartalom',
        createdAt: serverTimestamp(),
      });
      alert('Jelentés elküldve. Köszönjük!');
    } catch (error) {
      console.error('Error reporting post:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a posztot?')) return;
    setShowMenu(false);
    try {
      await deleteDoc(doc(db, 'communityPosts', post.id));
      onUpdate();
    } catch (error) {
      console.error('Error deleting post:', error);
    }
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

  // Render formatted text (basic markdown support)
  const renderText = (rawText) => {
    if (!rawText) return null;
    // Process bold, italic, and links
    const parts = rawText.split(/(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:no-underline">
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  const reactionSummary = getReactionSummary();
  const categoryData = CATEGORIES.find(c => c.id === post.category) || CATEGORIES[0];

  return (
    <div className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            {post.isAnonymous ? (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-gradient-to-br from-gray-600 to-gray-700' : 'bg-gradient-to-br from-gray-200 to-gray-300'
              }`}>
                <Users className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            ) : (
              <img
                src={post.authorData?.photoURL || '/default-avatar.svg'}
                alt={post.authorData?.displayName || 'Felhasználó'}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {post.isAnonymous ? 'Anonim felhasználó' : (post.authorData?.displayName || 'Felhasználó')}
                </span>
                {isAdmin && post.isAnonymous && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-mono">
                    {post.userId?.slice(0, 8)}
                  </span>
                )}
              </div>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {formatTime(post.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Category badge */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryData.color}`}>
              {categoryData.emoji} {categoryData.label}
            </span>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`p-1.5 rounded-full transition-colors ${
                  darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className={`absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border z-10 overflow-hidden ${
                  darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  <button
                    onClick={handleReport}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${
                      darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Flag className="w-4 h-4" />
                    Jelentés
                  </button>
                  {(isAdmin || post.userId === user?.uid) && (
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Törlés
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {post.style ? (
        <div
          className="mx-4 mb-3 px-4 py-3 rounded-xl whitespace-pre-wrap leading-relaxed"
          style={{
            backgroundColor: post.style.backgroundColor,
            color: post.style.textColor,
            fontSize: `${post.style.fontSize || 16}px`,
            fontFamily: getFontFamilyCSS(post.style.fontFamily || 'sans'),
          }}
        >
          {post.text}
        </div>
      ) : (
        <div className={`px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap ${
          darkMode ? 'text-gray-200' : 'text-gray-800'
        }`}>
          {renderText(post.text)}
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span key={tag} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Reactions summary */}
      {reactionSummary && (
        <div className={`px-4 pb-2 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="flex -space-x-1">
            {Object.entries(reactionSummary)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([type]) => {
                const r = REACTIONS.find(r => r.type === type);
                return <span key={type} className="text-sm">{r?.emoji}</span>;
              })}
          </div>
          <span className="text-xs ml-1">{totalReactions}</span>
        </div>
      )}

      {/* Action bar */}
      <div className={`px-4 py-2 border-t flex items-center justify-between ${
        darkMode ? 'border-gray-700' : 'border-gray-100'
      }`}>
        {/* Reaction button */}
        <div className="relative"
          onMouseEnter={() => {
            clearTimeout(reactionTimeout.current);
            setShowReactions(true);
          }}
          onMouseLeave={() => {
            reactionTimeout.current = setTimeout(() => setShowReactions(false), 300);
          }}
        >
          <button
            onClick={() => userReaction ? handleReaction(userReaction) : setShowReactions(!showReactions)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              userReaction
                ? 'text-blue-600 dark:text-blue-400'
                : darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {userReaction ? (
              <span className="text-lg">{REACTIONS.find(r => r.type === userReaction)?.emoji}</span>
            ) : (
              <Star className="w-4 h-4" />
            )}
            <span>{userReaction ? REACTIONS.find(r => r.type === userReaction)?.label : 'Reakció'}</span>
          </button>

          {/* Reaction picker */}
          {showReactions && (
            <div className={`absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-2xl shadow-xl border ${
              darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
            }`}>
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  onClick={() => handleReaction(r.type)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                  title={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comments section trigger is handled inside CommentSection */}
        <CommentSection
          postId={post.id}
          comments={post.comments || []}
          darkMode={darkMode}
          user={user}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================
export default function KozossegPage() {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      let q;
      if (activeFilter === 'all') {
        q = query(
          collection(db, 'communityPosts'),
          where('isHidden', '==', false),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        q = query(
          collection(db, 'communityPosts'),
          where('isHidden', '==', false),
          where('category', '==', activeFilter),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      }

      const snapshot = await getDocs(q);
      const fetchedPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching community posts:', error);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Auth guard - only admin can see for now
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-center p-8 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
          <Shield className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
          <h2 className={`text-lg font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Hamarosan elérhető
          </h2>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Ez a funkció jelenleg fejlesztés alatt áll.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            Vissza
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-[#F0F2F5]'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
          </button>
          <h1 className={`text-lg font-bold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Közösség
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-full transition-colors ${
                showFilters || activeFilter !== 'all'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                  : darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className={`px-4 pb-3 flex gap-1.5 overflow-x-auto ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Mind
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === cat.id
                    ? 'bg-blue-600 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create post prompt */}
      <div className={`mx-4 mt-4 rounded-2xl border p-4 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center gap-3"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            <Users className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          <div className={`flex-1 text-left px-4 py-2.5 rounded-full ${
            darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'
          }`}>
            Írd meg anonim gondolatod...
          </div>
        </button>
      </div>

      {/* Posts feed */}
      <div className="mx-4 mt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <MessageCircle className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Még nincsenek posztok
            </h3>
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Légy te az első, aki megosztja a gondolatait!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Poszt létrehozása
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              darkMode={darkMode}
              user={user}
              isAdmin={isAdmin}
              onUpdate={fetchPosts}
            />
          ))
        )}
      </div>

      {/* Floating create button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create post modal */}
      {showCreateModal && (
        <CreatePostModal
          darkMode={darkMode}
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchPosts}
        />
      )}
    </div>
  );
}
