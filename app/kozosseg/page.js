"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
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
  getDoc,
  increment,
  setDoc
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
  Type,
  Pencil,
  Newspaper,
  ImagePlus
} from 'lucide-react';
import ReportModal from '@/app/components/ReportModal';
import { getEffectivePharmagisterRole } from '@/lib/pharmagisterProfile';
import { getClientMarket, getCategoryLabel, getReactionLabel, t } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';

function MarketGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 8.5C4.5 7.12 5.62 6 7 6H12.2C13.58 6 14.7 7.12 14.7 8.5V13.7C14.7 15.08 13.58 16.2 12.2 16.2H7C5.62 16.2 4.5 15.08 4.5 13.7V8.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M14.7 8.8H17.3C18.05 8.8 18.76 9.1 19.28 9.62L20.38 10.72C20.9 11.24 21.2 11.95 21.2 12.7V17.1C21.2 18.48 20.08 19.6 18.7 19.6H15.6C14.22 19.6 13.1 18.48 13.1 17.1V13.4C13.1 12.3 13.95 11.4 15.05 11.32L18.1 11.08" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.4 11.1H11.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M9.6 8.9V13.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function SignalPaperGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6.2 4.8H16.1C17.04 4.8 17.8 5.56 17.8 6.5V18C17.8 18.94 17.04 19.7 16.1 19.7H6.2C5.26 19.7 4.5 18.94 4.5 18V6.5C4.5 5.56 5.26 4.8 6.2 4.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M8 8.2H14.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M8 11.1H14.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M8 14H12.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M17.8 10.2C19.1 10.5 20.1 11.4 20.1 12.8C20.1 14.2 19.1 15.1 17.8 15.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function SearchPulseGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="10.3" cy="10.3" r="4.9" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M14 14L19.5 19.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M7.6 10.3H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M10.3 7.6V13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function MarketCubeGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4.7L18.7 8.5V15.5L12 19.3L5.3 15.5V8.5L12 4.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M12 4.7V11.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M5.3 8.5L12 11.8L18.7 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M8.1 10.2L15.9 6.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55"/>
    </svg>
  );
}

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
const ADMINKA_EMAIL = 'etinatina22@gmail.com';

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

function stripInvalidUnicodeSurrogates(value) {
  const input = String(value || '');
  let out = '';

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);

    // High surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += input[i] + input[i + 1];
        i += 1;
      }
      continue;
    }

    // Drop lone low surrogate
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    out += input[i];
  }

  return out;
}

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
function CreatePostModal({ darkMode, user, userData, onClose, onSuccess }) {
  const market = getClientMarket();
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);

  const sanitizePostText = (value) => stripInvalidUnicodeSurrogates(String(value || ''))
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const handleTextChange = (value) => {
    setText(sanitizePostText(value));
  };

  const handleTextPaste = (e) => {
    const pastedText = e.clipboardData?.getData?.('text/plain');
    if (!pastedText) {
      // Safari can provide empty clipboardData for context-menu paste.
      // In that case let the browser handle native paste.
      return;
    }

    e.preventDefault();
    const sanitizedPaste = sanitizePostText(pastedText);
    const target = e.target;
    const start = target.selectionStart ?? text.length;
    const end = target.selectionEnd ?? text.length;
    const nextValue = text.slice(0, start) + sanitizedPaste + text.slice(end);
    setText(sanitizePostText(nextValue));
  };

  const withTimeout = async (promise, ms, timeoutMessage) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(market === 'de' ? 'Nur Bilddateien sind erlaubt.' : 'Csak képfájlok engedélyezettek.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(market === 'de' ? 'Maximal 5 MB Bildgroesse erlaubt.' : 'Maximum 5MB méretű kép engedélyezett.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const hasCustomStyle = style.backgroundColor !== '#ffffff' || style.textColor !== '#1f2937' || style.fontSize !== 16 || style.fontFamily !== 'sans';

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && tags.length < 5 && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleSubmit = async () => {
    const rawText = textareaRef.current?.value || text;
    const normalizedText = sanitizePostText(rawText).trim();
    if ((!normalizedText && !imageFile) || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      let imageUrl = null;

      // Kép feltöltése ha van
      if (imageFile) {
        setImageUploading(true);
        try {
          const token = await user.getIdToken();
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('userId', user.uid);
          formData.append('folder', 'posts');

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.url) {
            imageUrl = uploadData.url;
          } else {
            throw new Error(uploadData.error || (market === 'de' ? 'Bild-Upload fehlgeschlagen' : 'Kép feltöltés sikertelen'));
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          alert((market === 'de' ? 'Fehler beim Bild-Upload: ' : 'Hiba a kép feltöltésekor: ') + uploadError.message);
          setSubmitting(false);
          setImageUploading(false);
          return;
        }
        setImageUploading(false);
      }

      const postData = {
        text: normalizedText,
        category,
        tags,
        market,
        userId: user.uid,
        isAnonymous,
        style: hasCustomStyle ? style : null,
        imageUrl,
        createdAt: serverTimestamp(),
        reactions: {},
        commentCount: 0,
        reportCount: 0,
        isHidden: false,
      };

      // Mindig mentsük el a szerző adatait (admin használja anonim posztoknál)
      postData.authorData = {
        displayName: userData?.displayName || user.displayName || (market === 'de' ? 'Nutzer/in' : 'Felhasználó'),
        photoURL: userData?.photoURL || user.photoURL || null,
      };

      const token = await user.getIdToken();
      const payload = new FormData();
      payload.append('text', postData.text || '');
      payload.append('category', postData.category || 'altalanos');
      payload.append('tags', JSON.stringify(postData.tags || []));
      payload.append('market', postData.market || market);
      payload.append('isAnonymous', String(Boolean(postData.isAnonymous)));
      payload.append('imageUrl', postData.imageUrl || '');
      payload.append('style', JSON.stringify(postData.style || null));

      const createResponse = await withTimeout(
        fetch('/api/community-posts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: payload,
        }),
        20000,
        market === 'de' ? 'Zeitueberschreitung beim Veroeffentlichen des Beitrags.' : 'Időtúllépés a poszt közzététele közben.'
      );

      if (!createResponse.ok) {
        const errorBody = await createResponse.json().catch(() => ({}));
        throw new Error(errorBody?.error || (market === 'de' ? 'Beitrag konnte nicht gespeichert werden.' : 'A poszt mentése sikertelen.'));
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating community post:', error);
      window.__pmLastPostError = {
        message: error?.message || 'unknown',
        code: error?.code || null,
        at: new Date().toISOString(),
      };
      if (error?.code === 'permission-denied') {
        setSubmitError(market === 'de'
          ? 'Der Beitrag konnte wegen fehlender Berechtigung nicht gespeichert werden. Bitte Seite neu laden und erneut versuchen.'
          : 'A poszt mentése jogosultsági hiba miatt nem sikerült. Frissítsd az oldalt, majd próbáld újra.');
      } else {
        setSubmitError((market === 'de' ? 'Fehler beim Erstellen des Beitrags: ' : 'Hiba a poszt létrehozásakor: ') + (error?.message || 'ismeretlen hiba'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = CATEGORIES.find(c => c.id === category);

  // Scrollba hozás amikor a textarea fókuszt kap (iOS billentyűzet)
  const handleTextareaFocus = () => {
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50" style={{ touchAction: 'pan-y' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Fullscreen scrollable wrapper */}
      <div
        className="absolute inset-0 overflow-y-scroll overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Spacer top */}
        <div className="h-2 sm:h-[10vh]" />

        {/* Modal card */}
        <div className={`relative w-[calc(100%-16px)] sm:max-w-lg mx-auto rounded-2xl shadow-2xl ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {market === 'de' ? 'Neuen Beitrag erstellen' : 'Új poszt létrehozása'}
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
              {market === 'de' ? 'Beitrag anonym posten' : 'Poszt küldése anonimként'}
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
            <span>{getCategoryLabel(selectedCategory.id, market)}</span>
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
                  <span>{getCategoryLabel(cat.id, market)}</span>
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
            <span>{market === 'de' ? 'Stil anpassen' : 'Stílus testreszabása'}</span>
            {showStylePanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showStylePanel && (
            <div className={`mt-2 p-3 rounded-xl border space-y-4 ${
              darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              {/* Színsémák */}
              <div>
                <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {market === 'de' ? 'Farbschemata' : 'Színsémák'}
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
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Hintergrund' : 'Háttér'}</label>
                  <input
                    type="color"
                    value={style.backgroundColor}
                    onChange={(e) => setStyle(s => ({ ...s, backgroundColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Text' : 'Szöveg'}</label>
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
                    <Type className="w-3 h-3 inline mr-1" />{market === 'de' ? 'Schriftart' : 'Betűtípus'}
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
                    {market === 'de' ? 'Schriftgroesse' : 'Betűméret'}
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
                  ↺ {market === 'de' ? 'Standard wiederherstellen' : 'Alapértelmezés visszaállítása'}
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
            onChange={(e) => handleTextChange(e.target.value)}
            onInput={(e) => handleTextChange(e.currentTarget.value)}
            onPaste={handleTextPaste}
            onFocus={handleTextareaFocus}
            placeholder={market === 'de' ? 'Schreibe deine Gedanken...' : 'Írd meg a gondolataidat...'}
            rows={4}
            style={{
              backgroundColor: style.backgroundColor,
              color: style.textColor,
              fontSize: `${style.fontSize}px`,
              fontFamily: getFontFamilyCSS(style.fontFamily),
            }}
            className="w-full px-4 py-3 rounded-xl border resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className={`flex justify-end mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {text.length} {market === 'de' ? 'Zeichen' : 'karakter'}
          </div>
        </div>

        {/* Kép feltöltés */}
        <div className="px-4 mt-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt={market === 'de' ? 'Vorschau' : 'Előnézet'}
                className="max-h-48 rounded-xl object-cover border"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              <span>{market === 'de' ? 'Bild hinzufuegen' : 'Kép hozzáadása'}</span>
            </button>
          )}
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
                  placeholder={market === 'de' ? 'Tag hinzufuegen...' : 'Címke hozzáadása...'}
                  className={`text-xs border-none outline-none bg-transparent w-32 ${
                    darkMode ? 'text-gray-300 placeholder-gray-600' : 'text-gray-700 placeholder-gray-400'
                  }`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-3 border-t ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {isAnonymous ? (
              <><EyeOff className="w-3 h-3 inline mr-1" />{market === 'de' ? 'Anonyme Veroeffentlichung' : 'Anonim közzététel'}</>
            ) : (
              <><Eye className="w-3 h-3 inline mr-1" />{market === 'de' ? 'Oeffentliche Veroeffentlichung' : 'Nyilvános közzététel'}</>
            )}
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting || imageUploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
          >
            <Send className="w-4 h-4" />
            {imageUploading ? (market === 'de' ? 'Bild wird hochgeladen...' : 'Kép feltöltése...') : submitting ? (market === 'de' ? 'Wird veroeffentlicht...' : 'Közzététel...') : (market === 'de' ? 'Veroeffentlichen' : 'Közzététel')}
          </button>
        </div>

        {submitError && (
          <div className={`mx-4 mb-3 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-red-900/60 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {submitError}
          </div>
        )}
        </div>{/* end modal card */}

        {/* Bottom spacer for keyboard */}
        <div className="h-[50vh]" />
      </div>{/* end scrollable wrapper */}
    </div>
  );
}

// ============================================
// COMMENT THREAD (FULLSCREEN) - Subcollection based
// ============================================
const COMMENTS_PER_PAGE = 10;

function CommentThread({ postId, postText, postUserId, postIsAnonymous, darkMode, user, userData, isAdmin, onUpdate, onClose, autoFocus }) {
  const market = getClientMarket();
  const [rootComments, setRootComments] = useState([]);
  const [repliesMap, setRepliesMap] = useState({}); // { commentId: [replies] }
  const [expandedReplies, setExpandedReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyToComment, setReplyToComment] = useState(null);
  const [isAnonComment, setIsAnonComment] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showInput, setShowInput] = useState(false); // Show inline input
  const [reportComment, setReportComment] = useState(null); // Comment being reported
  const [showReportModal, setShowReportModal] = useState(false);
  const longPressTimer = useRef(null);
  const inputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const commentsEndRef = useRef(null);

  const commentsColRef = collection(db, 'communityPosts', postId, 'comments');

  // Long press handlers for comment reporting
  const handleLongPressStart = (item) => {
    longPressTimer.current = setTimeout(() => {
      setReportComment(item);
      setShowReportModal(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Focus input when shown
  useEffect(() => {
    if (showInput) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [showInput, replyTo]);

  useEffect(() => {
    if (autoFocus) {
      setShowInput(true);
    }
  }, [autoFocus]);

  // Load root comments (parentCommentId == null)
  const loadRootComments = useCallback(async (afterDoc = null) => {
    try {
      let q;
      if (afterDoc) {
        q = query(commentsColRef, where('parentCommentId', '==', null), orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(COMMENTS_PER_PAGE));
      } else {
        q = query(commentsColRef, where('parentCommentId', '==', null), orderBy('createdAt', 'desc'), limit(COMMENTS_PER_PAGE));
      }
      const snapshot = await getDocs(q);
      const newComments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (afterDoc) {
        setRootComments(prev => [...prev, ...newComments]);
      } else {
        setRootComments(newComments);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === COMMENTS_PER_PAGE);
    } catch (error) {
      console.error('Error loading root comments:', error);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [postId]);

  useEffect(() => {
    loadRootComments();
  }, [loadRootComments]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    await loadRootComments(lastDoc);
  };

  // Load replies for a specific comment
  const loadReplies = async (commentId) => {
    setLoadingReplies(prev => ({ ...prev, [commentId]: true }));
    try {
      const q = query(commentsColRef, where('parentCommentId', '==', commentId), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const replies = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRepliesMap(prev => ({ ...prev, [commentId]: replies }));
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      setLoadingReplies(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const toggleReplies = async (commentId) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies(prev => ({ ...prev, [commentId]: false }));
    } else {
      setExpandedReplies(prev => ({ ...prev, [commentId]: true }));
      if (!repliesMap[commentId]) {
        await loadReplies(commentId);
      }
    }
  };

  // Add comment with OPTIMISTIC update
  const handleAddComment = async () => {
    if (!commentText.trim() || submitting || !user) return;
    setSubmitting(true);

    const optimisticComment = {
      id: 'temp_' + Date.now(),
      parentCommentId: replyTo || null,
      text: commentText.trim(),
      userId: user.uid,
      isAnonymous: isAnonComment,
      authorData: {
        displayName: userData?.displayName || user.displayName || 'Felhasználó',
        photoURL: userData?.photoURL || user.photoURL || null,
      },
      createdAt: new Date(),
      replyCount: 0,
      _optimistic: true,
    };

    // Optimistic: show immediately
    if (replyTo) {
      setRepliesMap(prev => ({
        ...prev,
        [replyTo]: [...(prev[replyTo] || []), optimisticComment]
      }));
      setExpandedReplies(prev => ({ ...prev, [replyTo]: true }));
      // Update parent replyCount locally
      setRootComments(prev => prev.map(c =>
        c.id === replyTo ? { ...c, replyCount: (c.replyCount || 0) + 1 } : c
      ));
      // Also check in repliesMap
      setRepliesMap(prev => {
        const updated = { ...prev };
        for (const [parentId, replies] of Object.entries(updated)) {
          updated[parentId] = replies.map(r =>
            r.id === replyTo ? { ...r, replyCount: (r.replyCount || 0) + 1 } : r
          );
        }
        return updated;
      });
    } else {
      setRootComments(prev => [optimisticComment, ...prev]);
    }

    const savedText = commentText.trim();
    const savedReplyTo = replyTo;
    setCommentText('');
    setReplyTo(null);
    setReplyToComment(null);
    setShowInput(false);

    try {
      const newComment = {
        parentCommentId: savedReplyTo || null,
        text: savedText,
        userId: user.uid,
        isAnonymous: isAnonComment,
        authorData: optimisticComment.authorData,
        createdAt: serverTimestamp(),
        replyCount: 0,
      };

      await addDoc(commentsColRef, newComment);

      const postRef = doc(db, 'communityPosts', postId);
      await updateDoc(postRef, { commentCount: increment(1) });

      if (postUserId && postUserId !== user.uid) {
        const commenterName = isAnonComment
          ? (market === 'de' ? 'Anonymer Nutzer' : 'Anonim felhasználó')
          : (userData?.displayName || user.displayName || (market === 'de' ? 'Nutzer/in' : 'Felhasználó'));
        const postOwnerLabel = postIsAnonymous
          ? (market === 'de' ? 'deinem anonymen Beitrag' : 'anonim posztodhoz')
          : (market === 'de' ? 'deinem Beitrag' : 'posztodhoz');
        try {
          await createNotificationWithPush({
            userId: postUserId,
            type: 'community_post_comment',
            title: market === 'de' ? 'Neuer Kommentar' : 'Új hozzászólás érkezett',
            message: market === 'de'
              ? `${commenterName} hat ${postOwnerLabel} kommentiert.`
              : `${commenterName} hozzászólt a ${postOwnerLabel}.`,
            data: {
              postId,
              commenterUserId: user.uid,
              commenterName,
              isAnonymousComment: isAnonComment,
            },
            url: `/post/${postId}?collection=communityPosts`,
            dedupeWindowSeconds: 90,
            dedupeByDataKeys: ['postId', 'commenterUserId', 'isAnonymousComment'],
          });
        } catch (notificationError) {
          console.error('Comment notification error:', notificationError);
        }
      }

      if (savedReplyTo) {
        const parentRef = doc(db, 'communityPosts', postId, 'comments', savedReplyTo);
        await updateDoc(parentRef, { replyCount: increment(1) });

        try {
          const parentSnap = await getDoc(parentRef);
          const parentComment = parentSnap.exists() ? parentSnap.data() : null;
          const parentCommentUserId = parentComment?.userId || null;

          if (parentCommentUserId && parentCommentUserId !== user.uid) {
            const commenterName = isAnonComment
              ? (market === 'de' ? 'Anonymer Nutzer' : 'Anonim felhasználó')
              : (userData?.displayName || user.displayName || (market === 'de' ? 'Nutzer/in' : 'Felhasználó'));

            await createNotificationWithPush({
              userId: parentCommentUserId,
              type: 'community_comment_reply',
              title: market === 'de' ? 'Neue Antwort' : 'Új válasz érkezett',
              message: market === 'de'
                ? `${commenterName} hat auf deinen Kommentar geantwortet.`
                : `${commenterName} válaszolt a hozzászólásodra.`,
              data: {
                postId,
                parentCommentId: savedReplyTo,
                commenterUserId: user.uid,
                commenterName,
                isAnonymousComment: isAnonComment,
              },
              url: `/post/${postId}?collection=communityPosts`,
              dedupeWindowSeconds: 90,
              dedupeByDataKeys: ['postId', 'parentCommentId', 'commenterUserId', 'isAnonymousComment'],
            });
          }
        } catch (replyNotificationError) {
          console.error('Reply notification error:', replyNotificationError);
        }

        await loadReplies(savedReplyTo);
      } else {
        await loadRootComments();
      }

      onUpdate();
    } catch (error) {
      console.error('Error adding comment:', error);
      // Revert optimistic update on error
      if (savedReplyTo) {
        setRepliesMap(prev => ({
          ...prev,
          [savedReplyTo]: (prev[savedReplyTo] || []).filter(c => c.id !== optimisticComment.id)
        }));
      } else {
        setRootComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId, newText) => {
    if (!newText.trim()) return;
    try {
      const commentRef = doc(db, 'communityPosts', postId, 'comments', commentId);
      await updateDoc(commentRef, { text: newText.trim() });
      setEditingId(null);
      setEditingText('');
      if (rootComments.find(c => c.id === commentId)) {
        setRootComments(prev => prev.map(c => c.id === commentId ? { ...c, text: newText.trim() } : c));
      } else {
        for (const [parentId, replies] of Object.entries(repliesMap)) {
          if (replies.find(r => r.id === commentId)) {
            setRepliesMap(prev => ({
              ...prev,
              [parentId]: prev[parentId].map(r => r.id === commentId ? { ...r, text: newText.trim() } : r)
            }));
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  // Delete comment
  const handleDeleteComment = async (comment) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a hozzászólást?')) return;
    try {
      const commentRef = doc(db, 'communityPosts', postId, 'comments', comment.id);
      await deleteDoc(commentRef);

      // Update local state
      if (!comment.parentCommentId) {
        setRootComments(prev => prev.filter(c => c.id !== comment.id));
      } else {
        setRepliesMap(prev => {
          const updated = { ...prev };
          for (const [parentId, replies] of Object.entries(updated)) {
            updated[parentId] = replies.filter(r => r.id !== comment.id);
          }
          return updated;
        });
        // Decrement parent replyCount
        const parentRef = doc(db, 'communityPosts', postId, 'comments', comment.parentCommentId);
        await updateDoc(parentRef, { replyCount: increment(-1) }).catch(() => {});
      }

      // Decrement post commentCount
      const postRef = doc(db, 'communityPosts', postId);
      await updateDoc(postRef, { commentCount: increment(-1) });
      onUpdate();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const formatCommentTime = (timestamp) => {
    if (!timestamp) return 'most';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'most';
    if (diff < 3600) return `${Math.floor(diff / 60)} p`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ó.`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} n.`;
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${date.toLocaleDateString('hu-HU')} ${hours}:${mins}`;
  };

  const handleReplyTap = (comment) => {
    if (replyTo === comment.id && showInput) {
      // Toggle off
      setReplyTo(null);
      setReplyToComment(null);
      setCommentText('');
      setShowInput(false);
    } else {
      setReplyTo(comment.id);
      setReplyToComment(comment);
      // Pre-fill @mention like FB
      const name = comment.isAnonymous !== false ? 'Anonim' : (comment.authorData?.displayName || 'Felhasználó');
      setCommentText(name + ' ');
      setShowInput(true);
    }
  };

  const renderAvatar = (item, size = 'md') => {
    const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
    if (item.isAnonymous !== false) {
      return (
        <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${
          darkMode ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <EyeOff className={`${iconSize} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        </div>
      );
    }
    return (
      <img
        src={item.authorData?.photoURL || '/default-avatar.svg'}
        alt=""
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  };

  const getDisplayName = (item) => {
    return item.isAnonymous !== false ? 'Anonim felhasználó' : (item.authorData?.displayName || 'Felhasználó');
  };

  const getAdminName = (item) => {
    if (isAdmin && item.isAnonymous !== false && item.authorData?.displayName) {
      return item.authorData.displayName;
    }
    return null;
  };

  const replyingToName = replyToComment
    ? (replyToComment.isAnonymous !== false ? 'Anonim felhasználó' : (replyToComment.authorData?.displayName || 'Felhasználó'))
    : '';

  const currentUserDisplayName = userData?.displayName || user?.displayName || 'Felhasználó';

  // Render a single comment
  const renderComment = (item, depth) => {
    if (depth > 20) return null;
    const isTopLevel = depth === 0;
    const avatarSize = isTopLevel ? 'md' : 'sm';
    const indent = Math.min(depth, 3);
    const replies = repliesMap[item.id] || [];
    const replyCount = item.replyCount || 0;
    const isExpanded = expandedReplies[item.id];
    const isLoading = loadingReplies[item.id];

    return (
      <div key={item.id} style={{ marginLeft: depth > 0 ? `${indent * 12}px` : 0 }} className={`${isTopLevel ? 'py-2' : 'py-1'}`}>
        <div className="flex gap-2">
          <div className="flex-shrink-0 pt-0.5">
            {renderAvatar(item, avatarSize)}
          </div>
          <div
            className="flex-1 min-w-0"
            onTouchStart={() => handleLongPressStart(item)}
            onTouchEnd={handleLongPressEnd}
            onTouchMove={handleLongPressEnd}
            onContextMenu={(e) => { e.preventDefault(); setReportComment(item); }}
          >
            {editingId === item.id ? (
              <div>
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditComment(item.id, editingText); }}
                  autoFocus
                  className={`w-full px-3 py-2 rounded-2xl text-sm border ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                  }`}
                />
                <div className="flex gap-3 mt-1 ml-2">
                  <button
                    onClick={() => { setEditingId(null); setEditingText(''); }}
                    className="text-xs text-gray-500"
                  >
                    {market === 'de' ? 'Abbrechen' : 'Mégsem'}
                  </button>
                  <button
                    onClick={() => handleEditComment(item.id, editingText)}
                    className="text-xs font-semibold text-blue-600"
                  >
                    {market === 'de' ? 'Speichern' : 'Mentés'}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditingText(''); handleDeleteComment(item); }}
                    className="text-xs font-semibold text-red-500"
                  >
                    {market === 'de' ? 'Loeschen' : 'Törlés'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={`inline-block rounded-2xl px-3 py-1.5 max-w-full ${
                  darkMode ? 'bg-gray-700' : 'bg-[#f0f2f5]'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold text-[13px] leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {getDisplayName(item)}
                    </span>
                    {getAdminName(item) && (
                      <span className={`text-[10px] px-1 py-0.5 rounded ${darkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>
                        {getAdminName(item)}
                      </span>
                    )}
                  </div>
                  <p className={`text-[15px] leading-snug whitespace-pre-wrap break-words ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {item.text}
                  </p>
                </div>

                <div className="flex items-center gap-4 mt-0.5 ml-2">
                  <span className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{formatCommentTime(item.createdAt)}</span>
                  <button
                    onClick={() => handleReplyTap(item)}
                    className={`text-[12px] font-bold ${
                      replyTo === item.id
                        ? 'text-blue-600'
                        : darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {market === 'de' ? 'Antworten' : 'Válasz'}
                  </button>
                  {(isAdmin || item.userId === user?.uid) && (
                    <button
                      onClick={() => { setEditingId(item.id); setEditingText(item.text); }}
                      className={`text-[12px] font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      {market === 'de' ? 'Bearbeiten' : 'Szerkesztés'}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Nested replies */}
            {replyCount > 0 && (
              <div className="mt-1">
                {!isExpanded ? (
                  <button
                    onClick={() => toggleReplies(item.id)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 dark:text-blue-400 ml-2 py-1"
                  >
                    <span>↳</span>
                    <span>{isLoading ? t('loading', market) : `${replyCount} ${market === 'de' ? 'Antworten' : 'válasz'}`}</span>
                  </button>
                ) : (
                  <div>
                    {isLoading ? (
                      <div className="flex items-center gap-2 py-2 ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        <span className="text-xs text-gray-500">{t('loading', market)}</span>
                      </div>
                    ) : (
                      replies.map((reply) => renderComment(reply, depth + 1))
                    )}
                    {/* Only show hide button for root level comments (depth 0) */}
                    {depth === 0 && replies.length > 0 && (
                      <button
                        onClick={() => toggleReplies(item.id)}
                        className="text-[12px] font-semibold text-gray-500 ml-2 py-0.5"
                      >
                        {market === 'de' ? 'Antworten ausblenden' : 'Válaszok elrejtése'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <div className={`flex items-center px-3 py-2.5 border-b flex-shrink-0 pt-safe-small ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <button
          onClick={onClose}
          className={`p-2 -ml-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
        >
          <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-white' : 'text-gray-900'}`} />
        </button>
        <h2 className={`ml-2 text-base font-bold truncate flex-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {market === 'de' ? 'Kommentare' : 'Hozzászólások'}
        </h2>
      </div>

      {/* Post text preview */}
      {postText && (
        <div className={`px-4 py-3 border-b flex-shrink-0 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <p className={`text-sm line-clamp-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{postText}</p>
        </div>
      )}

      {/* Scrollable comments area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-3 min-h-0" 
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {initialLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rootComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <MessageCircle className={`w-14 h-14 mb-3 ${darkMode ? 'text-gray-700' : 'text-gray-200'}`} />
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {market === 'de' ? 'Sei der/die Erste mit einem Kommentar!' : 'Légy az első hozzászóló!'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {rootComments.map((comment) => renderComment(comment, 0))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className={`w-full py-3 text-[13px] font-semibold transition-colors ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`}
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    {t('loading', market)}
                  </span>
                ) : (market === 'de' ? 'Fruehere Kommentare...' : 'Korábbi hozzászólások...')}
              </button>
            )}
          </div>
        )}

        <div ref={commentsEndRef} />
      </div>

      {/* Fixed overlay input - always centered on visible viewport */}
      {showInput && (
        <div 
          className="fixed left-0 right-0 z-[60] px-3"
          style={{ bottom: '50%' }}
        >
          <div 
            ref={inlineInputRef}
            className={`p-3 rounded-2xl border shadow-2xl ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            {/* Reply indicator */}
            {replyTo && replyToComment && (
              <div className={`mb-2 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {market === 'de' ? 'Antwort an' : 'Válasz'} <span className="font-semibold">{replyingToName}</span> {market === 'de' ? '' : 'számára'}
                  <span className="mx-1.5">·</span>
                  <button 
                    onClick={() => { setReplyTo(null); setReplyToComment(null); setCommentText(''); setShowInput(false); }} 
                    className="font-semibold text-blue-600"
                  >
                    {market === 'de' ? 'Abbrechen' : 'Mégsem'}
                  </button>
                </p>
              </div>
            )}

            {/* Anonymity checkbox */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setIsAnonComment(!isAnonComment)}
                className="flex items-center gap-2 py-1"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isAnonComment
                    ? 'bg-purple-600 border-purple-600'
                    : darkMode ? 'border-gray-500 bg-transparent' : 'border-gray-400 bg-transparent'
                }`}>
                  {isAnonComment && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-[13px] ${
                  isAnonComment
                    ? darkMode ? 'text-purple-300 font-medium' : 'text-purple-600 font-medium'
                    : darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>{market === 'de' ? 'Anonym' : 'Anonim'}</span>
              </button>
              <button 
                onClick={() => { setShowInput(false); setCommentText(''); setReplyTo(null); setReplyToComment(null); }}
                className={`ml-auto text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                ✕ {market === 'de' ? 'Schliessen' : 'Bezárás'}
              </button>
            </div>

            {/* Input row */}
            <div className="flex items-center gap-2">
              <div className={`flex-1 flex items-center rounded-full ${
                darkMode ? 'bg-gray-700' : 'bg-[#f0f2f5]'
              }`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                  placeholder={replyTo ? '' : (market === 'de' ? `Kommentieren als ${isAnonComment ? 'Anonym' : currentUserDisplayName}` : `Hozzászólás mint ${isAnonComment ? 'Anonim' : currentUserDisplayName}`)}
                  className={`flex-1 pl-4 pr-1 py-2.5 rounded-full text-[15px] bg-transparent ${
                    darkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-500'
                  } focus:outline-none min-w-0`}
                />
              </div>
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || submitting}
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  commentText.trim() && !submitting
                    ? 'bg-blue-600 text-white'
                    : darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report comment modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => { setShowReportModal(false); setReportComment(null); }}
        reportType="comment"
        reportedUserId={reportComment?.authorId || null}
        reportedUserName={reportComment?.isAnonymous !== false ? (market === 'de' ? 'Anonym' : 'Anonim') : (reportComment?.authorData?.displayName || (market === 'de' ? 'Benutzer/in' : 'Felhasználó'))}
        itemId={reportComment?.id}
        itemContent={reportComment?.text}
      />

      {/* Bottom bar - New comment button (only when input not visible) */}
      {!showInput && (
        <div className={`flex-shrink-0 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-3 py-2">
            <button
              onClick={() => { setReplyTo(null); setReplyToComment(null); setCommentText(''); setShowInput(true); }}
              className={`w-full py-3 rounded-full text-[15px] font-medium ${
                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-[#f0f2f5] text-gray-500'
              }`}
            >
              {market === 'de' ? 'Kommentar schreiben...' : 'Hozzászólás írása...'}
            </button>
          </div>
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      )}
    </div>
  );
}

// ============================================
// SINGLE POST CARD
// ============================================
function PostCard({ post, darkMode, user, userData, isAdmin, onUpdate, onAnonClick, compactView, hideReactions }) {
  const market = getClientMarket();
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCommentThread, setShowCommentThread] = useState(false);
  const [autoFocusComment, setAutoFocusComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleAuthorClick = () => {
    if (post.isAnonymous) {
      if (onAnonClick) onAnonClick();
    } else if (post.userId) {
      postRouter.push(`/profil/${post.userId}`);
    }
  };
  const [showReportModal, setShowReportModal] = useState(false);
  const menuRef = useRef(null);
  const reactionsRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  useEffect(() => {
    if (!showReactions) return;
    const handleClickOutside = (e) => {
      if (reactionsRef.current && !reactionsRef.current.contains(e.target)) {
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showReactions]);

  const userReaction = user ? post.reactions?.[user.uid] : null;

  const commentCount = post.commentCount || 0;

  const getReactionSummary = () => {
    if (!post.reactions || Object.keys(post.reactions).length === 0) return null;
    const counts = {};
    Object.values(post.reactions).forEach(type => {
      if (type) counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  };

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

        if (post.userId && post.userId !== user.uid) {
          const reactionLabel = REACTIONS.find(r => r.type === type)?.label || 'reakciót';
          const reactorName = userData?.displayName || user.displayName || (market === 'de' ? 'Jemand' : 'Valaki');
          try {
            await createNotificationWithPush({
              userId: post.userId,
              type: 'community_post_reaction',
              title: market === 'de' ? 'Neue Reaktion' : 'Új reakció érkezett',
              message: market === 'de'
                ? `${reactorName} hat auf deinen Beitrag reagiert.`
                : `${reactorName} reagált a posztodra.`,
              data: {
                postId: post.id,
                reactorUserId: user.uid,
                reactionType: type,
              },
              url: `/post/${post.id}?collection=communityPosts`,
            });
          } catch (notificationError) {
            console.error('Reaction notification error:', notificationError);
          }
        }
      }
      onUpdate();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const handleReport = () => {
    if (!user) return;
    setShowMenu(false);
    setShowReportModal(true);
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

  const handleStartEdit = () => {
    setEditText(post.text);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editSubmitting) return;
    setEditSubmitting(true);
    try {
      await updateDoc(doc(db, 'communityPosts', post.id), { text: editText.trim() });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error editing post:', error);
    } finally {
      setEditSubmitting(false);
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
    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Header */}
      <div className="py-3 flex items-start justify-between px-3 sm:px-4">
        <div className="flex gap-3">
          {/* Avatar */}
          {post.isAnonymous ? (
            <button onClick={handleAuthorClick} className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              darkMode ? 'bg-gradient-to-br from-gray-600 to-gray-700' : 'bg-gradient-to-br from-gray-200 to-gray-300'
            }`}>
              <Users className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
            </button>
          ) : (
            <img
              src={post.authorData?.photoURL || '/default-avatar.svg'}
              alt={post.authorData?.displayName || 'Felhasználó'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {post.isAnonymous ? (
                <button onClick={handleAuthorClick} className="text-left">
                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Anonim felhasználó
                  </span>
                </button>
              ) : (
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {post.authorData?.displayName || 'Felhasználó'}
                </span>
              )}
              {isAdmin && post.isAnonymous && post.authorData?.displayName && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${darkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>
                  {post.authorData.displayName}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryData.color}`}>
                {categoryData.emoji} {getCategoryLabel(categoryData.id, market)}
              </span>

            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatTime(post.createdAt)}
            </p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {showMenu && (
            <div className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-10 overflow-hidden ${
              darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
            }`}>
              <button
                onClick={handleReport}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${
                  darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Flag className="w-4 h-4" />
                {market === 'de' ? 'Melden' : 'Jelentés'}
              </button>
              {(isAdmin || post.userId === user?.uid) && (
                <button
                  onClick={handleStartEdit}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${
                    darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  {market === 'de' ? 'Bearbeiten' : 'Szerkesztés'}
                </button>
              )}
              {(isAdmin || post.userId === user?.uid) && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  {market === 'de' ? 'Loeschen' : 'Törlés'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pb-2">
        {isEditing ? (
          <div className="px-3 sm:px-4">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className={`w-full px-4 py-3 rounded-xl border resize-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Mégsem
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim() || editSubmitting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {editSubmitting ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        ) : post.style ? (
          <div
            className="mx-3 sm:mx-4 p-4 rounded-xl whitespace-pre-wrap"
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
          <p className={`whitespace-pre-wrap px-3 sm:px-4 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {post.text}
          </p>
        )}

        {/* Poszt kép */}
        {post.imageUrl && (
          <div className="px-3 sm:px-4 pt-2">
            <img
              src={post.imageUrl}
              alt="Poszt kép"
              className="w-full max-h-96 object-cover rounded-xl cursor-pointer"
              onClick={() => window.open(post.imageUrl, '_blank')}
            />
          </div>
        )}
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-3 sm:px-4 pb-2 flex flex-wrap gap-1.5">
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
      {!hideReactions && reactionSummary && (
        <div className={`px-3 sm:px-4 pb-1.5 flex flex-wrap items-center gap-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {Object.entries(reactionSummary)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => {
              const reaction = REACTIONS.find(r => r.type === type);

              return (
                <span
                  key={type}
                  className="inline-flex items-center gap-1"
                  title={getReactionLabel(type, market)}
                  aria-label={`${getReactionLabel(type, market)}: ${count}`}
                >
                  <span className="text-lg leading-none">{reaction?.emoji}</span>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </span>
              );
            })}
        </div>
      )}

      {/* Action bar */}
      <div className={`border-t py-2 flex items-center justify-around px-3 sm:px-4 ${
        darkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        {/* Reaction button */}
        <div className="relative" ref={reactionsRef}>
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
            <span>{userReaction ? getReactionLabel(userReaction, market) : t('reaction', market)}</span>
          </button>

          {/* Reaction picker */}
          {showReactions && (
            <div className={`absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-2xl shadow-xl border z-20 ${
              darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
            }`}>
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  onClick={() => handleReaction(r.type)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                  title={getReactionLabel(r.type, market)}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comment count button */}
        {commentCount > 0 && (
          <button
            onClick={() => { setAutoFocusComment(false); setShowCommentThread(true); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{commentCount} {t('commentsSuffix', market)}</span>
          </button>
        )}

        {/* Reply button */}
        <button
          onClick={() => { setAutoFocusComment(true); setShowCommentThread(true); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{t('reply', market)}</span>
        </button>
      </div>

      {/* Comment thread fullscreen - portal to body */}
      {showCommentThread && typeof document !== 'undefined' && createPortal(
        <CommentThread
          postId={post.id}
          postText={post.text}
          postUserId={post.userId}
          postIsAnonymous={post.isAnonymous}
          darkMode={darkMode}
          user={user}
          userData={userData}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
          onClose={() => { setShowCommentThread(false); setAutoFocusComment(false); }}
          autoFocus={autoFocusComment}
        />,
        document.body
      )}

      {/* Report modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportType="communityPost"
        reportedUserId={post.userId}
        reportedUserName={post.isAnonymous ? 'Anonim' : (post.authorName || 'Felhasználó')}
        itemId={post.id}
        itemContent={post.text}
      />
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================
// Anonim posztok elrejtése modal
function AnonSettingsModal({ isOpen, onClose, darkMode, hideAnon, onToggle }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 pb-safe-bottom mb-[env(safe-area-inset-bottom)]`}
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 80px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Anonim felhasználó
          </h3>
          <button onClick={onClose} className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className={`text-sm mb-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Ez egy anonim poszt. A szerző személyazonosságát nem lehet megtekinteni.
        </p>
        <div className={`flex items-center justify-between p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className="mr-3">
            <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Anonim posztok elrejtése</p>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Nem látod az anonim posztokat a hírfolyamban</p>
          </div>
          <button
            onClick={onToggle}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
              hideAnon ? 'bg-purple-600' : darkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              hideAnon ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KozossegPage() {
  const market = getClientMarket();
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();
  const pharmaRole = getEffectivePharmagisterRole(userData);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [hideAnonymous, setHideAnonymous] = useState(false);
  const [showAnonModal, setShowAnonModal] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [hideReactions, setHideReactions] = useState(false);
  const activeFilter = 'all';

  const isAdmin = [ADMIN_EMAIL, ADMINKA_EMAIL].includes(user?.email);
  const isAdminka = user?.email === ADMINKA_EMAIL;

  // Load blocked users & anon pref
  useEffect(() => {
    if (!user) return;
    // Load blocked users
    const loadBlocked = async () => {
      try {
        const q = query(collection(db, 'blockedUsers'), where('blockerId', '==', user.uid));
        const snap = await getDocs(q);
        setBlockedUserIds(snap.docs.map(d => d.data().blockedUserId));
      } catch (e) { console.error('Error loading blocked users:', e); }
    };
    // Load hideAnonymous preference
    const loadPref = async () => {
      try {
        const prefDoc = await getDoc(doc(db, 'userSettings', user.uid));
        if (prefDoc.exists()) {
          const data = prefDoc.data();
          if (data.hideAnonymousPosts) setHideAnonymous(true);
          if (data.compactView) setCompactView(true);
          if (data.hideReactions) setHideReactions(true);
        }
      } catch (e) { console.error('Error loading user settings:', e); }
    };
    loadBlocked();
    loadPref();
  }, [user]);

  const toggleHideAnonymous = async () => {
    const newVal = !hideAnonymous;
    setHideAnonymous(newVal);
    if (user) {
      try {
        await setDoc(doc(db, 'userSettings', user.uid), { hideAnonymousPosts: newVal }, { merge: true });
      } catch (e) { console.error('Error saving anon pref:', e); }
    }
  };

  const openCreateModal = () => {
    if (!pharmaRole) {
      router.replace('/pharmagister');
      return;
    }
    setShowCreateModal(true);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    if (!pharmaRole) {
      router.replace('/pharmagister');
    }
  }, [authLoading, user, pharmaRole, router]);

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

  // Filter posts client-side: blocked users + anonymous
  const filteredPosts = posts.filter(p => {
    if (!isDocInMarket(p, market)) return false;
    if (market === 'de' && looksHungarianText(p.text)) return false;
    if (blockedUserIds.includes(p.userId)) return false;
    if (hideAnonymous && p.isAnonymous) return false;
    return true;
  });

  // Auth guard - only admin can see for now
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!pharmaRole) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header + Navigációs gombok + Írj valamit */}
      <div
        className="pt-safe-small pb-4"
      >
        {/* Pharmagister felirat */}
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-center min-h-[56px]">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-1">
            <span className="text-green-700 text-lg sm:text-xl bg-white/80 backdrop-blur-[2px] px-3 py-1 rounded-lg shadow-sm">Pharmagister</span>
          </h1>
        </div>

        {/* Navigációs gombok */}
        <div className="px-3 pb-3">
          <div className="max-w-xl mx-auto grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push('/hianycikk-kereso')}
              className="flex items-center justify-start gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/95 shadow-sm border border-white/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MarketGlyph className="w-4 h-4 flex-shrink-0" />
              </span>
              <span>{t('shortageSearch', market)}</span>
            </button>
            <button
              onClick={() => router.push('/pm-hirfolyam')}
              className="flex items-center justify-start gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/95 shadow-sm border border-white/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <SignalPaperGlyph className="w-4 h-4 flex-shrink-0" />
              </span>
              <span>{t('pmFeed', market)}</span>
            </button>
            <button
              onClick={() => router.push('/hirek')}
              className="flex items-center justify-start gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/95 shadow-sm border border-white/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <SignalPaperGlyph className="w-4 h-4 flex-shrink-0" />
              </span>
              <span>{t('news', market)}</span>
            </button>
            <button
              onClick={() => router.push('/pharmagister/allando-keres')}
              className="flex items-center justify-start gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/95 shadow-sm border border-white/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <SearchPulseGlyph className="w-4 h-4 flex-shrink-0" />
              </span>
              <span>{t('jobSearch', market)}</span>
            </button>
            <button
              onClick={() => router.push('/pharmagister/eszkozpiacter')}
              className="flex items-center justify-start gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/95 shadow-sm border border-white/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600">
                <MarketCubeGlyph className="w-4 h-4 flex-shrink-0" />
              </span>
              <span>{market === 'de' ? 'Marktplatz' : 'Piactér'}</span>
            </button>
          </div>
        </div>

        {/* Create post prompt */}
        <div className="mx-4 rounded-2xl p-4 bg-white/30 backdrop-blur-[2px] shadow-sm">
          <button
            onClick={openCreateModal}
            className="w-full flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/40">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 text-left px-4 py-2.5 rounded-full bg-white/40 text-gray-600">
              {t('writeSomething', market)}
            </div>
          </button>
        </div>
      </div>

      {/* Posts feed */}
      <div className="mx-4 mt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className={`text-center py-16 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <MessageCircle className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {t('noPostsTitle', market)}
            </h3>
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('noPostsDesc', market)}
            </p>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              {market === 'de' ? 'Beitrag erstellen' : 'Poszt létrehozása'}
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              darkMode={darkMode}
              user={user}
              userData={userData}
              isAdmin={isAdmin || isAdminka}
              onUpdate={fetchPosts}
              onAnonClick={() => setShowAnonModal(true)}
              compactView={compactView}
              hideReactions={hideReactions}
            />
          ))
        )}
      </div>

      {/* Floating create button */}
      <button
        onClick={openCreateModal}
        className="fixed bottom-24 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create post modal */}
      {showCreateModal && (
        <CreatePostModal
          darkMode={darkMode}
          user={user}
          userData={userData}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchPosts}
        />
      )}

      {/* Anon settings modal */}
      <AnonSettingsModal
        isOpen={showAnonModal}
        onClose={() => setShowAnonModal(false)}
        darkMode={darkMode}
        hideAnon={hideAnonymous}
        onToggle={toggleHideAnonymous}
      />
    </div>
  );
}
