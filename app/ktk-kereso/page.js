"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import RouteGuard from '@/app/components/RouteGuard';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, Timestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  ArrowLeft,
  Search,
  MapPin,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  GraduationCap,
  Loader2,
  ExternalLink
} from 'lucide-react';

const SZAKMACSOPORTOK = {
  '1': 'Felnőtt ápolás és gondozás',
  '2': 'Gyermek ápolás és gondozás',
  '3': 'Sürgősségi ellátás',
  '4': 'Laboratóriumi diagnosztika',
  '5': 'Képi diagnosztika',
  '6': 'Általános és elektrofiziológiai asszisztencia',
  '7': 'Fogászati ellátás',
  '8': 'Gyógyszertári ellátás',
  '9': 'Mozgásterápia és fizioterápia',
  '10': 'Műtéti ellátás',
  '11': 'Szülészeti ellátás',
  '12': 'Védőnői ellátás',
  '13': 'Közegészségügyi és népegészségügyi',
  '14': 'Egészségügyi menedzsment',
  '15': 'Rehabilitáció és életvezetés',
  '16': 'Dietetika',
  '17': 'Természetgyógyászat',
};

const STATUS_COLORS = {
  'MEGHIRDETVE': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'LEZAJLOTT': 'bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-400',
  'ELMARAD': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500',
  'MEGTELT': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
};

function KtkCard({ item, darkMode }) {
  const szakmak = item.szakmacsoportok
    ? item.szakmacsoportok.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className={`font-semibold text-sm leading-snug flex-1 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {item.program_megnevezes}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
            STATUS_COLORS[item.ktk_statusz] || 'bg-gray-100 text-gray-600'
          }`}>
            {item.ktk_statusz}
          </span>
        </div>

        {/* Szervező */}
        {item.szervezo_megnevezes && (
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {item.szervezo_megnevezes}
            </span>
          </div>
        )}

        {/* Helyszín */}
        {(item.tovabbkepzes_varos || item.tovabbkepzes_cime) && (
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {[item.tovabbkepzes_varos, item.tovabbkepzes_cime].filter(Boolean).join(' – ')}
            </span>
          </div>
        )}

        {/* Pontos helyszín */}
        {item.helyszin && (
          <div className={`text-xs mb-1.5 ml-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {item.helyszin}
          </div>
        )}

        {/* Dátum */}
        {item.kezdes_idopontja && (() => {
          const isPast = item.ktk_statusz === 'MEGHIRDETVE' && item.kezdes_idopontja < new Date().toISOString().slice(0, 10);
          return (
            <div className="flex items-center gap-2 mb-2">
              <Calendar className={`w-4 h-4 flex-shrink-0 ${isPast ? 'text-red-500' : darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-xs ${isPast ? 'text-red-500 font-semibold' : darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {item.kezdes_idopontja}
                {item.befejezes_idopontja && item.befejezes_idopontja !== item.kezdes_idopontja
                  ? ` – ${item.befejezes_idopontja}`
                  : ''}
                {isPast && ' ⚠️'}
              </span>
            </div>
          );
        })()}

        {/* Nyilvántartási szám */}
        {item.nyilvantartasi_szam && (
          <div className={`text-[10px] mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {item.nyilvantartasi_szam}
          </div>
        )}

        {/* Szakmacsoportok chips */}
        {szakmak.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {szakmak.map(num => (
              <span
                key={num}
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  darkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700'
                }`}
                title={SZAKMACSOPORTOK[num] || num}
              >
                {SZAKMACSOPORTOK[num] || `${num}. szakcsoport`}
              </span>
            ))}
          </div>
        )}

        {/* Kapcsolattartó adatok */}
        {item.kapcsolattarto_neve && (
          <div className={`mt-2 pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`text-[10px] uppercase tracking-wider font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Kapcsolattartó
            </span>
            <p className={`text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              {item.kapcsolattarto_neve}
              {item.kapcsolattarto_beosztas && <span className={`font-normal ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}> – {item.kapcsolattarto_beosztas}</span>}
            </p>
            {item.kapcsolattarto_email && (
              <a href={`mailto:${item.kapcsolattarto_email}`} className={`text-xs block ${darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
                {item.kapcsolattarto_email}
              </a>
            )}
            {item.kapcsolattarto_telefon && (
              <a href={`tel:${item.kapcsolattarto_telefon.replace(/[^+\d]/g, '')}`} className={`text-xs block ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {item.kapcsolattarto_telefon}
              </a>
            )}
            {item.kapcsolattarto_mobil && (
              <a href={`tel:${item.kapcsolattarto_mobil.replace(/[^+\d]/g, '')}`} className={`text-xs block ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {item.kapcsolattarto_mobil}
              </a>
            )}
          </div>
        )}

        {/* Második kapcsolattartó */}
        {item.kapcsolattarto2_neve && (
          <div className="mt-2">
            <span className={`text-[10px] uppercase tracking-wider font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Kapcsolattartó 2
            </span>
            <p className={`text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              {item.kapcsolattarto2_neve}
              {item.kapcsolattarto2_beosztas && <span className={`font-normal ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}> – {item.kapcsolattarto2_beosztas}</span>}
            </p>
            {item.kapcsolattarto2_email && (
              <a href={`mailto:${item.kapcsolattarto2_email}`} className={`text-xs block ${darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
                {item.kapcsolattarto2_email}
              </a>
            )}
            {item.kapcsolattarto2_telefon && (
              <a href={`tel:${item.kapcsolattarto2_telefon.replace(/[^+\d]/g, '')}`} className={`text-xs block ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {item.kapcsolattarto2_telefon}
              </a>
            )}
            {item.kapcsolattarto2_mobil && (
              <a href={`tel:${item.kapcsolattarto2_mobil.replace(/[^+\d]/g, '')}`} className={`text-xs block ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {item.kapcsolattarto2_mobil}
              </a>
            )}
          </div>
        )}

        {/* SZAFTEX link */}
        <a
          href="https://enk.okfo.gov.hu/hirek-es-aktualitasok/tajekoztato-a-szaftex-portal-mukodeserol"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs font-medium mt-2 transition-colors ${
            darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Elérhetőség: OKFO SZAFTEX
        </a>
      </div>
    </div>
  );
}

// Admin e-mail címek
const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

export default function KtkKeresoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('MEGHIRDETVE');
  const [sortOrder, setSortOrder] = useState('asc');

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [visitCount, setVisitCount] = useState(null);
  const [recentVisits, setRecentVisits] = useState([]);
  const [showVisitLog, setShowVisitLog] = useState(false);
  const debounceRef = useRef(null);
  const visitTracked = useRef(false);

  // Disclaimer ellenőrzés
  useEffect(() => {
    const accepted = sessionStorage.getItem('ktk-disclaimer-accepted');
    if (accepted) setDisclaimerAccepted(true);
  }, []);

  // Látogatás rögzítés + admin statisztika
  useEffect(() => {
    if (!authLoading && user) {
      const isAdmin = ADMIN_EMAILS.includes(user.email);
      // Látogatás rögzítés (egyszer per pageload)
      if (!visitTracked.current) {
        visitTracked.current = true;
        const counterRef = doc(db, 'stats', 'ktk-kereso');
        setDoc(counterRef, { visitCount: increment(1) }, { merge: true });
        addDoc(collection(db, 'stats', 'ktk-kereso', 'visits'), {
          email: user.email,
          timestamp: Timestamp.now()
        });
      }
      // Admin: statisztika lekérés
      if (isAdmin) {
        getDoc(doc(db, 'stats', 'ktk-kereso')).then(snap => {
          if (snap.exists()) setVisitCount(snap.data().visitCount || 0);
        });
        getDocs(query(
          collection(db, 'stats', 'ktk-kereso', 'visits'),
          orderBy('timestamp', 'desc'),
          limit(20)
        )).then(snap => {
          setRecentVisits(snap.docs.map(d => d.data()));
        });
      }
    }
  }, [user, authLoading, router]);

  // Load data
  useEffect(() => {
    fetch('/ktk-data.json', { cache: 'no-store' })
      .then(res => res.json())
      .then(items => {
        setData(items);
        setLoading(false);
      })
      .catch(err => {
        console.error('KTK adat betöltési hiba:', err);
        setLoading(false);
      });
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim().toLowerCase());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // Filter & sort data
  const filtered = useMemo(() => {
    const result = data.filter(item => {
      // Text search
      if (debouncedTerm) {
        const searchFields = [
          item.program_megnevezes,
          item.szervezo_megnevezes,
          item.tovabbkepzes_cime,
          item.helyszin,
          item.nyilvantartasi_szam,
          item.fantazia_nev
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchFields.includes(debouncedTerm)) return false;
      }

      // Status filter
      if (statusFilter && item.ktk_statusz !== statusFilter) return false;

      return true;
    });

    // Sort by date
    result.sort((a, b) => {
      const dateA = a.kezdes_idopontja || '';
      const dateB = b.kezdes_idopontja || '';
      return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });

    return result;
  }, [data, debouncedTerm, statusFilter, sortOrder]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <RouteGuard>
      {/* Figyelmeztető disclaimer modal */}
      {!disclaimerAccepted && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`max-w-md w-full rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5Z" /></svg>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Fontos figyelmeztetés</h2>
            </div>
            <div className={`text-sm space-y-3 mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <p>
                A KTK Továbbképzés Kereső kizárólag <strong>tájékoztató jellegű</strong> információkat tartalmaz. 
                Az adatok az OKFO SZAFTEX portáljáról származnak.
              </p>
              <p>
                A Pharmagister <strong>nem vállal felelősséget</strong> az itt megjelenő adatok pontosságáért, 
                teljességéért és naprakészségéért. A továbbképzésekkel kapcsolatos hivatalos információkért 
                kérjük, forduljon közvetlenül az OKFO-hoz vagy a szervező intézményhez.
              </p>
              <p>
                A megjelenített adatok nem minősülnek hivatalos tájékoztatásnak, és nem helyettesítik 
                a SZAFTEX portálon elérhető eredeti információkat.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                  darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Vissza
              </button>
              <button
                onClick={() => {
                  sessionStorage.setItem('ktk-disclaimer-accepted', '1');
                  setDisclaimerAccepted(true);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Elfogadom, tovább
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-[40px]">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-purple-400 dark:bg-purple-500 border-b border-purple-500 dark:border-purple-600 z-20 shadow-lg pt-safe-small">
          <div className="max-w-xl mx-auto px-4 py-3">
            <button
              onClick={() => router.push('/')}
              className="text-white hover:text-purple-100 flex items-center gap-2 mb-3 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Vissza</span>
            </button>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-white" />
              <h1 className="text-xl font-bold text-white">
                Kötelező továbbképzés kereső
              </h1>
            </div>
            <p className="text-purple-100 text-[11px] mt-0.5">
              8. Gyógyszertári ellátás szakmacsoport
            </p>
            <p className="text-purple-100 text-xs mt-1">
              {loading ? 'Betöltés...' : `${filtered.length} továbbképzés`}
            </p>
            <a
              href="https://enk.okfo.gov.hu/hirek-es-aktualitasok/tajekoztato-a-szaftex-portal-mukodeserol"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-purple-200 hover:text-white mt-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Forrás: OKFO SZAFTEX (Teljes KTK_04.02..xlsx)
            </a>
            {ADMIN_EMAILS.includes(user?.email) && visitCount !== null && (
              <button
                onClick={() => setShowVisitLog(!showVisitLog)}
                className="inline-flex items-center gap-1 text-[10px] text-purple-200 hover:text-white mt-1 transition-colors"
              >
                👁 {visitCount} megtekintés
              </button>
            )}
          </div>
        </div>

        {/* Visit log for admin */}
        {showVisitLog && ADMIN_EMAILS.includes(user?.email) && (
          <div className="max-w-xl mx-auto px-4 pt-3">
            <div className={`rounded-xl p-3 text-xs ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <p className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Utolsó 20 megtekintés</p>
              {recentVisits.length === 0 ? (
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Nincs adat</p>
              ) : (
                <div className="space-y-1">
                  {recentVisits.map((v, i) => (
                    <div key={i} className={`flex justify-between ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <span>{v.email}</span>
                      <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                        {v.timestamp?.toDate?.() ? v.timestamp.toDate().toLocaleString('hu-HU') : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search + Filters - nem sticky, fejléc alatt */}
        <div className={`border-b shadow-sm ${
          darkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-100 border-gray-200'
        }`}>
          <div className="max-w-xl mx-auto px-4 py-3 space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Keresés: program, szervező, helyszín..."
                className={`w-full pl-10 pr-10 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  darkMode
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-400'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status filter pills */}
            <div className="flex gap-1.5 justify-between">
              {[
                { value: '', label: 'Mind' },
                { value: 'MEGHIRDETVE', label: 'Meghirdetve' },
                { value: 'LEZAJLOTT', label: 'Lezajlott' },
                { value: 'ELMARAD', label: 'Elmarad' },
                { value: 'MEGTELT', label: 'Megtelt' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-2 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-purple-600 text-white'
                      : darkMode
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Rendezés gomb */}
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                darkMode ? 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Dátum: {sortOrder === 'asc' ? 'legkorábbi elöl' : 'legkésőbbi elöl'}
              {sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-xl mx-auto px-4 pt-4 pb-8 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          ) : filtered.length === 0 ? (
            <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nem található továbbképzés</p>
              <p className="text-xs mt-1">Próbálj más keresőkifejezést vagy szűrőt</p>
            </div>
          ) : (
            filtered.map((item, idx) => (
              <KtkCard key={item.nyilvantartasi_szam || idx} item={item} darkMode={darkMode} />
            ))
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
