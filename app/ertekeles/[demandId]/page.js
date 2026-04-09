"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import RouteGuard from '@/app/components/RouteGuard';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Star, Info, Check, Loader2, AlertCircle } from 'lucide-react';

// Admin emails - egyenlőre csak nekik érhető el az értékelő oldal
const RATING_ADMIN_EMAILS = ['epresla@icloud.com', 'etinatina22@gmail.com'];

const RATING_CRITERIA = [
  {
    id: 'reliability',
    label: 'Megbízhatóság',
    descriptions: {
      1: 'Nem jelent meg / jelentős késés (30+ perc)',
      2: 'Gyakran késett vagy korábban távozott',
      3: 'Kisebb időbeli pontatlanságok',
      4: 'Szinte mindig pontos volt',
      5: 'Tökéletesen betartotta az időket'
    }
  },
  {
    id: 'expertise',
    label: 'Szakmai tudás',
    descriptions: {
      1: 'Hiányos alapismeretek, sok hiba',
      2: 'Gyakran kért segítséget, bizonytalan',
      3: 'Megfelelő, rutinfeladatokat jól végezte',
      4: 'Magabiztos, ritkán kért segítséget',
      5: 'Kiváló felkészültség, önálló munkavégzés'
    }
  },
  {
    id: 'communication',
    label: 'Kommunikáció',
    descriptions: {
      1: 'Nehézkes kommunikáció, konfliktusok',
      2: 'Visszahúzódó, kevés beteg-interakció',
      3: 'Megfelelő, átlagos kapcsolattartás',
      4: 'Jó kommunikáció betegekkel és kollégákkal',
      5: 'Kiváló, pozitív visszajelzések páciensektől'
    }
  }
];

function StarRating({ value, onChange, criterion, darkMode, showInfo, setShowInfo }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {criterion.label}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo(showInfo === criterion.id ? null : criterion.id)}
            className={`p-1 rounded-full transition-colors ${
              showInfo === criterion.id 
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-7 h-7 ${
                  star <= value
                    ? 'fill-yellow-400 text-yellow-400'
                    : darkMode
                      ? 'text-gray-600'
                      : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      
      {/* Info panel */}
      {showInfo === criterion.id && (
        <div className={`rounded-lg p-3 text-xs space-y-1 ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
        }`}>
          {Object.entries(criterion.descriptions).map(([stars, desc]) => (
            <div key={stars} className="flex gap-2">
              <span className="font-medium text-yellow-500 w-8">{'★'.repeat(parseInt(stars))}</span>
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RatingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const demandId = params.demandId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(null);
  
  const [demand, setDemand] = useState(null);
  const [application, setApplication] = useState(null);
  const [substituteData, setSubstituteData] = useState(null);
  const [existingRating, setExistingRating] = useState(null);

  // Rating form state
  const [ratings, setRatings] = useState({
    reliability: 0,
    expertise: 0,
    communication: 0
  });
  const [wouldChooseAgain, setWouldChooseAgain] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadData();
  }, [demandId, user]);

  const loadData = async () => {
    if (!demandId || !user) return;
    
    // Admin check - egyelőre csak adminok érhetik el
    const userEmail = user.email || '';
    if (!RATING_ADMIN_EMAILS.includes(userEmail)) {
      setError('Ez a funkció jelenleg tesztelés alatt áll.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      // 1. Load demand
      const demandDoc = await getDoc(doc(db, 'pharmaDemands', demandId));
      if (!demandDoc.exists()) {
        setError('Az igény nem található.');
        return;
      }
      const demandData = { id: demandDoc.id, ...demandDoc.data() };
      setDemand(demandData);

      // Check if user is the pharmacy owner (vagy admin)
      const isPharmacyOwner = demandData.pharmacyId === user.uid;
      const isAdmin = RATING_ADMIN_EMAILS.includes(user.email);
      
      if (!isPharmacyOwner && !isAdmin) {
        setError('Csak a gyógyszertár értékelheti a helyettesítőt.');
        return;
      }

      // 2. Find accepted application
      const appQuery = query(
        collection(db, 'pharmaApplications'),
        where('demandId', '==', demandId),
        where('status', '==', 'accepted')
      );
      const appSnapshot = await getDocs(appQuery);
      
      if (appSnapshot.empty) {
        setError('Nincs elfogadott jelentkező ehhez az igényhez.');
        return;
      }

      const appData = { id: appSnapshot.docs[0].id, ...appSnapshot.docs[0].data() };
      setApplication(appData);

      // 3. Load substitute data
      const substituteDoc = await getDoc(doc(db, 'users', appData.applicantId));
      if (substituteDoc.exists()) {
        setSubstituteData({ id: substituteDoc.id, ...substituteDoc.data() });
      }

      // 4. Check for existing rating
      const ratingQuery = query(
        collection(db, 'ratings'),
        where('demandId', '==', demandId),
        where('pharmacyId', '==', user.uid)
      );
      const ratingSnapshot = await getDocs(ratingQuery);
      
      if (!ratingSnapshot.empty) {
        const ratingData = { id: ratingSnapshot.docs[0].id, ...ratingSnapshot.docs[0].data() };
        setExistingRating(ratingData);
        // Pre-fill form with existing values
        setRatings({
          reliability: ratingData.reliability || 0,
          expertise: ratingData.expertise || 0,
          communication: ratingData.communication || 0
        });
        setWouldChooseAgain(ratingData.wouldChooseAgain);
        setComment(ratingData.comment || '');
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Hiba történt az adatok betöltésekor.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (ratings.reliability === 0 || ratings.expertise === 0 || ratings.communication === 0) {
      setError('Kérjük, értékelje mindhárom szempontot!');
      return;
    }
    if (wouldChooseAgain === null) {
      setError('Kérjük, válassza ki, hogy újra választaná-e!');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const ratingData = {
        demandId: demandId,
        pharmacyId: user.uid,
        substituteId: application.applicantId,
        reliability: ratings.reliability,
        expertise: ratings.expertise,
        communication: ratings.communication,
        averageRating: (ratings.reliability + ratings.expertise + ratings.communication) / 3,
        wouldChooseAgain: wouldChooseAgain,
        comment: comment.trim() || null,
        demandDate: demand.date,
        updatedAt: serverTimestamp()
      };

      if (existingRating) {
        // Update existing rating
        await updateDoc(doc(db, 'ratings', existingRating.id), ratingData);
      } else {
        // Create new rating
        ratingData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'ratings'), ratingData);
      }

      // Update substitute's average rating in users collection
      await updateSubstituteRating(application.applicantId);

      setSuccess(true);
      setTimeout(() => {
        router.push('/pharmagister?tab=dashboard');
      }, 2000);

    } catch (err) {
      console.error('Error submitting rating:', err);
      setError('Hiba történt az értékelés mentésekor.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSubstituteRating = async (substituteId) => {
    try {
      // Get all ratings for this substitute
      const ratingsQuery = query(
        collection(db, 'ratings'),
        where('substituteId', '==', substituteId)
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      
      if (ratingsSnapshot.empty) return;

      let totalReliability = 0;
      let totalExpertise = 0;
      let totalCommunication = 0;
      let totalWouldChooseAgain = 0;
      let count = 0;

      ratingsSnapshot.forEach(doc => {
        const data = doc.data();
        totalReliability += data.reliability || 0;
        totalExpertise += data.expertise || 0;
        totalCommunication += data.communication || 0;
        if (data.wouldChooseAgain) totalWouldChooseAgain++;
        count++;
      });

      const avgRating = {
        reliability: totalReliability / count,
        expertise: totalExpertise / count,
        communication: totalCommunication / count,
        overall: (totalReliability + totalExpertise + totalCommunication) / (count * 3),
        wouldChooseAgainPercent: (totalWouldChooseAgain / count) * 100,
        count: count
      };

      // Update user document
      await updateDoc(doc(db, 'users', substituteId), {
        pharmaRating: avgRating,
        pharmaRatingUpdatedAt: serverTimestamp()
      });

    } catch (err) {
      console.error('Error updating substitute rating:', err);
    }
  };

  if (loading) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </RouteGuard>
    );
  }

  if (error && !demand) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center px-4`}>
          <div className={`text-center p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg max-w-md`}>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium mb-4`}>{error}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Vissza
            </button>
          </div>
        </div>
      </RouteGuard>
    );
  }

  if (success) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center px-4`}>
          <div className={`text-center p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg max-w-md`}>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium text-lg mb-2`}>
              Köszönjük az értékelést!
            </p>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
              Visszairányítjuk az irányítópultra...
            </p>
          </div>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} pb-20`}>
        {/* Header */}
        <div className="sticky top-0 bg-purple-500 dark:bg-purple-600 z-10 shadow-lg">
          <div className="max-w-xl mx-auto px-4 py-4">
            <button
              onClick={() => router.back()}
              className="text-white hover:text-purple-100 flex items-center gap-2 mb-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Vissza</span>
            </button>
            <h1 className="text-xl font-bold text-white">Helyettesítő értékelése</h1>
            <p className="text-purple-100 text-sm mt-1">
              {demand?.date && new Date(demand.date).toLocaleDateString('hu-HU', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} - {substituteData?.displayName || 'Ismeretlen'}
            </p>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 py-6">
          {/* Anonymous notice */}
          <div className={`rounded-xl p-4 mb-6 ${
            darkMode ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`font-medium ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  🔒 Anonim értékelés
                </p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Az értékelés névtelen - a helyettesítő nem fogja tudni, hogy melyik gyógyszertár értékelte.
                  Az értékelések 4 db összegyűjtése után jelennek meg a profilon.
                </p>
              </div>
            </div>
          </div>

          {existingRating && (
            <div className={`rounded-xl p-4 mb-6 ${
              darkMode ? 'bg-yellow-900/30 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                ✏️ Már értékelted ezt a helyettesítést. Az értékelés módosítható.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating criteria */}
            <div className={`rounded-xl p-4 space-y-6 ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              {RATING_CRITERIA.map((criterion) => (
                <StarRating
                  key={criterion.id}
                  criterion={criterion}
                  value={ratings[criterion.id]}
                  onChange={(value) => setRatings(prev => ({ ...prev, [criterion.id]: value }))}
                  darkMode={darkMode}
                  showInfo={showInfo}
                  setShowInfo={setShowInfo}
                />
              ))}
            </div>

            {/* Would choose again */}
            <div className={`rounded-xl p-4 ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <p className={`font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Újra választaná ezt a helyettesítőt?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWouldChooseAgain(true)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    wouldChooseAgain === true
                      ? 'bg-green-500 text-white'
                      : darkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ✅ Igen
                </button>
                <button
                  type="button"
                  onClick={() => setWouldChooseAgain(false)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    wouldChooseAgain === false
                      ? 'bg-red-500 text-white'
                      : darkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ❌ Nem
                </button>
              </div>
            </div>

            {/* Comment */}
            <div className={`rounded-xl p-4 ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <label className={`block font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Megjegyzés (opcionális)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Írjon bővebb véleményt a helyettesítőről..."
                className={`w-full px-3 py-2 rounded-lg border resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {comment.length}/500 karakter
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Mentés...
                </>
              ) : existingRating ? (
                'Értékelés módosítása'
              ) : (
                'Értékelés elküldése'
              )}
            </button>
          </form>
        </div>
      </div>
    </RouteGuard>
  );
}
