"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import RouteGuard from '@/app/components/RouteGuard';
import {
  ArrowLeft,
  Search,
  MapPin,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  Filter,
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
  const [expanded, setExpanded] = useState(false);

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

        {/* Dátum */}
        {item.kezdes_idopontja && (
          <div className="flex items-center gap-2 mb-2">
            <Calendar className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {item.kezdes_idopontja}
              {item.befejezes_idopontja && item.befejezes_idopontja !== item.kezdes_idopontja
                ? ` – ${item.befejezes_idopontja}`
                : ''}
            </span>
          </div>
        )}

        {/* Szakmacsoportok chips */}
        {szakmak.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {szakmak.slice(0, expanded ? szakmak.length : 3).map(num => (
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
            {!expanded && szakmak.length > 3 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                +{szakmak.length - 3}
              </span>
            )}
          </div>
        )}

        {/* SZAFTEX link */}
        <a
          href="https://enk.okfo.gov.hu/hirek-es-aktualitasok/tajekoztato-a-szaftex-portal-mukodeserol"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
            darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Elérhetőség: OKFO SZAFTEX
        </a>

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1 text-xs font-medium transition-colors ${
            darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'
          }`}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Kevesebb' : 'Részletek'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className={`px-4 pb-4 border-t space-y-3 ${
          darkMode ? 'border-gray-700' : 'border-gray-100'
        }`}>
          <div className="pt-3 space-y-2">
            {item.nyilvantartasi_szam && (
              <DetailRow darkMode={darkMode} label="Nyilvántartási szám" value={item.nyilvantartasi_szam} />
            )}
            {item.kulso_azonosito && (
              <DetailRow darkMode={darkMode} label="Külső azonosító" value={item.kulso_azonosito} />
            )}
            {item.helyszin && (
              <DetailRow darkMode={darkMode} label="Helyszín" value={item.helyszin} />
            )}


          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ darkMode, label, value }) {
  return (
    <div>
      <span className={`text-[10px] uppercase tracking-wider font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        {label}
      </span>
      <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{value}</p>
    </div>
  );
}

// Admin e-mail címek
const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function KtkKeresoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef(null);

  // Admin hozzáférés ellenőrzés
  useEffect(() => {
    if (!authLoading && user) {
      const isAdmin = ADMIN_EMAILS.includes(user.email);
      const isAdminka = ADMINKA_EMAILS.includes(user.email);
      if (!isAdmin && !isAdminka) {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  // Load data
  useEffect(() => {
    fetch('/ktk-data.json')
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

  const activeFilterCount = statusFilter ? 1 : 0;

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Ha nem admin, ne mutassunk semmit (redirect történik)
  if (!ADMIN_EMAILS.includes(user?.email) && !ADMINKA_EMAILS.includes(user?.email)) {
    return null;
  }

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-[40px]">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-purple-400 dark:bg-purple-500 border-b border-purple-500 dark:border-purple-600 z-10 shadow-lg pt-safe-small">
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
                KTK Továbbképzés Kereső
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
              Forrás: OKFO SZAFTEX
            </a>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="max-w-xl mx-auto px-4 pt-4 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Keresés: program, szervező, helyszín..."
              className={`w-full pl-10 pr-20 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                darkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-400'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative p-1.5 rounded-lg ${
                  showFilters || activeFilterCount
                    ? (darkMode ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600')
                    : (darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-400')
                }`}
              >
                <Filter className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className={`rounded-xl border p-3 space-y-3 ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              {/* Státusz filter */}
              <div>
                <label className={`text-xs font-medium mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Státusz
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="">Összes státusz</option>
                  <option value="MEGHIRDETVE">Meghirdetve</option>
                  <option value="LEZAJLOTT">Lezajlott</option>
                  <option value="ELMARAD">Elmarad</option>
                  <option value="MEGTELT">Megtelt</option>
                </select>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setStatusFilter('')}
                  className={`text-xs font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}
                >
                  Szűrő törlése
                </button>
              )}
            </div>
          )}

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
