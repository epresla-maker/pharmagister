"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, addDoc, query, where, getDocs, getDoc, deleteDoc, doc, orderBy, serverTimestamp, updateDoc, arrayRemove, setDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Clock, MapPin, MessageCircle, Send } from 'lucide-react';
import ResponseRateBar from '@/app/components/ResponseRateBar';
import { getClientMarket, getLocalizedDemandPositionLabel } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';

// Magyar ünnepek (fix dátumok)
const HUNGARIAN_HOLIDAYS = {
  '01-01': 'Újév',
  '03-15': 'Nemzeti ünnep',
  '05-01': 'Munka ünnepe',
  '08-20': 'Szent István ünnepe',
  '10-23': 'Nemzeti ünnep',
  '11-01': 'Mindenszentek',
  '12-25': 'Karácsony',
  '12-26': 'Karácsony'
};

// Húsvét kiszámítása (Gauss algoritmus)
function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Mozgó ünnepek adott évre
function getMovingHolidays(year) {
  const easter = getEasterDate(year);
  const holidays = {};
  
  // Nagypéntek (Húsvét - 2 nap)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const gfKey = `${String(goodFriday.getMonth() + 1).padStart(2, '0')}-${String(goodFriday.getDate()).padStart(2, '0')}`;
  holidays[gfKey] = 'Nagypéntek';
  
  // Húsvét vasárnap
  const easterKey = `${String(easter.getMonth() + 1).padStart(2, '0')}-${String(easter.getDate()).padStart(2, '0')}`;
  holidays[easterKey] = 'Húsvét vasárnap';
  
  // Húsvét hétfő
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const emKey = `${String(easterMonday.getMonth() + 1).padStart(2, '0')}-${String(easterMonday.getDate()).padStart(2, '0')}`;
  holidays[emKey] = 'Húsvét hétfő';
  
  // Pünkösd vasárnap (Húsvét + 49 nap)
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 49);
  const pKey = `${String(pentecost.getMonth() + 1).padStart(2, '0')}-${String(pentecost.getDate()).padStart(2, '0')}`;
  holidays[pKey] = 'Pünkösd vasárnap';
  
  // Pünkösd hétfő
  const pentecostMonday = new Date(pentecost);
  pentecostMonday.setDate(pentecost.getDate() + 1);
  const pmKey = `${String(pentecostMonday.getMonth() + 1).padStart(2, '0')}-${String(pentecostMonday.getDate()).padStart(2, '0')}`;
  holidays[pmKey] = 'Pünkösd hétfő';
  
  return holidays;
}

// Ellenőrzi, hogy a dátum ünnep-e
function isHoliday(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${month}-${day}`;
  
  // Fix ünnepek
  if (HUNGARIAN_HOLIDAYS[key]) {
    return HUNGARIAN_HOLIDAYS[key];
  }
  
  // Mozgó ünnepek
  const movingHolidays = getMovingHolidays(date.getFullYear());
  if (movingHolidays[key]) {
    return movingHolidays[key];
  }
  
  return null;
}

// Ellenőrzi, hogy hétvége-e (szombat vagy vasárnap)
function isWeekend(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = vasárnap, 6 = szombat
}

export default function PharmaCalendar({ pharmaRole }) {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();
  const locale = market === 'de' ? 'de-DE' : 'hu-HU';
  const searchParams = useSearchParams();
  const directCreateMode = searchParams.get('create') === 'true';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!directCreateMode) return;

    const initialDate = new Date();
    setSelectedDate(initialDate);
    setCurrentDate(initialDate);
    setShowModal(true);
    setShowCreateForm(true);
  }, [directCreateMode]);

  // Load demands
  useEffect(() => {
    loadDemands();
  }, [user, pharmaRole, market]);

  const loadDemands = async () => {
    if (!user || !pharmaRole) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const demandsRef = collection(db, 'pharmaDemands');
      let q;

      if (pharmaRole === 'pharmacy') {
        // Gyógyszertár: saját igényei (nem törölt)
        q = query(
          demandsRef,
          where('pharmacyId', '==', user.uid),
          where('status', 'in', ['open', 'filled']),
          orderBy('date', 'asc')
        );
      } else {
        // Helyettesítő: MINDEN nyitott igényt lát (gyógyszerész és asszisztens is)
        q = query(
          demandsRef,
          where('status', '==', 'open'),
          orderBy('date', 'asc')
        );
      }

      const snapshot = await getDocs(q);
      
      // Szűrjük ki a múltbeli dátumú igényeket (lokális időzóna!)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const demandsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(demand => {
          if (!isDocInMarket(demand, market)) {
            return false;
          }
          // Csak olyan igényeket tartunk meg, amelyek dátuma ma vagy jövőbeli
          return demand.date >= todayStr;
        });
      
      setDemands(demandsData);
    } catch (error) {
      console.error('Error loading demands:', error);
      setDemands([]);
    } finally {
      setLoading(false);
    }
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get calendar days
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Next month days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  };

  // Get demands for a specific date
  const getDemandsForDate = (date) => {
    // Lokális dátum formázás (timezone problémák elkerülésére)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return demands.filter(d => d.date === dateStr);
  };

  // Handle date click
  const handleDateClick = (date) => {
    setSelectedDate(date);
    const dateDemands = getDemandsForDate(date);
    
    if (pharmaRole === 'pharmacy') {
      // Gyógyszertár: mindig megnyitjuk a modált
      setShowModal(true);
      setShowCreateForm(dateDemands.length === 0);
    } else {
      // Helyettesítő: csak ha van igény
      if (dateDemands.length > 0) {
        setShowModal(true);
      }
    }
  };

  // Delete demand
  const handleDeleteDemand = async (demandId) => {
    if (!confirm(market === 'de' ? 'Moechtest du diese Anfrage wirklich loeschen?' : 'Biztosan törölni szeretnéd ezt az igényt?')) return;
    
    try {
      // Töröljük a serviceFeedPosts-ból is
      const feedPostsQuery = query(
        collection(db, 'serviceFeedPosts'),
        where('pharmaDemandId', '==', demandId)
      );
      const feedPostsSnapshot = await getDocs(feedPostsQuery);
      await Promise.all(feedPostsSnapshot.docs.map(doc => deleteDoc(doc.ref)));
      
      // Soft delete: mark as deleted instead of removing
      await updateDoc(doc(db, 'pharmaDemands', demandId), {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: user.uid
      });
      await loadDemands();
      alert(market === 'de' ? 'Anfrage erfolgreich geloescht!' : 'Igény sikeresen törölve!');
    } catch (error) {
      console.error('Error deleting demand:', error);
      alert(market === 'de' ? 'Fehler beim Loeschen der Anfrage.' : 'Hiba történt az igény törlése során.');
    }
  };

  const calendarDays = getCalendarDays();
  const today = new Date().toDateString();
  const monthNames = market === 'de'
    ? ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
  const dayNames = market === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>{market === 'de' ? 'Kalender' : 'Naptár'}</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={goToToday}
            className="px-4 py-2 text-sm bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors whitespace-nowrap font-medium"
          >
            {market === 'de' ? 'Heute' : 'Ma'}
          </button>
          <button
            type="button"
            onClick={goToPreviousMonth}
            className={`p-2 ${darkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : 'bg-white hover:bg-[#F3F4F6] border-[#E5E7EB]'} border rounded-xl transition-colors flex-shrink-0`}
          >
            <ChevronLeft className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} />
          </button>
          <div className={`px-2 sm:px-4 py-2 font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} min-w-[140px] sm:min-w-[200px] text-center flex-1 sm:flex-none text-lg`}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <button
            type="button"
            onClick={goToNextMonth}
            className={`p-2 ${darkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : 'bg-white hover:bg-[#F3F4F6] border-[#E5E7EB]'} border rounded-xl transition-colors flex-shrink-0`}
          >
            <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#6B46C1]" />
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} rounded-2xl border overflow-hidden shadow-sm`}>
            {/* Day names header */}
            <div className={`grid grid-cols-7 border-b ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
              {dayNames.map((day, index) => (
                <div key={index} className={`p-3 text-center text-sm font-bold ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dateDemands = getDemandsForDate(day.date);
                const isToday = day.date.toDateString() === today;
                const isPast = day.date < new Date(new Date().setHours(0, 0, 0, 0));
                const hasDemands = dateDemands.length > 0;
                const holiday = isHoliday(day.date);
                const weekend = isWeekend(day.date);

                return (
                  <div
                    key={index}
                    onClick={() => !isPast && handleDateClick(day.date)}
                    className={`min-h-[100px] p-2 border-r border-b ${darkMode ? 'border-gray-700' : 'border-[#E5E7EB]'} ${
                      !day.isCurrentMonth 
                        ? darkMode ? 'bg-gray-900' : 'bg-[#F9FAFB]' 
                        : hasDemands && !isPast
                          ? darkMode ? 'bg-purple-900/30' : 'bg-purple-50'
                          : weekend && !holiday
                            ? darkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                            : darkMode ? 'bg-gray-800' : 'bg-white'
                    } ${
                      !isPast && day.isCurrentMonth 
                        ? darkMode ? 'cursor-pointer hover:bg-gray-700' : 'cursor-pointer hover:bg-[#F3F4F6]' 
                        : ''
                    } ${
                      isPast ? 'opacity-40 cursor-not-allowed' : ''
                    } ${
                      hasDemands && !isPast && day.isCurrentMonth ? 'ring-2 ring-inset ring-purple-400' : ''
                    } transition-all duration-200`}
                  >
                    <div className={`text-sm font-bold mb-1 ${
                      !day.isCurrentMonth 
                        ? 'invisible' 
                        : holiday
                          ? 'text-red-500'
                          : weekend
                            ? darkMode ? 'text-gray-400' : 'text-gray-500'
                            : darkMode ? 'text-white' : 'text-[#111827]'
                    } ${
                      isToday ? 'bg-[#6B46C1] text-white w-8 h-8 rounded-full flex items-center justify-center' : ''
                    }`}>
                      {day.date.getDate()}
                    </div>
                    
                    {dateDemands.length > 0 && day.isCurrentMonth && (
                      <div className="space-y-1">
                        {dateDemands.slice(0, 2).map(demand => (
                          <div
                            key={demand.id}
                            className={`text-xs px-2 py-1 rounded-lg font-medium truncate ${
                              demand.position === 'pharmacist'
                                ? darkMode ? 'bg-blue-900/50 text-blue-400 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-300'
                                : darkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'
                            }`}
                          >
                            {demand.pharmacyName || 'Igény'}
                            {demand.pharmacyName || (market === 'de' ? 'Anfrage' : 'Igény')}
                          </div>
                        ))}
                        {dateDemands.length > 2 && (
                          <div className="text-xs text-[#6B46C1] px-2 font-medium">
                            +{dateDemands.length - 2} {market === 'de' ? 'weitere' : 'további'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 ${darkMode ? 'bg-blue-900/50 border-blue-700' : 'bg-blue-100 border-blue-300'} border-2 rounded`}></div>
              <span className={`${darkMode ? 'text-white' : 'text-[#111827]'} font-medium`}>{market === 'de' ? 'Apotheker/in' : 'Gyógyszerész'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 ${darkMode ? 'bg-green-900/50 border-green-700' : 'bg-green-100 border-green-300'} border-2 rounded`}></div>
              <span className={`${darkMode ? 'text-white' : 'text-[#111827]'} font-medium`}>{market === 'de' ? 'Assistent/in' : 'Asszisztens'}</span>
            </div>
          </div>
        </>
      )}

      {/* Modal for date details */}
      {showModal && selectedDate && (
        <DateModal
          date={selectedDate}
          demands={getDemandsForDate(selectedDate)}
          pharmaRole={pharmaRole}
          darkMode={darkMode}
          onClose={() => {
            setShowModal(false);
            setShowCreateForm(false);
          }}
          onDemandDeleted={handleDeleteDemand}
          onDemandCreated={loadDemands}
          showCreateForm={showCreateForm}
          setShowCreateForm={setShowCreateForm}
          directCreateMode={directCreateMode}
          market={market}
          locale={locale}
        />
      )}
    </div>
  );
}

// Date Modal Component
function DateModal({ date, demands, pharmaRole, darkMode, onClose, onDemandDeleted, onDemandCreated, showCreateForm, setShowCreateForm, directCreateMode, market, locale }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} rounded-2xl shadow-xl w-full border ${
        showCreateForm ? 'fixed inset-0 rounded-none max-h-screen overflow-y-auto pb-48' : 'max-w-2xl max-h-[80vh] overflow-y-auto'
      }`}>
        <div className="sticky top-0 bg-[#6B46C1] px-6 py-4 flex items-center justify-end rounded-t-2xl z-10">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          {pharmaRole === 'pharmacy' ? (
            // Gyógyszertár nézet
            <>
              {demands.length > 0 && !showCreateForm && (
                <div className="mb-6">
                  <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-3`}>{market === 'de' ? 'Bestehende Anfragen an diesem Tag:' : 'Meglévő igények ezen a napon:'}</h4>
                  <div className="space-y-3">
                    {demands.map(demand => (
                      <div key={demand.id} className={`border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-[#F9FAFB]'} rounded-xl p-4 hover:border-[#6B46C1] transition-colors`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">

                              <span className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                                {demand.position === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : demand.position === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'Szakasszisztens')}
                              </span>
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                demand.position === 'pharmacist'
                                  ? darkMode ? 'bg-blue-900/50 text-blue-400 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : darkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'
                              }`}>
                                  {demand.status === 'open' ? (market === 'de' ? 'Offen' : 'Nyitott') :
                                  demand.status === 'filled' ? (market === 'de' ? 'Besetzt' : 'Betöltve') : (market === 'de' ? 'Geloescht' : 'Törölve')}
                              </span>
                            </div>
                            {demand.workHours && (
                              <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} font-medium`}>
                                <Clock className="w-4 h-4" />
                                {demand.workHours}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onDemandDeleted(demand.id)}
                            className={`px-3 py-1 text-sm text-red-600 ${darkMode ? 'hover:bg-red-900/30 border-red-700' : 'hover:bg-red-50 border-red-200'} rounded-xl transition-colors border`}
                          >
                            {market === 'de' ? 'Loeschen' : 'Törlés'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  {market === 'de' ? 'Neue Anfrage fuer diesen Tag erstellen' : 'Új igény feladása erre a napra'}
                </button>
              ) : (
                <CreateDemandForm
                  date={date}
                  darkMode={darkMode}
                  market={market}
                  locale={locale}
                  allowDateEdit={directCreateMode}
                  startImmediately={directCreateMode}
                  onSuccess={() => {
                    onDemandCreated();
                    setShowCreateForm(false);
                  }}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </>
          ) : (
            // Helyettesítő nézet
            <>
              {demands.length > 0 ? (
                <div className="space-y-4">
                  {demands.map(demand => (
                    <DemandCard key={demand.id} demand={demand} pharmaRole={pharmaRole} darkMode={darkMode} market={market} locale={locale} />
                  ))}
                </div>
              ) : (
                <p className={`${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} text-center py-8`}>{market === 'de' ? 'Keine verfuegbaren Anfragen an diesem Tag.' : 'Nincs elérhető igény ezen a napon.'}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Demand Form
function CreateDemandForm({ date, darkMode, market, locale, allowDateEdit = false, startImmediately = false, onSuccess, onCancel }) {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(startImmediately ? 1 : 1);
  const [selectedDate, setSelectedDate] = useState(date);
  const [formData, setFormData] = useState({
    position: 'pharmacist',
    workHours: '',
    minExperience: '',
    requiredSoftware: [],
    otherSoftware: '',
    maxHourlyRate: '',
    additionalRequirements: '',
  });

  const totalSteps = 4;
  const otherSoftwareLabel = market === 'de' ? 'Sonstige' : 'Egyéb';
  const softwareOptions = ['Lx-Line', 'Novodata', 'Quadro Byte', 'Daxa', 'Primula', market === 'de' ? 'Sonstige' : 'Egyéb'];
  const shiftPresets = [
    market === 'de' ? '8:00-16:00' : '8:00-16:00',
    market === 'de' ? '12:00-20:00' : '12:00-20:00',
    market === 'de' ? 'Ganzer Tag' : 'Egész nap',
  ];
  const experienceOptions = [
    { value: '', label: market === 'de' ? 'Keine Anforderung' : 'Nincs követelmény' },
    { value: '0-1', label: market === 'de' ? '0-1 Jahr' : '0-1 év' },
    { value: '1-3', label: market === 'de' ? '1-3 Jahre' : '1-3 év' },
    { value: '3-5', label: market === 'de' ? '3-5 Jahre' : '3-5 év' },
    { value: '5-10', label: market === 'de' ? '5-10 Jahre' : '5-10 év' },
    { value: '10+', label: market === 'de' ? '10+ Jahre' : '10+ év' },
  ];

  const positionOptions = [
    { value: 'pharmacist', label: market === 'de' ? 'Apotheker/in' : 'Gyógyszerész' },
    { value: 'assistant', label: market === 'de' ? 'PTA' : 'Szakasszisztens' },
    ...(market === 'de' ? [{ value: 'pka', label: 'PKA' }] : []),
  ];

  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  useEffect(() => {
    if (startImmediately) {
      setStep(1);
    }
  }, [startImmediately]);

  const handleSoftwareToggle = (software) => {
    setFormData(prev => ({
      ...prev,
      requiredSoftware: prev.requiredSoftware.includes(software)
        ? prev.requiredSoftware.filter(s => s !== software)
        : [...prev.requiredSoftware, software]
    }));
  };

  const handleSubmit = async () => {
    
    // Ellenőrizzük, hogy a profil ki van-e töltve
    if (userData?.pharmagisterRole === 'pharmacy' && !userData?.pharmaProfileComplete) {
      alert(market === 'de' ? 'Bitte fuelle zuerst dein Profil aus!' : 'Kérlek először töltsd ki a profilodat!');
      return;
    }

    // Ellenőrizzük, hogy csak jövőbeli dátumra lehessen feladni (legalább holnap)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const demandDate = new Date(selectedDate);
    demandDate.setHours(0, 0, 0, 0);

    if (demandDate <= today) {
      alert(market === 'de' ? 'Die Anfrage muss fuer einen zukuenftigen Tag (mindestens morgen) erstellt werden.' : 'Az igényt csak jövőbeli napra lehet feladni (leghamarabb holnap).');
      return;
    }
    
    setLoading(true);

    try {
      // Lokális dátum formázás (timezone problémák elkerülésére)
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const localDateString = `${year}-${month}-${day}`;
      
      // Teljes cím összeállítása
      const fullAddress = `${userData.pharmacyZipCode || ''} ${userData.pharmacyCity || ''}, ${userData.pharmacyStreet || ''} ${userData.pharmacyHouseNumber || ''}`.trim();
      
      const demandData = {
        pharmacyId: user.uid,
        market,
        pharmacyName: userData.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár'),
        pharmacyCity: userData.pharmacyCity || '',
        pharmacyZipCode: userData.pharmacyZipCode || '',
        pharmacyStreet: userData.pharmacyStreet || '',
        pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
        pharmacyFullAddress: fullAddress,
        pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
        date: localDateString,
        position: formData.position,
        workHours: formData.workHours,
        minExperience: formData.minExperience,
        requiredSoftware: formData.requiredSoftware,
        otherSoftware: formData.otherSoftware || '',
        maxHourlyRate: formData.maxHourlyRate ? parseInt(formData.maxHourlyRate) : null,
        additionalRequirements: formData.additionalRequirements,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
      };

      const demandRef = await addDoc(collection(db, 'pharmaDemands'), demandData);

      // Számláló növelése - összes valaha feladott igény (nem kritikus)
      try {
        await setDoc(doc(db, 'firestoreStats', 'demands'), {
          totalEverCreated: increment(1)
        }, { merge: true });
      } catch (statsError) {
        console.log('Stats update failed (non-critical):', statsError);
      }
      
      // Automatikusan létrehozunk egy serviceFeedPost-ot is
      await addDoc(collection(db, 'serviceFeedPosts'), {
        postType: 'pharmaDemand',
        module: 'pharmagister',
        market,
        pharmaDemandId: demandRef.id,
        pharmacyId: user.uid,
        pharmacyName: userData.pharmacyName || 'Gyógyszertár',
        pharmacyName: userData.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár'),
        pharmacyCity: userData.pharmacyCity || '',
        pharmacyZipCode: userData.pharmacyZipCode || '',
        pharmacyStreet: userData.pharmacyStreet || '',
        pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
        pharmacyFullAddress: fullAddress,
        pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
        position: formData.position,
        positionLabel: formData.position === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : formData.position === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'Szakasszisztens'),
        workHours: formData.workHours,
        minExperience: formData.minExperience,
        requiredSoftware: formData.requiredSoftware,
        otherSoftware: formData.otherSoftware || '',
        maxHourlyRate: formData.maxHourlyRate ? parseInt(formData.maxHourlyRate) : null,
        additionalRequirements: formData.additionalRequirements,
        date: localDateString,
        createdAt: new Date(),
        userId: user.uid
      });
      
      // Push értesítés küldése a feliratkozott felhasználóknak
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/notify-new-demand', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            demandId: demandRef.id,
            pharmacyZipCode: userData.pharmacyZipCode || '',
            position: formData.position,
            pharmacyName: userData.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár'),
            date: localDateString
          })
        });
        console.log('📢 New demand notifications sent');
      } catch (notifyError) {
        console.log('Push notification failed (non-critical):', notifyError);
      }
      
      alert(market === 'de' ? 'Anfrage erfolgreich erstellt!' : 'Igény sikeresen feladva!');
      onSuccess();
    } catch (error) {
      console.error('Error creating demand:', error);
      alert(market === 'de' ? 'Fehler beim Erstellen der Anfrage.' : 'Hiba történt az igény feladása során.');
    } finally {
      setLoading(false);
    }
  };

  const datePreview = selectedDate.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const editableDateValue = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  // Számítjuk holnap dátumát - csak ettől lehet feladni
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateValue = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const canContinue = () => {
    if (step === 1) return Boolean(formData.position);
    if (step === 2) return true;
    if (step === 3) {
      if (formData.requiredSoftware.includes(otherSoftwareLabel)) {
        return Boolean(formData.otherSoftware.trim());
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!canContinue() || step >= totalSteps) return;
    setStep((prev) => prev + 1);
  };

  const goBack = () => {
    if (step === 1) {
      onCancel();
      return;
    }
    setStep((prev) => prev - 1);
  };

  const togglePresetShift = (value) => {
    setFormData((prev) => ({
      ...prev,
      workHours: prev.workHours === value ? '' : value,
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} text-lg`}>
            {market === 'de' ? 'Schnelles Anfrage-Setup' : 'Gyors igényfeladás'}
          </h4>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-[#F3F4F6] text-[#374151]'}`}>
            {step}/{totalSteps}
          </span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-[#E5E7EB]'}`}>
          <div
            className="h-full bg-[#6B46C1] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Profil figyelmeztetés */}
      {userData?.pharmagisterRole === 'pharmacy' && !userData?.pharmaProfileComplete && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-orange-800">
            ⚠️ <strong>{market === 'de' ? 'Achtung!' : 'Figyelem!'}</strong> {market === 'de' ? 'Bitte fuelle dein Profil in den Einstellungen aus!' : 'Kérlek töltsd ki a profilodat a beállításokban!'}
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
            {market === 'de' ? 'Wen suchst du fuer diesen Tag?' : 'Kit keresel erre a napra?'}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {positionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData({ ...formData, position: option.value })}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors font-medium ${
                  formData.position === option.value
                    ? 'bg-[#6B46C1] text-white border-[#6B46C1]'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 hover:border-[#6B46C1]'
                      : 'bg-white border-[#E5E7EB] text-[#111827] hover:border-[#6B46C1]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className={`rounded-xl p-3 border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
              {market === 'de' ? 'Datum' : 'Dátum'}: <span className="font-semibold">{datePreview}</span>
            </p>
          </div>

          {allowDateEdit && (
            <div>
              <label className={`block text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>
                {market === 'de' ? 'Datum aendern' : 'Dátum módosítása'}
              </label>
              <input
                type="date"
                value={editableDateValue}
                min={minDateValue}
                onChange={(e) => {
                  const nextDate = new Date(`${e.target.value}T00:00:00`);
                  if (!Number.isNaN(nextDate.getTime())) {
                    // Ellenőrizzük hogy csak jövőbeli dátum lehet (legalább holnap)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (nextDate > today) {
                      setSelectedDate(nextDate);
                    }
                  }
                }}
                className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-[#E5E7EB] text-[#111827]'} border rounded-xl focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1]`}
              />
              <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                {market === 'de' ? 'Minimum morgen' : 'Leghamarabb holnap'} • {market === 'de' ? 'Das Datum kann hier angepasst werden.' : 'Közvetlen nyitásnál módosítható.'}
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
            {market === 'de' ? 'Waehle eine Schicht oder gib sie manuell an.' : 'Válassz műszakot, vagy add meg kézzel.'}
          </p>

          <div className="flex flex-wrap gap-2">
            {shiftPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => togglePresetShift(preset)}
                className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                  formData.workHours === preset
                    ? 'bg-[#6B46C1] text-white border-[#6B46C1]'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 hover:border-[#6B46C1]'
                      : 'bg-white border-[#E5E7EB] text-[#111827] hover:border-[#6B46C1]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div>
            <label className={`block text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>
              {market === 'de' ? 'Manuelle Arbeitszeit (optional)' : 'Egyedi munkaidő (opcionális)'}
            </label>
            <input
              type="text"
              value={formData.workHours}
              onChange={(e) => setFormData({ ...formData, workHours: e.target.value })}
              placeholder={market === 'de' ? 'z.B. 9:00-17:00' : 'pl. 9:00-17:00'}
              className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-[#E5E7EB] text-[#111827] placeholder-[#9CA3AF]'} border rounded-xl focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1]`}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Minimum Erfahrung (optional)' : 'Minimum tapasztalat (opcionális)'}
            </p>
            <div className="flex flex-wrap gap-2">
              {experienceOptions.map((option) => (
                <button
                  key={option.value || 'none'}
                  type="button"
                  onClick={() => setFormData({ ...formData, minExperience: option.value })}
                  className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                    formData.minExperience === option.value
                      ? 'bg-[#6B46C1] text-white border-[#6B46C1]'
                      : darkMode
                        ? 'bg-gray-800 border-gray-600 text-gray-100 hover:border-[#6B46C1]'
                        : 'bg-white border-[#E5E7EB] text-[#111827] hover:border-[#6B46C1]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Softwarekenntnisse (optional)' : 'Szoftverismeret (opcionális)'}
            </p>
            <div className="flex flex-wrap gap-2">
              {softwareOptions.map((software) => (
                <button
                  key={software}
                  type="button"
                  onClick={() => handleSoftwareToggle(software)}
                  className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                    formData.requiredSoftware.includes(software)
                      ? 'bg-[#6B46C1] text-white border-[#6B46C1]'
                      : darkMode
                        ? 'bg-gray-800 border-gray-600 text-gray-100 hover:border-[#6B46C1]'
                        : 'bg-white border-[#E5E7EB] text-[#111827] hover:border-[#6B46C1]'
                  }`}
                >
                  {software}
                </button>
              ))}
            </div>
          </div>

          {formData.requiredSoftware.includes(otherSoftwareLabel) && (
            <div>
              <label className={`block text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>
                {market === 'de' ? 'Sonstige Software' : 'Egyéb szoftver'}
              </label>
              <input
                type="text"
                value={formData.otherSoftware}
                onChange={(e) => setFormData({ ...formData, otherSoftware: e.target.value })}
                placeholder={market === 'de' ? 'Name eingeben' : 'Név megadása'}
                className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-[#E5E7EB] text-[#111827] placeholder-[#9CA3AF]'} border rounded-xl focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1]`}
              />
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>
              {market === 'de' ? 'Maximaler Stundenlohn (optional)' : 'Maximum órabér (opcionális)'}
            </label>
            <input
              type="number"
              value={formData.maxHourlyRate}
              onChange={(e) => setFormData({ ...formData, maxHourlyRate: e.target.value })}
              placeholder={market === 'de' ? 'z.B. 5000' : 'pl. 5000'}
              className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-[#E5E7EB] text-[#111827] placeholder-[#9CA3AF]'} border rounded-xl focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1]`}
              min="0"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>
              {market === 'de' ? 'Weitere Anforderungen (optional)' : 'További követelmények (opcionális)'}
            </label>
            <textarea
              value={formData.additionalRequirements}
              onChange={(e) => setFormData({ ...formData, additionalRequirements: e.target.value })}
              rows="3"
              className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-[#E5E7EB] text-[#111827] placeholder-[#9CA3AF]'} border rounded-xl focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1]`}
              placeholder={market === 'de' ? 'Weitere Erwartungen...' : 'Egyéb elvárások...'}
            />
          </div>

          <div className={`rounded-xl p-3 border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
            <p className={`font-semibold text-sm mb-2 ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Zusammenfassung' : 'Összegzés'}
            </p>
            <ul className={`text-sm space-y-1 ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
              <li>{market === 'de' ? 'Datum' : 'Dátum'}: {datePreview}</li>
              <li>{market === 'de' ? 'Position' : 'Pozíció'}: {positionOptions.find((p) => p.value === formData.position)?.label}</li>
              <li>{market === 'de' ? 'Schicht' : 'Műszak'}: {formData.workHours || (market === 'de' ? 'Nicht angegeben' : 'Nincs megadva')}</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={goBack}
          className={`flex-1 px-4 py-2 border ${darkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]'} rounded-xl transition-colors`}
        >
          {step === 1 ? (market === 'de' ? 'Abbrechen' : 'Mégse') : (market === 'de' ? 'Zurueck' : 'Vissza')}
        </button>

        {step < totalSteps ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue()}
            className="flex-1 px-4 py-2 bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors disabled:opacity-50 font-medium"
          >
            {market === 'de' ? 'Weiter' : 'Tovább'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {market === 'de' ? 'Erstellen...' : 'Létrehozás...'}
              </>
            ) : (
              market === 'de' ? 'Anfrage erstellen' : 'Igény feladása'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Demand Card for Substitutes
function DemandCard({ demand, pharmaRole, darkMode, market, locale }) {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Szerepkör ellenőrzés - csak passzó szerepkörrel jelentkezhet/üzenhet
  const roleMatches = userData?.pharmagisterRole === demand.position;
  
  const handleApply = async () => {
    if (!user || !userData) {
      alert(market === 'de' ? 'Bitte melde dich an!' : 'Kérlek jelentkezz be!');
      return;
    }

    if (!userData.pharmaProfileComplete) {
      alert(market === 'de' ? 'Bitte fuelle dein Profil vor der Bewerbung aus!' : 'Kérlek töltsd ki a profilodat a jelentkezés előtt!');
      return;
    }

    // Szerepkör ellenőrzés - KRITIKUS!
    if (!userData.pharmagisterRole || userData.pharmagisterRole === 'pharmacy') {
      alert(market === 'de' ? 'Nur Apotheker und Assistenten koennen sich bewerben!' : 'Csak gyógyszerészek és szakasszisztensek jelentkezhetnek!');
      return;
    }

    // Ellenőrizzük hogy a szerepkör egyezik-e az igénnyel
    const userRole = userData.pharmagisterRole; // 'pharmacist' vagy 'assistant'
    const demandPosition = demand.position; // 'pharmacist' vagy 'assistant'
    
    if (userRole !== demandPosition) {
      const userRoleLabel = userRole === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'gyógyszerész') : userRole === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'szakasszisztens');
      const demandPositionLabel = demandPosition === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'gyógyszerész') : demandPosition === 'pka' ? 'PKA' : (market === 'de' ? 'PTA' : 'szakasszisztens');
      alert(market === 'de'
        ? `Fuer diese Anfrage koennen sich nur ${demandPositionLabel} bewerben. Du bist als ${userRoleLabel} registriert.`
        : `Erre az igényre csak ${demandPositionLabel}ek jelentkezhetnek! Te ${userRoleLabel}ként vagy regisztrálva.`);
      return;
    }

    if (applying) return;
    
    setApplying(true);
    try {
      const applicationsRef = collection(db, 'pharmaApplications');
      
      // Ellenőrizzük, hogy már jelentkezett-e
      const existingApplicationQuery = query(
        applicationsRef,
        where('demandId', '==', demand.id),
        where('applicantId', '==', user.uid)
      );
      const existingApplications = await getDocs(existingApplicationQuery);
      
      if (!existingApplications.empty) {
        alert(market === 'de' ? 'Du hast dich bereits auf diese Anfrage beworben!' : 'Már jelentkeztél erre az igényre!');
        setApplying(false);
        return;
      }

      // Új jelentkezés létrehozása
      await addDoc(applicationsRef, {
        demandId: demand.id,
        applicantId: user.uid,
        applicantName: userData.displayName || user.displayName || user.email,
        applicantEmail: user.email,
        applicantRole: pharmaRole,
        applicantExperience: userData.pharmaYearsOfExperience || '',
        applicantHourlyRate: userData.pharmaHourlyRate || '',
        pharmacyId: demand.pharmacyId,
        pharmacyName: demand.pharmacyName,
        position: demand.position,
        date: demand.date,
        status: 'pending',
        createdAt: new Date().toISOString(),
        message: market === 'de' ? `Ich bewerbe mich fuer den ${demand.date}.` : `Jelentkezem a ${demand.date} napra.`
      });

      // Értesítés küldése a gyógyszertárnak push-sal
      await createNotificationWithPush({
        userId: demand.pharmacyId,
        type: 'pharma_application',
        title: market === 'de' ? 'Neue Bewerbung! 📝' : 'Új jelentkező! 📝',
        message: market === 'de'
          ? `${userData.displayName || 'Jemand'} hat sich fuer die Vertretung am ${new Date(demand.date).toLocaleDateString(locale)} beworben.`
          : `${userData.displayName || 'Valaki'} jelentkezett a ${new Date(demand.date).toLocaleDateString(locale)}-i helyettesítésre.`,
        data: {
          demandId: demand.id,
          applicantId: user.uid,
        },
        url: `/pharmagister?tab=dashboard&expand=${demand.id}`
      });

      alert(market === 'de' ? 'Bewerbung erfolgreich gesendet!' : 'Jelentkezés sikeresen elküldve!');
    } catch (error) {
      console.error('Error applying:', error);
      alert(market === 'de' ? 'Fehler bei der Bewerbung.' : 'Hiba történt a jelentkezés során.');
    } finally {
      setApplying(false);
    }
  };

  const handleOpenChat = async () => {
    if (!user) return;
    
    setSendingMessage(true);
    try {
      // Check if chat already exists for this specific demand
      const chatsRef = collection(db, 'chats');
      const existingChatQuery = query(
        chatsRef,
        where('members', 'array-contains', user.uid)
      );
      const existingChats = await getDocs(existingChatQuery);
      
      let chatId = null;
      existingChats.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        // Check both: same pharmacy AND same demand
        if (chatData.members.includes(demand.pharmacyId) && chatData.relatedDemandId === demand.id) {
          chatId = chatDoc.id;
        }
      });
      
      if (chatId) {
        // If chat exists, navigate to it
        router.push(`/chat/${chatId}`);
      } else {
        // Create new chat directly and navigate to it
        const newChatRef = await addDoc(chatsRef, {
          members: [user.uid, demand.pharmacyId],
          memberNames: {
            [user.uid]: userData?.displayName || (market === 'de' ? 'Benutzer' : 'Felhasználó'),
            [demand.pharmacyId]: demand.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár')
          },
          memberPhotos: {
            [user.uid]: userData?.photoURL || null,
            [demand.pharmacyId]: demand.pharmacyPhotoURL || null
          },
          createdAt: serverTimestamp(),
          lastMessageAt: null,
          lastMessage: null,
          lastMessageSenderId: null,
          relatedDemandId: demand.id,
          relatedDemandDate: demand.date,
          relatedDemandPosition: demand.position,
          relatedDemandPositionLabel: getLocalizedDemandPositionLabel(demand.position, market),
          archivedBy: [],
          deletedBy: [],
          readBy: []
        });
        router.push(`/chat/${newChatRef.id}`);
      }
      
    } catch (err) {
      console.error('Error opening chat:', err);
      alert(market === 'de' ? 'Fehler beim Oeffnen des Chats.' : 'Hiba történt a chat megnyitása során.');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className={`border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-[#F9FAFB]'} rounded-xl p-4 hover:border-[#6B46C1] transition-colors`}>
      <div className="flex items-start gap-3">

        <div className="flex-1">
          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-1 text-lg`}>{demand.pharmacyName}</h4>
          <ResponseRateBar pharmacyId={demand.pharmacyId} />
          {demand.pharmacyCity && (
            <div className={`flex items-center gap-1 text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} font-medium mb-2`}>
              <MapPin className="w-4 h-4" />
              {demand.pharmacyFullAddress || `${demand.pharmacyZipCode || ''} ${demand.pharmacyCity || ''}`}
            </div>
          )}
          {demand.workHours && (
            <div className={`flex items-center gap-1 text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} font-medium mb-2`}>
              <Clock className="w-4 h-4" />
              {demand.workHours}
            </div>
          )}
          
          {!showDetails ? (
            // Összefoglaló nézet
            <>
              {demand.minExperience && (
                <p className={`text-sm ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                  <strong>{market === 'de' ? 'Mindesterfahrung:' : 'Minimum tapasztalat:'}</strong> {demand.minExperience}
                </p>
              )}
              {demand.maxHourlyRate && (
                <p className={`text-sm ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                  <strong>{market === 'de' ? 'Maximaler Stundenlohn:' : 'Maximum órabér:'}</strong> {demand.maxHourlyRate} {market === 'de' ? 'EUR' : 'Ft'}
                </p>
              )}
            </>
          ) : (
            // Részletes nézet
            <>
              {demand.minExperience && (
                <p className={`text-sm ${darkMode ? 'text-white' : 'text-[#111827]'} mb-1`}>
                  <strong>{market === 'de' ? 'Mindesterfahrung:' : 'Minimum tapasztalat:'}</strong> {demand.minExperience}
                </p>
              )}
              {demand.requiredSoftware?.length > 0 && (
                <div className="mb-2">
                  <p className={`text-sm ${darkMode ? 'text-white' : 'text-[#111827]'} mb-1`}><strong>{market === 'de' ? 'Softwarekenntnisse:' : 'Szoftverismeret:'}</strong></p>
                  <div className="flex flex-wrap gap-1">
                    {demand.requiredSoftware.map(sw => (
                      <span key={sw} className={`px-2 py-1 ${darkMode ? 'bg-blue-900/50 text-blue-400 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200'} border rounded-lg text-xs font-medium`}>
                        {sw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {demand.maxHourlyRate && (
                <p className={`text-sm ${darkMode ? 'text-white' : 'text-[#111827]'} mb-1`}>
                  <strong>{market === 'de' ? 'Maximaler Stundenlohn:' : 'Maximum órabér:'}</strong> {demand.maxHourlyRate} {market === 'de' ? 'EUR' : 'Ft'}
                </p>
              )}
              {demand.additionalRequirements && (
                <p className={`text-sm ${darkMode ? 'text-white' : 'text-[#111827]'} mt-2`}>
                  <strong>{market === 'de' ? 'Weitere Anforderungen:' : 'További követelmények:'}</strong> {demand.additionalRequirements}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {roleMatches ? (
          <>
            <button 
              onClick={handleApply}
              disabled={applying}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {applying ? (market === 'de' ? 'Bewerbung...' : 'Jelentkezés...') : (market === 'de' ? 'Bewerben' : 'Jelentkezem')}
            </button>
            <button 
              onClick={handleOpenChat}
              disabled={sendingMessage}
              className="px-3 py-2 bg-[#6B46C1] hover:bg-[#5a3aa3] text-white rounded-xl transition-colors text-sm font-medium flex items-center gap-1 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" />
              {sendingMessage ? (market === 'de' ? 'Oeffnen...' : 'Megnyitás...') : (market === 'de' ? 'Nachricht' : 'Üzenet')}
            </button>
          </>
        ) : (
          <div className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium text-center ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {demand.position === 'pharmacist' ? (market === 'de' ? 'Nur fuer Apotheker/innen' : 'Csak gyógyszerészeknek') : demand.position === 'pka' ? (market === 'de' ? 'Nur fuer PKA' : 'Csak PKA') : (market === 'de' ? 'Nur fuer PTA' : 'Csak szakasszisztenseknek')}
          </div>
        )}
        <button 
          onClick={() => router.push(`/pharmagister/demand/${demand.id}`)}
          className={`px-3 py-2 border ${darkMode ? 'border-gray-600 text-white hover:bg-gray-700' : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F3F4F6]'} rounded-xl transition-colors text-sm font-medium`}
        >
          {market === 'de' ? 'Details' : 'Részletek'}
        </button>
      </div>
    </div>
  );
}
