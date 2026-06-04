"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import RouteGuard from '@/app/components/RouteGuard';
import { db } from '@/lib/firebase';
import { getClientMarket } from '@/lib/marketI18n';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Star, Info, Check, Loader2, AlertCircle } from 'lucide-react';

const RATING_CATEGORIES = [
  {
    id: 'megbizhatas',
    label: 'Megbízhatóság',
    icon: '⏰',
    criteria: [
      {
        id: 'punctuality',
        label: 'Időben érkezés',
        descriptions: {
          1: 'Jelentős késés (30+ perc) vagy meg sem jelent',
          2: 'Többször is 15-30 percet késett',
          3: 'Kisebb késések (5-15 perc) előfordultak',
          4: 'Szinte mindig időben érkezett',
          5: 'Mindig pontosan, vagy korábban érkezett'
        }
      },
      {
        id: 'endTime',
        label: 'Munkaidő betartása',
        descriptions: {
          1: 'Rendszeresen korábban távozott',
          2: 'Néha korábban akart menni',
          3: 'A munkaidőt nagyjából betartotta',
          4: 'Megbízhatóan végigdolgozta a műszakot',
          5: 'Rugalmasan túlórázott is ha kellett'
        }
      },
      {
        id: 'commitment',
        label: 'Vállalás betartása',
        descriptions: {
          1: 'Lemondta az utolsó pillanatban',
          2: 'Többször is módosítani akarta az időpontot',
          3: 'Egy-két kisebb változtatás előfordult',
          4: 'Elkötelezett volt a megbeszélt időpont mellett',
          5: 'Maximálisan megbízható, mindig tartotta a szavát'
        }
      }
    ]
  },
  {
    id: 'szakmaiTudas',
    label: 'Szakmai tudás',
    icon: '💊',
    criteria: [
      {
        id: 'medicineKnowledge',
        label: 'Gyógyszerkészítmények ismerete',
        descriptions: {
          1: 'Alapvető hiányosságok, hibák',
          2: 'Bizonytalan, sokat kellett segíteni',
          3: 'Átlagos tudás, rutinfeladatokra megfelelő',
          4: 'Jó gyógyszerismeret, ritkán kérdezett',
          5: 'Kiváló, naprakész tudás'
        }
      },
      {
        id: 'prescriptionHandling',
        label: 'Receptkezelés',
        descriptions: {
          1: 'Hibásan kezelte a recepteket',
          2: 'Bizonytalan volt a szabályokban',
          3: 'Alapvető receptkezelés rendben',
          4: 'Precíz és pontos receptkezelés',
          5: 'Kifogástalan, minden típust ismert'
        }
      },
      {
        id: 'independence',
        label: 'Önálló munkavégzés',
        descriptions: {
          1: 'Folyamatos felügyelet kellett',
          2: 'Gyakran kért segítséget',
          3: 'Rutinfeladatokat önállóan végezte',
          4: 'Nagyrészt önállóan dolgozott',
          5: 'Teljesen önálló, proaktív munkavégzés'
        }
      },
      {
        id: 'softwareUsage',
        label: 'Patikai szoftver használata',
        descriptions: {
          1: 'Nem ismerte a rendszert',
          2: 'Lassan, nehézkesen használta',
          3: 'Alapfunkciókat kezelte',
          4: 'Jól ismerte a szoftvert',
          5: 'Profi szinten használta'
        }
      }
    ]
  },
  {
    id: 'kommunikacio',
    label: 'Kommunikáció',
    icon: '💬',
    criteria: [
      {
        id: 'patientCommunication',
        label: 'Betegekkel való kommunikáció',
        descriptions: {
          1: 'Udvariatlan vagy közömbös volt',
          2: 'Felületes, gyors kiszolgálás',
          3: 'Megfelelő, átlagos kommunikáció',
          4: 'Kedves, türelmes a betegekkel',
          5: 'Kiváló, a betegek szerették'
        }
      },
      {
        id: 'teamwork',
        label: 'Kollégákkal való együttműködés',
        descriptions: {
          1: 'Konfliktusok, nehéz együttműködés',
          2: 'Visszahúzódó, nem kért/adott segítséget',
          3: 'Megfelelő munkakapcsolat',
          4: 'Jó csapatjátékos',
          5: 'Kiválóan beilleszkedett a csapatba'
        }
      },
      {
        id: 'askingQuestions',
        label: 'Kérdésfeltevés ha bizonytalan',
        descriptions: {
          1: 'Nem kérdezett, hibázott inkább',
          2: 'Ritkán kérdezett amikor kellett volna',
          3: 'Időnként rákérdezett',
          4: 'Megfelelően kérdezett ha kellett',
          5: 'Proaktívan tisztázta a kérdéseket'
        }
      }
    ]
  }
];

const DE_CATEGORY_LABELS = {
  megbizhatas: 'Zuverlaessigkeit',
  szakmaiTudas: 'Fachwissen',
  kommunikacio: 'Kommunikation'
};

const DE_CRITERION_LABELS = {
  punctuality: 'Puenktliches Erscheinen',
  endTime: 'Einhaltung der Arbeitszeit',
  commitment: 'Verbindlichkeit',
  medicineKnowledge: 'Arzneimittelkenntnisse',
  prescriptionHandling: 'Rezeptbearbeitung',
  independence: 'Selbststaendiges Arbeiten',
  softwareUsage: 'Apothekensoftware',
  patientCommunication: 'Kommunikation mit Patient/innen',
  teamwork: 'Zusammenarbeit im Team',
  askingQuestions: 'Nachfragen bei Unsicherheit'
};

const DE_CRITERION_DESCRIPTIONS = {
  punctuality: {
    1: 'Deutliche Verspaetung (30+ Min.) oder nicht erschienen',
    2: 'Mehrfach 15-30 Minuten zu spaet',
    3: 'Kleinere Verspaetungen (5-15 Minuten) kamen vor',
    4: 'Fast immer puenktlich erschienen',
    5: 'Immer puenktlich oder frueher erschienen'
  },
  endTime: {
    1: 'Regelmaessig frueher gegangen',
    2: 'Wollte manchmal frueher gehen',
    3: 'Arbeitszeit grob eingehalten',
    4: 'Schicht verlaesslich vollstaendig gearbeitet',
    5: 'Bei Bedarf flexibel ueberstundenbereit'
  },
  commitment: {
    1: 'In letzter Minute abgesagt',
    2: 'Wollte den Termin mehrfach aendern',
    3: 'Ein bis zwei kleinere Aenderungen kamen vor',
    4: 'War an den vereinbarten Termin gebunden',
    5: 'Maximal verlaesslich, Wort immer gehalten'
  },
  medicineKnowledge: {
    1: 'Grundlegende Wissensluecken, Fehler',
    2: 'Unsicher, brauchte viel Unterstuetzung',
    3: 'Durchschnittliches Wissen, fuer Routine geeignet',
    4: 'Gute Arzneimittelkenntnisse, selten Rueckfragen',
    5: 'Exzellentes, aktuelles Fachwissen'
  },
  prescriptionHandling: {
    1: 'Rezepte fehlerhaft bearbeitet',
    2: 'Unsicher bei den Regeln',
    3: 'Grundlegende Rezeptbearbeitung in Ordnung',
    4: 'Praezise und korrekte Rezeptbearbeitung',
    5: 'Einwandfrei, alle Rezepttypen sicher'
  },
  independence: {
    1: 'Benoetigte staendige Aufsicht',
    2: 'Fragte haeufig nach Hilfe',
    3: 'Routineaufgaben selbststaendig erledigt',
    4: 'Groesstenteils selbststaendig gearbeitet',
    5: 'Vollstaendig selbststaendig und proaktiv'
  },
  softwareUsage: {
    1: 'System nicht beherrscht',
    2: 'Langsam und unsicher bedient',
    3: 'Grundfunktionen beherrscht',
    4: 'Software sicher genutzt',
    5: 'Auf Profi-Niveau gearbeitet'
  },
  patientCommunication: {
    1: 'Unhoeflich oder desinteressiert',
    2: 'Oberflaechliche, schnelle Betreuung',
    3: 'Angemessene, durchschnittliche Kommunikation',
    4: 'Freundlich und geduldig mit Patient/innen',
    5: 'Exzellent, bei Patient/innen sehr beliebt'
  },
  teamwork: {
    1: 'Konflikte, schwierige Zusammenarbeit',
    2: 'Zurueckhaltend, bot/fragte kaum Hilfe an',
    3: 'Angemessene Zusammenarbeit',
    4: 'Gute Teamarbeit',
    5: 'Sehr gut ins Team integriert'
  },
  askingQuestions: {
    1: 'Fragte nicht nach, machte eher Fehler',
    2: 'Fragte selten nach, obwohl noetig',
    3: 'Fragte gelegentlich nach',
    4: 'Fragte angemessen nach bei Bedarf',
    5: 'Klaerte Fragen proaktiv'
  }
};

function getLocalizedRatingCategories(market) {
  if (market !== 'de') return RATING_CATEGORIES;

  return RATING_CATEGORIES.map((category) => ({
    ...category,
    label: DE_CATEGORY_LABELS[category.id] || category.label,
    criteria: category.criteria.map((criterion) => ({
      ...criterion,
      label: DE_CRITERION_LABELS[criterion.id] || criterion.label,
      descriptions: DE_CRITERION_DESCRIPTIONS[criterion.id] || criterion.descriptions
    }))
  }));
}

function StarRating({ value, onChange, criterion, darkMode, showInfo, setShowInfo }) {
  const criterionLabel = criterion.label;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} truncate`}>
            {criterionLabel}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo(showInfo === criterion.id ? null : criterion.id)}
            className={`p-0.5 rounded-full transition-colors flex-shrink-0 ${
              showInfo === criterion.id 
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`w-6 h-6 ${
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
        <div className={`rounded-lg p-2 text-xs space-y-0.5 ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
        }`}>
          {Object.entries(criterion.descriptions).map(([stars, desc]) => (
            <div key={stars} className="flex gap-2">
              <span className="font-medium text-yellow-500 w-6 flex-shrink-0">{'★'.repeat(parseInt(stars))}</span>
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Kezdeti üres értékelések generálása
function getInitialRatings() {
  const initial = {};
  RATING_CATEGORIES.forEach(category => {
    initial[category.id] = {};
    category.criteria.forEach(criterion => {
      initial[category.id][criterion.id] = 0;
    });
  });
  return initial;
}

export default function RatingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();
  const demandId = params.demandId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState('megbizhatas');
  
  const [demand, setDemand] = useState(null);
  const [application, setApplication] = useState(null);
  const [substituteData, setSubstituteData] = useState(null);
  const [existingRating, setExistingRating] = useState(null);
  const ratingCategories = getLocalizedRatingCategories(market);

  // Rating form state - nested structure
  const [ratings, setRatings] = useState(getInitialRatings());
  const [wouldChooseAgain, setWouldChooseAgain] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadData();
  }, [demandId, user]);

  const loadData = async () => {
    if (!demandId || !user) return;
    
    try {
      setLoading(true);
      setError(null);

      // 1. Load demand
      const demandDoc = await getDoc(doc(db, 'pharmaDemands', demandId));
      if (!demandDoc.exists()) {
        setError(market === 'de' ? 'Anfrage nicht gefunden.' : 'Az igény nem található.');
        return;
      }
      const demandData = { id: demandDoc.id, ...demandDoc.data() };
      setDemand(demandData);

      // Check if user is the pharmacy owner
      const isPharmacyOwner = demandData.pharmacyId === user.uid;
      
      if (!isPharmacyOwner) {
        setError(market === 'de' ? 'Nur die Apotheke kann die Vertretung bewerten.' : 'Csak a gyógyszertár értékelheti a helyettesítőt.');
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
        setError(market === 'de' ? 'Keine angenommene Bewerbung zu dieser Anfrage.' : 'Nincs elfogadott jelentkező ehhez az igényhez.');
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
        // Pre-fill form with existing values (new nested structure)
        if (ratingData.detailedRatings) {
          setRatings(ratingData.detailedRatings);
        }
        setWouldChooseAgain(ratingData.wouldChooseAgain);
        setComment(ratingData.comment || '');
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError(market === 'de' ? 'Fehler beim Laden der Daten.' : 'Hiba történt az adatok betöltésekor.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation - check all criteria in all categories
    let allRated = true;
    let missingCategory = null;
    ratingCategories.forEach(category => {
      category.criteria.forEach(criterion => {
        if (!ratings[category.id]?.[criterion.id] || ratings[category.id][criterion.id] === 0) {
          allRated = false;
          if (!missingCategory) missingCategory = category.label;
        }
      });
    });

    if (!allRated) {
      setError(market === 'de' ? `Bitte bewerte alle Kriterien. (Fehlt: ${missingCategory})` : `Kérjük, értékelje az összes szempontot! (Hiányzik: ${missingCategory})`);
      return;
    }
    if (wouldChooseAgain === null) {
      setError(market === 'de' ? 'Bitte gib an, ob du die Person erneut waehlen wuerdest.' : 'Kérjük, válassza ki, hogy újra választaná-e!');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Calculate category averages
      const categoryAverages = {};
      let totalSum = 0;
      let totalCount = 0;
      
      RATING_CATEGORIES.forEach(category => {
        let categorySum = 0;
        let categoryCount = 0;
        category.criteria.forEach(criterion => {
          const value = ratings[category.id]?.[criterion.id] || 0;
          categorySum += value;
          categoryCount++;
          totalSum += value;
          totalCount++;
        });
        categoryAverages[category.id] = categorySum / categoryCount;
      });

      const overallAverage = totalSum / totalCount;

      const ratingData = {
        demandId: demandId,
        pharmacyId: user.uid,
        substituteId: application.applicantId,
        // Detailed ratings - new structure
        detailedRatings: ratings,
        // Category averages for summary
        categoryAverages: categoryAverages,
        // Legacy fields for compatibility
        reliability: categoryAverages.megbizhatas,
        expertise: categoryAverages.szakmaiTudas,
        communication: categoryAverages.kommunikacio,
        averageRating: overallAverage,
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
        router.push('/pharmagister?tab=ratings');
      }, 2000);

    } catch (err) {
      console.error('Error submitting rating:', err);
      setError(market === 'de' ? 'Fehler beim Speichern der Bewertung.' : 'Hiba történt az értékelés mentésekor.');
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

      ratingsSnapshot.forEach(d => {
        const data = d.data();
        // Use categoryAverages if available, fallback to old structure
        totalReliability += data.categoryAverages?.megbizhatas || data.reliability || 0;
        totalExpertise += data.categoryAverages?.szakmaiTudas || data.expertise || 0;
        totalCommunication += data.categoryAverages?.kommunikacio || data.communication || 0;
        if (data.wouldChooseAgain) totalWouldChooseAgain++;
        count++;
      });

      const avgRating = {
        averageRating: (totalReliability + totalExpertise + totalCommunication) / (count * 3),
        ratingCount: count,
        wouldChooseAgainPercent: Math.round((totalWouldChooseAgain / count) * 100),
        ratings: {
          megbizhatas: totalReliability / count,
          szakmaiTudas: totalExpertise / count,
          kommunikacio: totalCommunication / count
        }
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
              {market === 'de' ? 'Zurueck' : 'Vissza'}
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
              {market === 'de' ? 'Danke fuer deine Bewertung!' : 'Köszönjük az értékelést!'}
            </p>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
              {market === 'de' ? 'Weiterleitung zum Dashboard...' : 'Visszairányítjuk az irányítópultra...'}
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
              <span className="font-medium">{market === 'de' ? 'Zurueck' : 'Vissza'}</span>
            </button>
            <h1 className="text-xl font-bold text-white">{market === 'de' ? 'Bewertung der Vertretung' : 'Helyettesítő értékelése'}</h1>
            <p className="text-purple-100 text-sm mt-1">
              {demand?.date && (demand.date.toDate ? demand.date.toDate() : new Date(demand.date)).toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} - {substituteData?.displayName || substituteData?.name || (market === 'de' ? 'Unbekannt' : 'Ismeretlen')}
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
                  {market === 'de' ? '🔒 Anonyme Bewertung' : '🔒 Anonim értékelés'}
                </p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {market === 'de'
                    ? 'Die Bewertung ist anonym. Die Vertretung sieht nicht, welche Apotheke bewertet hat. Bewertungen erscheinen im Profil nach 4 eingegangenen Bewertungen.'
                    : 'Az értékelés névtelen - a helyettesítő nem fogja tudni, hogy melyik gyógyszertár értékelte. Az értékelések 4 db összegyűjtése után jelennek meg a profilon.'}
                </p>
              </div>
            </div>
          </div>

          {existingRating && (
            <div className={`rounded-xl p-4 mb-6 ${
              darkMode ? 'bg-yellow-900/30 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                {market === 'de' ? '✏️ Du hast diese Vertretung bereits bewertet. Die Bewertung kann geaendert werden.' : '✏️ Már értékelted ezt a helyettesítést. Az értékelés módosítható.'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rating categories */}
            {ratingCategories.map((category) => {
              const isExpanded = expandedCategory === category.id;
              // Calculate category completion
              const criteriaCount = category.criteria.length;
              const ratedCount = category.criteria.filter(c => ratings[category.id]?.[c.id] > 0).length;
              const categoryAvg = ratedCount > 0 
                ? (category.criteria.reduce((sum, c) => sum + (ratings[category.id]?.[c.id] || 0), 0) / criteriaCount).toFixed(1)
                : null;

              return (
                <div key={category.id} className={`rounded-xl overflow-hidden ${
                  darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                }`}>
                  {/* Category header */}
                  <button
                    type="button"
                    onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                    className={`w-full p-4 flex items-center justify-between transition-colors ${
                      darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="text-left">
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category.label}
                        </h3>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {ratedCount}/{criteriaCount} {market === 'de' ? 'bewertet' : 'értékelve'}
                          {categoryAvg && <span className="ml-2 text-yellow-500">⭐ {categoryAvg}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ratedCount === criteriaCount && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                      <svg 
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Category criteria */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 space-y-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="pt-4 space-y-4">
                        {category.criteria.map((criterion) => (
                          <StarRating
                            key={criterion.id}
                            criterion={criterion}
                            value={ratings[category.id]?.[criterion.id] || 0}
                            onChange={(value) => setRatings(prev => ({
                              ...prev,
                              [category.id]: {
                                ...prev[category.id],
                                [criterion.id]: value
                              }
                            }))}
                            darkMode={darkMode}
                            showInfo={showInfo}
                            setShowInfo={setShowInfo}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Would choose again */}
            <div className={`rounded-xl p-4 ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <p className={`font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {market === 'de' ? 'Wuerdest du diese Vertretung wieder waehlen?' : 'Újra választaná ezt a helyettesítőt?'}
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
                  {market === 'de' ? '✅ Ja' : '✅ Igen'}
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
                  {market === 'de' ? '❌ Nein' : '❌ Nem'}
                </button>
              </div>
            </div>

            {/* Comment */}
            <div className={`rounded-xl p-4 ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <label className={`block font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {market === 'de' ? 'Kommentar (optional)' : 'Megjegyzés (opcionális)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={market === 'de' ? 'Schreibe optional eine ausfuehrlichere Rueckmeldung...' : 'Írjon bővebb véleményt a helyettesítőről...'}
                className={`w-full px-3 py-2 rounded-lg border resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {comment.length}/500 {market === 'de' ? 'Zeichen' : 'karakter'}
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
                  {market === 'de' ? 'Speichern...' : 'Mentés...'}
                </>
              ) : existingRating ? (
                market === 'de' ? 'Bewertung aktualisieren' : 'Értékelés módosítása'
              ) : (
                market === 'de' ? 'Bewertung absenden' : 'Értékelés elküldése'
              )}
            </button>
          </form>
        </div>
      </div>
    </RouteGuard>
  );
}
