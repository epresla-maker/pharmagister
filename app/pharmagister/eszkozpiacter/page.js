"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import RouteGuard from '@/app/components/RouteGuard';
import ReportModal from '@/app/components/ReportModal';
import { db } from '@/lib/firebase';
import { getEffectivePharmagisterRole } from '@/lib/pharmagisterProfile';
import { getClientMarket } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Camera,
  Loader2,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

const PAGE_SIZE = 20;
const ADMIN_EMAILS = new Set(['epresla@icloud.com', 'etinatina22@gmail.com']);

const EQUIPMENT_CATEGORIES = [
  { id: 'furniture', hu: 'Bútor', de: 'Moebel' },
  { id: 'fridge', hu: 'Hűtő', de: 'Kuehlgeraet' },
  { id: 'scale', hu: 'Mérleg', de: 'Waage' },
  { id: 'it', hu: 'IT eszköz', de: 'IT-Geraet' },
  { id: 'lab', hu: 'Labor/diagnosztika', de: 'Labor/Diagnostik' },
  { id: 'other', hu: 'Egyéb', de: 'Sonstiges' },
];

const CONDITION_OPTIONS = [
  { id: 'new', hu: 'Új', de: 'Neu' },
  { id: 'used', hu: 'Használt', de: 'Gebraucht' },
  { id: 'refurbished', hu: 'Felújított', de: 'Generalueberholt' },
];

const FORBIDDEN_KEYWORDS = [
  'receptkoteles',
  'vényköteles',
  'venykoteles',
  'gyogyszer elado',
  'gyógyszer eladó',
  'ampulla',
  'tabletta',
  'inzulin',
  'betegadat',
  'tajszam',
  'taj szám',
];

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getLabel(list, id, market) {
  const item = list.find((entry) => entry.id === id);
  if (!item) return id;
  return market === 'de' ? item.de : item.hu;
}

function formatTime(ts, market) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function EszkozPiacterPage() {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();

  const role = getEffectivePharmagisterRole(userData);
  const canUseMarketplace = Boolean(role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [reportModalData, setReportModalData] = useState(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [condition, setCondition] = useState('used');
  const [priceType, setPriceType] = useState('fixed');
  const [priceAmount, setPriceAmount] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [search, setSearch] = useState('');

  const fileInputRef = useRef(null);
  const loadMoreRef = useRef(null);
  const lastApprovedDocRef = useRef(null);

  const isAdmin = ADMIN_EMAILS.has(String(user?.email || '').toLowerCase());

  const resetComposer = () => {
    setTitle('');
    setCategory('other');
    setCondition('used');
    setPriceType('fixed');
    setPriceAmount('');
    setCity('');
    setDescription('');
    setAcceptedPolicy(false);
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchItems = useCallback(async (afterDoc = null) => {
    try {
      let baseQuery;
      if (afterDoc) {
        baseQuery = query(
          collection(db, 'equipmentMarketplacePosts'),
          orderBy('createdAt', 'desc'),
          startAfter(afterDoc),
          limit(PAGE_SIZE)
        );
      } else {
        baseQuery = query(
          collection(db, 'equipmentMarketplacePosts'),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(baseQuery);
      const incoming = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((entry) => {
          if (!isDocInMarket(entry, market)) return false;
          if (isAdmin) return true;
          return entry.status === 'approved' || entry.userId === user?.uid;
        });

      if (snap.docs.length > 0) {
        lastApprovedDocRef.current = snap.docs[snap.docs.length - 1];
      }

      if (afterDoc) {
        setItems((prev) => {
          const mapById = new Map();
          [...prev, ...incoming].forEach((entry) => mapById.set(entry.id, entry));
          return Array.from(mapById.values());
        });
      } else {
        setItems(incoming);
      }

      setHasMore(snap.docs.length >= PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching equipment marketplace posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAdmin, market, user?.uid]);

  useEffect(() => {
    if (!user || !canUseMarketplace) {
      setLoading(false);
      return;
    }
    setItems([]);
    setLoading(true);
    setHasMore(true);
    lastApprovedDocRef.current = null;
    fetchItems();
  }, [user, canUseMarketplace, fetchItems]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          setLoadingMore(true);
          fetchItems(lastApprovedDocRef.current);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchItems, hasMore, loadingMore]);

  const filteredItems = useMemo(() => {
    const q = normalizeSearchText(search);
    if (!q) return items;
    return items.filter((item) => {
      const text = normalizeSearchText(`${item.title || ''} ${item.city || ''} ${item.description || ''}`);
      return text.includes(q);
    });
  }, [items, search]);

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(market === 'de' ? 'Nur Bilddateien sind erlaubt.' : 'Csak képfájlok engedélyezettek.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(market === 'de' ? 'Maximal 5 MB erlaubt.' : 'Maximum 5 MB fájlméret engedélyezett.');
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasForbiddenKeyword = (input) => {
    const normalized = normalizeSearchText(input);
    return FORBIDDEN_KEYWORDS.find((word) => normalized.includes(normalizeSearchText(word)));
  };

  const handleCreate = async () => {
    setErrorMessage('');

    if (!title.trim() || !city.trim() || !description.trim()) {
      setErrorMessage(market === 'de' ? 'Bitte alle Pflichtfelder ausfuellen.' : 'Kérlek töltsd ki a kötelező mezőket.');
      return;
    }

    if (priceType === 'fixed' && (!priceAmount || Number(priceAmount) <= 0)) {
      setErrorMessage(market === 'de' ? 'Bitte gueltigen Preis angeben.' : 'Adj meg érvényes árat.');
      return;
    }

    if (!acceptedPolicy) {
      setErrorMessage(
        market === 'de'
          ? 'AGB-Hinweis akzeptieren, um fortzufahren.'
          : 'A folytatáshoz el kell fogadnod a jogi nyilatkozatot.'
      );
      return;
    }

    const blockedWord = hasForbiddenKeyword(`${title} ${description}`);
    if (blockedWord) {
      setErrorMessage(
        market === 'de'
          ? `Der Text enthaelt verbotenes Wort: ${blockedWord}`
          : `A szöveg tiltott kifejezést tartalmaz: ${blockedWord}`
      );
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        formData.append('userId', user.uid);

        const idToken = await user.getIdToken();
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        imageUrl = data.url;
      }

      await addDoc(collection(db, 'equipmentMarketplacePosts'), {
        postType: 'equipment_marketplace',
        market,
        status: isAdmin ? 'approved' : 'pending',
        userId: user.uid,
        pharmaRole: role,
        title: title.trim(),
        equipmentCategory: category,
        condition,
        priceType,
        priceAmount: priceType === 'fixed' ? Number(priceAmount) : null,
        city: city.trim(),
        description: description.trim(),
        imageUrl,
        authorData: {
          displayName: userData?.displayName || userData?.pharmacyName || user?.displayName || 'Felhasználó',
          photoURL: userData?.photoURL || user?.photoURL || null,
          email: user?.email || null,
        },
        legalAccepted: true,
        legalAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetComposer();
      setShowComposer(false);
      lastApprovedDocRef.current = null;
      setLoading(true);
      fetchItems();
    } catch (error) {
      console.error('Error creating equipment ad:', error);
      setErrorMessage(market === 'de' ? 'Hirdetés feladási hiba.' : 'Hiba történt a hirdetés feladásakor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      market === 'de' ? 'Anzeige wirklich loeschen?' : 'Biztosan törlöd ezt a hirdetést?'
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'equipmentMarketplacePosts', id));
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Error deleting equipment ad:', error);
    }
  };

  const handleModeration = async (id, nextStatus) => {
    try {
      await updateDoc(doc(db, 'equipmentMarketplacePosts', id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    } catch (error) {
      console.error('Error updating equipment ad status:', error);
    }
  };

  const openChat = (item) => {
    const recipientName = encodeURIComponent(item.authorData?.displayName || 'Felhasználó');
    const recipientPhoto = encodeURIComponent(item.authorData?.photoURL || '');
    router.push(`/chat/new?recipientId=${item.userId}&recipientName=${recipientName}&recipientPhoto=${recipientPhoto}`);
  };

  if (authLoading) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} flex items-center justify-center`}>
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </RouteGuard>
    );
  }

  if (!canUseMarketplace) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} flex items-center justify-center p-6 text-center`}>
          <div>
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-amber-500" />
            <h2 className="text-lg font-semibold mb-2">{market === 'de' ? 'Kein Zugriff' : 'Nincs hozzáférés'}</h2>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
              {market === 'de'
                ? 'Der Marktplatz ist nur fuer pharmazeutische Profile verfuegbar.'
                : 'A Piactér csak szakmai Pharmagister profiloknak érhető el.'}
            </p>
          </div>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} pb-24`}>
        <div className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b pt-safe-small`}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => router.push('/kozosseg')} className="text-purple-600 flex items-center gap-1 font-medium">
              <ArrowLeft className="w-5 h-5" />
              {market === 'de' ? 'zurueck' : 'vissza'}
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-purple-600 ml-auto">{market === 'de' ? 'Marktplatz' : 'Piactér'}</h1>
          </div>

          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
            <div className={`flex-1 rounded-xl px-3 py-2 flex items-center gap-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full bg-transparent outline-none text-sm ${darkMode ? 'placeholder:text-gray-400' : 'placeholder:text-gray-500'}`}
                placeholder={market === 'de' ? 'Suche nach Titel, Stadt...' : 'Keresés címre, városra...'}
              />
            </div>
            <button
              onClick={() => setShowComposer(true)}
              className="rounded-xl px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {market === 'de' ? 'Anzeige' : 'Hirdetés'}
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
          ) : filteredItems.length === 0 ? (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 text-center border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <Package className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                {market === 'de' ? 'Noch keine Anzeigen im Marktplatz.' : 'Még nincs hirdetés a Piactéren.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isOwner = item.userId === user?.uid;
              const statusColor = item.status === 'approved' ? 'bg-green-100 text-green-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

              return (
                <article
                  key={item.id}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-base">{item.title}</h3>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.authorData?.displayName || 'Felhasználó'} · {formatTime(item.createdAt, market)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>
                      {item.status === 'approved' ? (market === 'de' ? 'Freigegeben' : 'Jóváhagyva') : item.status === 'pending' ? (market === 'de' ? 'Pruefung' : 'Ellenőrzés') : (market === 'de' ? 'Elutasitva' : 'Elutasítva')}
                    </span>
                  </div>

                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-52 object-cover rounded-lg mt-3"
                    />
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                      <span className="font-semibold">{market === 'de' ? 'Kategorie:' : 'Kategória:'}</span> {getLabel(EQUIPMENT_CATEGORIES, item.equipmentCategory, market)}
                    </div>
                    <div className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                      <span className="font-semibold">{market === 'de' ? 'Zustand:' : 'Állapot:'}</span> {getLabel(CONDITION_OPTIONS, item.condition, market)}
                    </div>
                    <div className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                      <span className="font-semibold">{market === 'de' ? 'Preis:' : 'Ár:'}</span>{' '}
                      {item.priceType === 'negotiable'
                        ? (market === 'de' ? 'Verhandelbar' : 'Megegyezés szerint')
                        : `${Number(item.priceAmount || 0).toLocaleString(market === 'de' ? 'de-DE' : 'hu-HU')} Ft`}
                    </div>
                    <div className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} flex items-center gap-1`}>
                      <MapPin className="w-4 h-4" />
                      {item.city}
                    </div>
                  </div>

                  <p className={`mt-3 text-sm whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!isOwner && item.status === 'approved' ? (
                      <button onClick={() => openChat(item)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                        {market === 'de' ? 'Kontakt' : 'Kapcsolatfelvétel'}
                      </button>
                    ) : null}

                    {!isOwner ? (
                      <button
                        onClick={() => setReportModalData({
                          reportType: 'equipmentMarketplacePost',
                          reportedUserId: item.userId,
                          reportedUserName: item.authorData?.displayName || 'Felhasználó',
                          itemId: item.id,
                          itemContent: item.title,
                        })}
                        className="px-3 py-2 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium"
                      >
                        {market === 'de' ? 'Melden' : 'Jelentem'}
                      </button>
                    ) : null}

                    {isOwner ? (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        {market === 'de' ? 'Loeschen' : 'Törlés'}
                      </button>
                    ) : null}

                    {isAdmin && item.status !== 'approved' ? (
                      <button
                        onClick={() => handleModeration(item.id, 'approved')}
                        className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-medium"
                      >
                        {market === 'de' ? 'Freigeben' : 'Jóváhagyás'}
                      </button>
                    ) : null}

                    {isAdmin && item.status !== 'rejected' ? (
                      <button
                        onClick={() => handleModeration(item.id, 'rejected')}
                        className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700 text-sm font-medium"
                      >
                        {market === 'de' ? 'Ablehnen' : 'Elutasítás'}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}

          <div ref={loadMoreRef} className="h-8" />
          {loadingMore ? <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div> : null}
        </div>

        {showComposer ? (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center p-3 pb-[calc(96px+env(safe-area-inset-bottom,0px))] sm:pb-3">
            <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} w-full max-w-xl rounded-2xl p-4 max-h-[86vh] overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom,0px))]`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{market === 'de' ? 'Anzeige erstellen' : 'Hirdetés feladása'}</h2>
                <button onClick={() => { setShowComposer(false); resetComposer(); }} className="p-1 rounded hover:bg-gray-200/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={market === 'de' ? 'Cim *' : 'Cím *'} className={`w-full rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`} />

                <div className="grid grid-cols-2 gap-2">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={`rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                    {EQUIPMENT_CATEGORIES.map((entry) => (
                      <option key={entry.id} value={entry.id}>{market === 'de' ? entry.de : entry.hu}</option>
                    ))}
                  </select>

                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className={`rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                    {CONDITION_OPTIONS.map((entry) => (
                      <option key={entry.id} value={entry.id}>{market === 'de' ? entry.de : entry.hu}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select value={priceType} onChange={(e) => setPriceType(e.target.value)} className={`rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                    <option value="fixed">{market === 'de' ? 'Fixpreis' : 'Fix ár'}</option>
                    <option value="negotiable">{market === 'de' ? 'Verhandelbar' : 'Megegyezés szerint'}</option>
                  </select>
                  {priceType === 'fixed' ? (
                    <input value={priceAmount} onChange={(e) => setPriceAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder={market === 'de' ? 'Preis in Ft *' : 'Ár Ft-ban *'} className={`rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`} />
                  ) : (
                    <div className={`rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-300 text-gray-500'}`}>
                      {market === 'de' ? 'Preis nach Absprache' : 'Ár megegyezés szerint'}
                    </div>
                  )}
                </div>

                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={market === 'de' ? 'Stadt *' : 'Város *'} className={`w-full rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`} />

                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={market === 'de' ? 'Beschreibung *' : 'Leírás *'} className={`w-full rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`} />

                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium flex items-center gap-1">
                    <Camera className="w-4 h-4" />
                    {market === 'de' ? 'Bild' : 'Kép'}
                  </button>
                  {imagePreview ? (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-300">
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      <button onClick={removeImage} className="absolute -top-1 -right-1 bg-black text-white rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={acceptedPolicy} onChange={(e) => setAcceptedPolicy(e.target.checked)} className="mt-0.5" />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                    {market === 'de'
                      ? 'Ich bestaetige, dass die Anzeige keine Arzneimittel, verschreibungspflichtigen Produkte oder personenbezogenen Gesundheitsdaten enthaelt.'
                      : 'Kijelentem, hogy a hirdetés nem tartalmaz gyógyszert, vényköteles terméket vagy személyes egészségügyi adatot.'}
                  </span>
                </label>

                {errorMessage ? (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMessage}</div>
                ) : null}

                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 disabled:opacity-60"
                >
                  {submitting
                    ? (market === 'de' ? 'Wird gespeichert...' : 'Mentés...')
                    : (market === 'de' ? 'Anzeige senden' : 'Hirdetés feladása')}
                </button>

                {!isAdmin ? (
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {market === 'de'
                      ? 'Neue Anzeigen gehen zuerst in Moderation (Pruefung).'
                      : 'Az új hirdetések először moderációra kerülnek (ellenőrzés).'}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <ReportModal
          isOpen={!!reportModalData}
          onClose={() => setReportModalData(null)}
          reportType={reportModalData?.reportType || 'equipmentMarketplacePost'}
          reportedUserId={reportModalData?.reportedUserId}
          reportedUserName={reportModalData?.reportedUserName}
          itemId={reportModalData?.itemId}
          itemContent={reportModalData?.itemContent}
        />
      </div>
    </RouteGuard>
  );
}
