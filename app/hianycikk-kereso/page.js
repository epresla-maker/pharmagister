"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  limit
} from 'firebase/firestore';
import {
  ArrowLeft,
  Search,
  Plus,
  Pill,
  MapPin,
  Phone,
  Clock,
  Building2,
  AlertCircle,
  Loader2,
  Trash2,
  Package,
  HelpCircle,
  X
} from 'lucide-react';

// ============================================
// KERESEK TAB - Search for shortage items
// ============================================
function KeresekTab({ darkMode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const debounceRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // Fetch results
  const fetchResults = useCallback(async (term) => {
    setLoading(true);
    try {
      const now = Timestamp.now();
      let q;

      if (term.length > 0) {
        // Prefix search: drugName >= term && drugName <= term + high unicode char
        const termLower = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
        const termEnd = termLower + '\uf8ff';
        q = query(
          collection(db, 'shortage_items'),
          where('isActive', '==', true),
          where('drugNameLower', '>=', term.toLowerCase()),
          where('drugNameLower', '<=', term.toLowerCase() + '\uf8ff'),
          orderBy('drugNameLower'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        // Show latest items when no search term
        q = query(
          collection(db, 'shortage_items'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
      }

      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({ id: doc.id, ...data });
      });
      setResults(items);
    } catch (error) {
      console.error('Hiba a keresés során:', error);
      setResults([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  // Trigger search on debounced term change
  useEffect(() => {
    fetchResults(debouncedTerm);
  }, [debouncedTerm, fetchResults]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Gyógyszer neve..."
          className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            darkMode
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md ${
              darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            Törlés
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Results */}
      {!loading && results.length === 0 && !initialLoad && (
        <div className={`text-center py-12 rounded-xl border ${
          darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <Pill className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Jelenleg nincs aktív bejegyzés.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-colors ${
                darkMode
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              {/* Drug Name */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  darkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'
                }`}>
                  <Pill className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className={`font-semibold text-base leading-tight ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {item.drugName}
                </h3>
                {item.quantity && (
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {item.quantity}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2 ml-11">
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {item.pharmacyName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {item.pharmacyAddress}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {item.pharmacyContact}
                  </span>
                  {item.pharmacyContact && /[\d+]/.test(item.pharmacyContact) && (
                    <a
                      href={`tel:${item.pharmacyContact.replace(/[^\d+]/g, '')}`}
                      className="ml-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      Hívás
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Feladva: {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// ELERHETO NALUNK TAB - Post new shortage item
// ============================================
function ElerhetoNalunkTab({ darkMode, user, onSuccess }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    drugName: '',
    quantity: '',
    pharmacyName: '',
    pharmacyAddress: '',
    pharmacyContact: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [loadingMyItems, setLoadingMyItems] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Load user's own active items
  const loadMyItems = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const q = query(
        collection(db, 'shortage_items'),
        where('createdByUserId', '==', user.uid),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({ id: d.id, ...data });
      });
      setMyItems(items);
    } catch (error) {
      console.error('Saját bejegyzések betöltési hiba:', error);
    } finally {
      setLoadingMyItems(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadMyItems();
  }, [loadMyItems]);

  const handleDelete = async (itemId) => {
    setDeletingId(itemId);
    try {
      await deleteDoc(doc(db, 'shortage_items', itemId));
      setMyItems((prev) => prev.filter((item) => item.id !== itemId));
      showToast('Bejegyzés törölve!', 'success', 1500);
    } catch (error) {
      console.error('Törlési hiba:', error);
      showToast('Hiba történt a törlés során.', 'error', 3000);
    } finally {
      setDeletingId(null);
    }
  };

  // Auto-fill pharmacy data from previous entries
  useEffect(() => {
    if (!user?.uid || prefilled) return;

    const loadPreviousData = async () => {
      try {
        const q = query(
          collection(db, 'shortage_items'),
          where('createdByUserId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const prev = snapshot.docs[0].data();
          setForm((f) => ({
            ...f,
            pharmacyName: prev.pharmacyName || '',
            pharmacyAddress: prev.pharmacyAddress || '',
            pharmacyContact: prev.pharmacyContact || ''
          }));
          setPrefilled(true);
        }
      } catch (error) {
        // Silent – can't load previous data, user fills manually
        console.error('Korábbi adatok betöltési hiba:', error);
      }
    };

    loadPreviousData();
  }, [user?.uid, prefilled]);

  const validate = () => {
    const newErrors = {};
    if (!form.drugName.trim()) newErrors.drugName = 'Kötelező mező';
    if (!form.pharmacyName.trim()) newErrors.pharmacyName = 'Kötelező mező';
    if (!form.pharmacyAddress.trim()) newErrors.pharmacyAddress = 'Kötelező mező';
    if (!form.pharmacyContact.trim()) newErrors.pharmacyContact = 'Kötelező mező';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Duplicate check: same pharmacy + drug within 48h
      // Simplified query (fewer fields) + client-side filtering to avoid complex composite index
      const dupQuery = query(
        collection(db, 'shortage_items'),
        where('createdByUserId', '==', user.uid),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const dupSnapshot = await getDocs(dupQuery);
      
      // Client-side filter: same drug + pharmacy + still active
      const drugLower = form.drugName.trim().toLowerCase();
      const pharmName = form.pharmacyName.trim();
      const activeDups = [];
      dupSnapshot.forEach((doc) => {
        const data = doc.data();
        if (
          data.drugNameLower === drugLower &&
          data.pharmacyName === pharmName
        ) {
          activeDups.push(doc);
        }
      });

      if (activeDups.length > 0) {
        showToast('Ez a gyógyszer már feladásra került ennél a patikánál.', 'error', 3000);
        setSubmitting(false);
        return;
      }

      // Create document
      const now = Timestamp.now();

      const newDoc = {
        drugName: form.drugName.trim(),
        drugNameLower: form.drugName.trim().toLowerCase(),
        pharmacyId: user.uid,
        pharmacyName: form.pharmacyName.trim(),
        pharmacyAddress: form.pharmacyAddress.trim(),
        pharmacyContact: form.pharmacyContact.trim(),
        createdByUserId: user.uid,
        createdAt: now,
        isActive: true
      };
      if (form.quantity.trim()) {
        newDoc.quantity = form.quantity.trim();
      }

      await addDoc(collection(db, 'shortage_items'), newDoc);

      showToast('Bejegyzés sikeresen feladva!', 'success', 2000);
      setForm((f) => ({ ...f, drugName: '', quantity: '' }));
      loadMyItems();
      onSuccess();
    } catch (error) {
      console.error('Hiba a feladás során:', error);
      showToast('Hiba történt a feladás során. Próbáld újra.', 'error', 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
      errors[field]
        ? 'border-red-400 focus:ring-red-400'
        : darkMode
        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
    }`;

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('hu-HU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Saját bejegyzések */}
      {myItems.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Saját aktív bejegyzéseid ({myItems.length})
          </h3>
          <div className="space-y-2">
            {myItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-3 flex items-center justify-between ${
                  darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className={`font-medium text-sm truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {item.drugName}
                    </span>
                    {item.quantity && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ml-6 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {item.pharmacyName} · {formatDate(item.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    darkMode ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-500'
                  }`}
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingMyItems && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Új bejegyzés feladása
        </h3>

        {/* Drug Name */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Gyógyszer neve <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.drugName}
            onChange={handleChange('drugName')}
            placeholder="pl. Algoflex 400mg"
            className={inputClass('drugName')}
          />
          {errors.drugName && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.drugName}
            </p>
          )}
        </div>

        {/* Quantity (optional) */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Elérhető mennyiség <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(opcionális)</span>
          </label>
          <input
            type="text"
            value={form.quantity}
            onChange={handleChange('quantity')}
            placeholder="pl. 5 doboz, 20 db"
            className={inputClass('quantity')}
          />
        </div>

      {/* Pharmacy Name */}
      <div>
        <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Patika neve <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.pharmacyName}
          onChange={handleChange('pharmacyName')}
          placeholder="pl. Galenus Gyógyszertár"
          className={inputClass('pharmacyName')}
        />
        {errors.pharmacyName && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.pharmacyName}
          </p>
        )}
      </div>

      {/* Pharmacy Address */}
      <div>
        <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Patika címe <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.pharmacyAddress}
          onChange={handleChange('pharmacyAddress')}
          placeholder="pl. 1051 Budapest, Váci utca 10."
          className={inputClass('pharmacyAddress')}
        />
        {errors.pharmacyAddress && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.pharmacyAddress}
          </p>
        )}
      </div>

      {/* Pharmacy Contact */}
      <div>
        <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Elérhetőség <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.pharmacyContact}
          onChange={handleChange('pharmacyContact')}
          placeholder="pl. +36 1 234 5678"
          className={inputClass('pharmacyContact')}
        />
        {errors.pharmacyContact && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.pharmacyContact}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
          submitting
            ? 'bg-emerald-400 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
        } flex items-center justify-center gap-2`}
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Feladás...
          </>
        ) : (
          <>
            <Plus className="w-5 h-5" />
            Bejegyzés feladása
          </>
        )}
      </button>

      </form>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function HianycikkKeresoPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('keresek');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const handlePostSuccess = () => {
    setActiveTab('keresek');
  };

  return (
    <div className={`min-h-screen pb-96 ${darkMode ? 'bg-gray-900' : 'bg-[#F9FAFB]'}`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
          >
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
          </button>
          <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Hiánycikk kereső
          </h1>
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Hogyan működik?
          </button>
        </div>
      </div>

      {/* Hogyan működik? info panel */}
      {showHowItWorks && (
        <div className="max-w-xl mx-auto px-4 pt-3">
          <div className={`rounded-xl border p-4 relative ${
            darkMode ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <button
              onClick={() => setShowHowItWorks(false)}
              className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
                darkMode ? 'hover:bg-emerald-800/40 text-emerald-400' : 'hover:bg-emerald-100 text-emerald-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              <HelpCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <div>
                <h3 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>Hogyan működik?</h3>
                <p className={`text-xs leading-relaxed ${darkMode ? 'text-emerald-200/80' : 'text-emerald-700'}`}>
                  Regisztrált felhasználók új tételt rögzíthetnek a köztudottan hiánycikknek számító termékekről, ezzel jelezhetik, ha az adott készítmény náluk elérhető.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={`sticky top-[53px] z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="flex max-w-xl mx-auto">
          <button
            onClick={() => setActiveTab('keresek')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'keresek'
                ? 'text-emerald-600'
                : darkMode
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Search className="w-4 h-4" />
              Keresek
            </div>
            {activeTab === 'keresek' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              if (!user) {
                router.push('/login');
                return;
              }
              setActiveTab('elerheto');
            }}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'elerheto'
                ? 'text-emerald-600'
                : darkMode
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />
              Elérhető nálunk
            </div>
            {activeTab === 'elerheto' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Figyelmeztető szöveg - csak a Keresek tabon */}
      {activeTab === 'keresek' && (
        <div className="max-w-xl mx-auto px-4 pt-3">
          <div className={`rounded-xl border p-3 ${
            darkMode ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex gap-2">
              <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${darkMode ? 'text-amber-400' : 'text-amber-500'}`} />
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-amber-200/80' : 'text-amber-700'}`}>
                A Hiánycikk kereső kizárólag tájékoztató jellegű információmegosztást szolgál. Nem történik értékesítés vagy tranzakció. A Pharmagister nem vállal felelősséget a hiánycikkek elérhetőségéért. Indulás előtt mindenképpen vegye fel a kapcsolatot a gyógyszertárral a megadott elérhetőségek valamelyikén.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="max-w-xl mx-auto px-4 py-4">
        {activeTab === 'keresek' && (
          <KeresekTab darkMode={darkMode} />
        )}

        {activeTab === 'elerheto' && user && (
          <ElerhetoNalunkTab
            darkMode={darkMode}
            user={user}
            onSuccess={handlePostSuccess}
          />
        )}

        {activeTab === 'elerheto' && !user && (
          <div className={`text-center py-12 rounded-xl border ${
            darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          }`}>
            <AlertCircle className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Bejelentkezés szükséges a bejegyzés feladásához.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Bejelentkezés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
