"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Star, User, Calendar, MapPin, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

export default function RatingsTab() {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const market = getClientMarket();
  
  const [demands, setDemands] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadDemandsAndRatings();
    }
  }, [user?.uid]);

  const loadDemandsAndRatings = async () => {
    setLoading(true);
    try {
      // Múltbeli, elfogadott igények lekérése - csak saját igények
      const now = new Date();
      
      const demandsQuery = query(
        collection(db, 'pharmaDemands'),
        where('pharmacyId', '==', user.uid),
        where('status', 'in', ['accepted', 'completed']),
        orderBy('date', 'desc')
      );
      
      const demandsSnapshot = await getDocs(demandsQuery);
      const demandsData = [];
      const substituteIds = new Set();
      
      demandsSnapshot.forEach(doc => {
        const data = doc.data();
        // Csak múltbeli igények
        let demandDate;
        if (data.date?.toDate) {
          demandDate = data.date.toDate();
        } else if (data.date) {
          demandDate = new Date(data.date);
        }
        
        if (demandDate && demandDate < now && data.acceptedApplicantId) {
          demandsData.push({ id: doc.id, ...data, demandDate });
          substituteIds.add(data.acceptedApplicantId);
        }
      });

      // Helyettesítők adatainak betöltése
      const substituteData = {};
      for (const subId of substituteIds) {
        try {
          const subDoc = await getDoc(doc(db, 'users', subId));
          if (subDoc.exists()) {
            substituteData[subId] = subDoc.data();
          }
        } catch (e) {
          console.warn('Could not fetch substitute:', e);
        }
      }

      // Értékelések betöltése
      const ratingsData = {};
      if (demandsData.length > 0) {
        const demandIds = demandsData.map(d => d.id);
        // Chunk into groups of 30 for 'in' query
        for (let i = 0; i < demandIds.length; i += 30) {
          const chunk = demandIds.slice(i, i + 30);
          const ratingsQuery = query(
            collection(db, 'ratings'),
            where('demandId', 'in', chunk)
          );
          const ratingsSnapshot = await getDocs(ratingsQuery);
          ratingsSnapshot.forEach(doc => {
            const data = doc.data();
            ratingsData[data.demandId] = data;
          });
        }
      }

      // Enrich demands with substitute data
      const enrichedDemands = demandsData.map(demand => ({
        ...demand,
        substituteData: substituteData[demand.acceptedApplicantId] || null,
      }));

      setDemands(enrichedDemands);
      setRatings(ratingsData);
    } catch (error) {
      console.error('Error loading demands:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getAverageRating = (rating) => {
    if (!rating?.ratings) return null;
    const { megbizhatas, szakmaiTudas, kommunikacio } = rating.ratings;
    if (!megbizhatas || !szakmaiTudas || !kommunikacio) return null;
    return ((megbizhatas + szakmaiTudas + kommunikacio) / 3).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (demands.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
        <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {market === 'de' ? 'Keine bewertbare Vertretung' : 'Nincs értékelhető helyettesítés'}
        </h3>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {market === 'de'
            ? 'Wenn eine angenommene Vertretung abgeschlossen ist, kannst du hier die Vertretungskraft bewerten.'
            : 'Amikor egy elfogadott helyettesítés lezárul, itt tudod majd értékelni a helyettesítőt.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {market === 'de' ? 'Bewertbare Vertretungen' : 'Értékelhető helyettesítések'}
        </h2>
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {demands.length} {market === 'de' ? 'Vertretungen' : 'helyettesítés'}
        </span>
      </div>

      {demands.map(demand => {
        const rating = ratings[demand.id];
        const hasRating = !!rating;
        const avgRating = getAverageRating(rating);
        const substitute = demand.substituteData;

        return (
          <div
            key={demand.id}
            className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-xl p-4 border ${
              darkMode ? 'border-gray-600' : 'border-gray-200'
            }`}
          >
            {/* Helyettesítő info */}
            <div className="flex items-center gap-3 mb-3">
              {substitute?.photoURL ? (
                <img
                  src={substitute.photoURL}
                  alt={substitute.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} flex items-center justify-center`}>
                  <User className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {substitute?.displayName || substitute?.name || (market === 'de' ? 'Unbekannte Vertretungskraft' : 'Ismeretlen helyettesítő')}
                </h3>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {substitute?.pharmagisterRole === 'pharmacist'
                    ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész')
                    : (market === 'de' ? 'Assistent/in' : 'Szakasszisztens')}
                </p>
              </div>
              {hasRating && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {avgRating}
                </div>
              )}
            </div>

            {/* Igény részletek */}
            <div className={`flex flex-wrap gap-3 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-3`}>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(demand.demandDate)}
              </span>
              {demand.startTime && demand.endTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {demand.startTime} - {demand.endTime}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {demand.pharmacyCity || demand.city || 'N/A'}
              </span>
            </div>

            {/* Értékelés gomb vagy állapot */}
            {hasRating ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{market === 'de' ? 'Bewertet' : 'Értékelve'}</span>
                </div>
                <button
                  onClick={() => router.push(`/ertekeles/${demand.id}`)}
                  className={`text-sm font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}
                >
                  {market === 'de' ? 'Bearbeiten →' : 'Módosítás →'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push(`/ertekeles/${demand.id}`)}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4" />
                {market === 'de' ? 'Bewertung' : 'Értékelés'}
              </button>
            )}
          </div>
        );
      })}

      {/* Info */}
      <div className={`mt-4 p-3 rounded-lg ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'} text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
        <p>
          {market === 'de'
            ? '💡 Bewertungen sind anonym; die Vertretungskraft sieht nicht, welche Apotheke sie abgegeben hat. Die aggregierte Bewertung erscheint nach 4 Bewertungen im Profil.'
            : '💡 Az értékelések anonimak, a helyettesítő nem látja, melyik gyógyszertár adta. Az összesített értékelés 4 db értékelés után jelenik meg a profilján.'}
        </p>
      </div>
    </div>
  );
}
