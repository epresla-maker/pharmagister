"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { Trash2, Send, EyeOff, Eye, Palette, Type, Image, ChevronDown, ChevronUp, X } from 'lucide-react';
import { getClientMarket, getLocalizedDemandPositionLabel } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';

// Előre definiált színsémák
const COLOR_PRESETS = [
  { name: 'Alapértelmezett', bg: '#ffffff', text: '#000000' },
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
  { value: 'sans', label: 'Sans-serif (alapértelmezett)' },
  { value: 'serif', label: 'Serif (elegáns)' },
  { value: 'mono', label: 'Monospace (kód)' },
  { value: 'cursive', label: 'Cursive (kézírásos)' },
];

const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28, 32];

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

export default function AdminPostsPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const [postText, setPostText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posts, setPosts] = useState([]);
  const [rssPosts, setRssPosts] = useState([]);
  const [hiddenRssIds, setHiddenRssIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Stílus beállítások
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [style, setStyle] = useState({
    backgroundColor: '#ffffff',
    textColor: '#000000',
    fontSize: 16,
    fontFamily: 'sans',
  });

  const textareaRef = useRef(null);
  const hasCustomStyle = style.backgroundColor !== '#ffffff' || style.textColor !== '#000000' || style.fontSize !== 16 || style.fontFamily !== 'sans';

  const getFontFamilyCSS = (family) => {
    switch (family) {
      case 'serif': return 'Georgia, serif';
      case 'mono': return 'monospace';
      case 'cursive': return 'cursive';
      default: return 'inherit';
    }
  };

  // Ellenőrizzük hogy admin-e
  useEffect(() => {
    if (user && userData && !ALL_ADMIN_EMAILS.includes(user.email)) {
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
      })).filter((post) => isDocInMarket(post, market));
      setPosts(postsData);
    });

    return () => unsubscribe();
  }, []);

  // RSS hírek és rejtett RSS ID-k betöltése
  useEffect(() => {
    const fetchRSSData = async () => {
      try {
        // Rejtett RSS ID-k betöltése
        const hiddenSnapshot = await getDocs(collection(db, 'hiddenRssPosts'));
        const hiddenIds = new Set(hiddenSnapshot.docs.map(doc => doc.id));
        setHiddenRssIds(hiddenIds);

        // RSS hírek betöltése az API-ból
        const response = await fetch('/api/rss/semmelweis');
        const data = await response.json();
        
        if (data.success) {
          setRssPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Error fetching RSS data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRSSData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!postText.trim()) return;

    setIsSubmitting(true);
    try {
      const postData = {
        userId: user.uid,
        market,
        text: postText,
        postType: 'adminPost',
        createdAt: serverTimestamp(),
        authorData: {
          displayName: userData?.displayName || 'Admin',
          photoURL: userData?.photoURL || null
        },
        comments: [],
        reactions: {}
      };

      // Stílus hozzáadása ha van egyedi beállítás
      if (hasCustomStyle) {
        postData.style = {
          backgroundColor: style.backgroundColor,
          textColor: style.textColor,
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
        };
      }

      // Kép hozzáadása ha van
      if (imageUrl.trim()) {
        postData.imageUrl = imageUrl.trim();
      }

      await addDoc(collection(db, 'serviceFeedPosts'), postData);

      setPostText('');
      setImageUrl('');
      setStyle({ backgroundColor: '#ffffff', textColor: '#000000', fontSize: 16, fontFamily: 'sans' });
      setShowStylePanel(false);
      setShowPreview(false);
      alert(market === 'de' ? '✅ Beitrag erfolgreich erstellt!' : '✅ Poszt sikeresen létrehozva!');
    } catch (error) {
      console.error('Error creating post:', error);
      alert(market === 'de' ? '❌ Fehler beim Erstellen des Beitrags.' : '❌ Hiba történt a poszt létrehozásakor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId, postType, pharmaDemandId) => {
    if (!confirm(market === 'de' ? 'Moechtest du diesen Beitrag wirklich loeschen?' : 'Biztosan törölni szeretnéd ezt a posztot?')) return;

    try {
      // Poszt törlése a serviceFeedPosts-ból
      await deleteDoc(doc(db, 'serviceFeedPosts', postId));
      
      // Ha pharma demand volt, soft delete a pharmaDemands-ból
      if (postType === 'pharmaDemand' && pharmaDemandId) {
        await updateDoc(doc(db, 'pharmaDemands', pharmaDemandId), {
          status: 'deleted',
          deletedAt: serverTimestamp(),
          deletedBy: user.uid
        });
      }
      
      alert(market === 'de' ? '✅ Beitrag geloescht!' : '✅ Poszt törölve!');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert((market === 'de' ? '❌ Fehler beim Loeschen: ' : '❌ Hiba történt a törlés során: ') + error.message);
    }
  };

  const handleHideRssPost = async (rssPostId) => {
    if (!confirm(market === 'de' ? 'Moechtest du diese RSS-Nachricht wirklich ausblenden? Sie wird danach niemandem mehr angezeigt.' : 'Biztosan elrejted ezt az RSS hírt? Többé nem fog megjelenni senkinek.')) return;

    try {
      // RSS poszt ID hozzáadása a rejtett listához
      await setDoc(doc(db, 'hiddenRssPosts', rssPostId), {
        hiddenAt: serverTimestamp(),
        hiddenBy: user.uid
      });
      
      // Frissítjük a local state-et
      setHiddenRssIds(prev => new Set([...prev, rssPostId]));
      
      alert(market === 'de' ? '✅ RSS-Nachricht ausgeblendet!' : '✅ RSS hír elrejtve!');
    } catch (error) {
      console.error('Error hiding RSS post:', error);
      alert((market === 'de' ? '❌ Fehler beim Ausblenden: ' : '❌ Hiba történt az elrejtés során: ') + error.message);
    }
  };

  // Kombináljuk a posztokat és RSS híreket
  const allPosts = [
    ...posts.map(p => ({ ...p, source: 'user' })),
    ...rssPosts
      .filter(rss => !hiddenRssIds.has(rss.id))
      .map(rss => ({ 
        ...rss, 
        source: 'rss',
        createdAt: rss.pubDate ? { toDate: () => new Date(rss.pubDate) } : null
      }))
  ].sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || new Date(0);
    return dateB - dateA;
  });

  if (!user || !ALL_ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{market === 'de' ? 'Admin - Beitraege verwalten' : 'Admin - Posztok kezelése'}</h1>
            <button
              onClick={() => router.push('/admin')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {market === 'de' ? '← Zurueck zum Admin-Bereich' : '← Vissza az Admin panelhez'}
            </button>
          </div>

          {/* Új poszt létrehozása - Professzionális szerkesztő */}
          {isAdmin && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                {market === 'de' ? 'Neuer Beitrag im Feed' : 'Új poszt a hírfolyamba'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStylePanel(!showStylePanel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showStylePanel 
                      ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Palette size={14} />
                  {market === 'de' ? 'Stil' : 'Stílus'}
                  {hasCustomStyle && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showPreview
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Eye size={14} />
                  {market === 'de' ? 'Vorschau' : 'Előnézet'}
                </button>
              </div>
            </div>

            {/* Stílus panel */}
            {showStylePanel && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4 animate-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Palette size={16} className="text-purple-600" />
                    Megjelenés testreszabása
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setStyle({ backgroundColor: '#ffffff', textColor: '#000000', fontSize: 16, fontFamily: 'sans' });
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Alaphelyzetbe állítás
                  </button>
                </div>

                {/* Színsémák */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Színséma</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setStyle(s => ({ ...s, backgroundColor: preset.bg, textColor: preset.text }))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          style.backgroundColor === preset.bg && style.textColor === preset.text
                            ? 'ring-2 ring-purple-400 border-purple-300'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                          style={{ backgroundColor: preset.bg }}
                        />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Egyedi színek */}
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Háttérszín</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={style.backgroundColor}
                        onChange={(e) => setStyle(s => ({ ...s, backgroundColor: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500 font-mono">{style.backgroundColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Betűszín</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={style.textColor}
                        onChange={(e) => setStyle(s => ({ ...s, textColor: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500 font-mono">{style.textColor}</span>
                    </div>
                  </div>
                </div>

                {/* Betűtípus és méret */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      <Type size={12} className="inline mr-1" />
                      Betűtípus
                    </label>
                    <select
                      value={style.fontFamily}
                      onChange={(e) => setStyle(s => ({ ...s, fontFamily: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    >
                      {FONT_OPTIONS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Betűméret</label>
                    <div className="flex items-center gap-1">
                      {FONT_SIZE_OPTIONS.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setStyle(s => ({ ...s, fontSize: size }))}
                          className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                            style.fontSize === size
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-600 hover:border-purple-400'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Szöveg szerkesztő */}
            {!showPreview ? (
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Írj egy posztot..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y text-base"
                  style={hasCustomStyle ? {
                    backgroundColor: style.backgroundColor,
                    color: style.textColor,
                    fontSize: `${style.fontSize}px`,
                    fontFamily: getFontFamilyCSS(style.fontFamily),
                  } : {}}
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {postText.length} karakter
                </div>
              </div>
            ) : (
              /* Előnézet */
              <div className="border border-blue-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-blue-50 px-4 py-2 border-b border-blue-200 flex items-center gap-2">
                  <Eye size={14} className="text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Előnézet – így fog megjelenni a hírfolyamban</span>
                </div>
                <div className="p-4">
                  {/* Fejléc mint a feedben */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">Pm</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Pharmagister Admin</p>
                      <p className="text-xs text-gray-500">Éppen most</p>
                    </div>
                  </div>
                  {/* Tartalom */}
                  {hasCustomStyle ? (
                    <div
                      className="p-4 rounded-xl whitespace-pre-wrap"
                      style={{
                        backgroundColor: style.backgroundColor,
                        color: style.textColor,
                        fontSize: `${style.fontSize}px`,
                        fontFamily: getFontFamilyCSS(style.fontFamily),
                      }}
                    >
                      {postText || <span className="opacity-50">A poszt szövege itt jelenik meg...</span>}
                    </div>
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {postText || <span className="text-gray-400">A poszt szövege itt jelenik meg...</span>}
                    </p>
                  )}
                  {/* Kép előnézet */}
                  {imageUrl.trim() && (
                    <div className="mt-3">
                      <img
                        src={imageUrl}
                        alt="Poszt kép"
                        className="w-full h-48 object-cover rounded-lg border border-gray-200"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kép URL */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                <Image size={14} />
                Kép URL (opcionális)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={!postText.trim() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
              >
                <Send size={16} />
                    {isSubmitting ? (market === 'de' ? 'Wird veroeffentlicht...' : 'Közzététel...') : (market === 'de' ? 'Beitrag veroeffentlichen' : 'Poszt közzététele')}
              </button>
              {hasCustomStyle && (
                <span className="text-xs text-purple-600 flex items-center gap-1">
                  <Palette size={12} />
                  Egyedi stílus aktív
                </span>
              )}
            </div>
          </form>
          )}
        </div>

        {/* Létező posztok listája */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {market === 'de'
              ? `Alle Beitraege (${allPosts.length}) - Benutzerbeitraege: ${posts.length}, RSS-Nachrichten: ${rssPosts.filter(rss => !hiddenRssIds.has(rss.id)).length}`
              : `Összes poszt (${allPosts.length}) - User posztok: ${posts.length}, RSS hírek: ${rssPosts.filter(rss => !hiddenRssIds.has(rss.id)).length}`}
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allPosts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{market === 'de' ? 'Noch keine Beitraege' : 'Még nincs poszt'}</p>
              ) : (
                allPosts.map((post) => (
                <div
                  key={post.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {post.source === 'rss' ? (
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">SE</span>
                        </div>
                      ) : (
                        <img
                          src={post.authorData?.photoURL || '/default-avatar.svg'}
                          alt={post.authorData?.displayName}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {post.source === 'rss' ? 'semmelweis.hu' : (post.authorData?.displayName || (market === 'de' ? 'Ohne Namen' : 'Névtelen'))}
                        </p>
                        <p className="text-xs text-gray-500">
                          {post.createdAt?.toDate().toLocaleString(market === 'de' ? 'de-DE' : 'hu-HU') || (market === 'de' ? 'Jetzt' : 'Most')}
                        </p>
                      </div>
                    </div>
                    {(post.source === 'rss' || post.postType === 'pharmaDemand') && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        post.source === 'rss' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {post.source === 'rss' ? (market === 'de' ? '📰 RSS-Nachricht' : '📰 RSS Hír') : (market === 'de' ? '💊 Apothekenanfrage' : '💊 Gyógyszertári igény')}
                      </span>
                    )}
                  </div>

                  {post.source === 'rss' ? (
                    <>
                      <h3 className="font-bold text-lg text-gray-900 mb-2">{post.title}</h3>
                      {post.description && (
                        <p className="text-gray-700 mb-3 text-sm">{post.description}</p>
                      )}
                      {post.imageUrl && (
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          className="w-full h-48 object-cover rounded-lg mb-3"
                        />
                      )}
                      {post.link && (
                        <a
                          href={post.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700 text-sm"
                        >
                          {market === 'de' ? 'Voller Artikel →' : 'Teljes cikk →'}
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {post.text && (
                        <p className="text-gray-900 mb-3 whitespace-pre-wrap">{post.text}</p>
                      )}

                      {post.postType === 'pharmaDemand' && (
                        <div className="bg-green-50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-700">
                            <strong>Gyógyszertár:</strong> {post.pharmacyName} - {post.pharmacyCity}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Pozíció:</strong> {getLocalizedDemandPositionLabel(post.position, market, post.positionLabel)}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Dátum:</strong> {new Date(post.date).toLocaleDateString('hu-HU')}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Törlés/Elrejtés gomb */}
                  {isAdmin && (
                  <>
                  {post.source === 'rss' ? (
                    <button
                      onClick={() => handleHideRssPost(post.id)}
                      className="flex items-center gap-2 text-orange-600 hover:text-orange-700 text-sm mt-2"
                    >
                      <EyeOff size={16} />
                      {market === 'de' ? 'RSS-Nachricht ausblenden (wird nicht mehr angezeigt)' : 'RSS hír elrejtése (nem jelenik meg tovább)'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(post.id, post.postType, post.pharmaDemandId)}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm mt-2"
                    >
                      <Trash2 size={16} />
                      {market === 'de' ? 'Beitrag loeschen' : 'Poszt törlése'}
                    </button>
                  )}
                  </>
                  )}
                </div>
              ))
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
