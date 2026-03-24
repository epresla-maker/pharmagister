"use client";
import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { createNotificationWithPush } from '@/lib/notifications';

const ADMIN_UID = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2';

// --- Jelentési kategóriák ---
const reportCategories = {
  user: [
    {
      id: 'harassment',
      label: 'Zaklató viselkedés',
      description: 'A platformon mindenkinek joga van a tiszteletteljes bánásmódhoz. Ide tartoznak a bántalmazó, megfélemlítő megnyilvánulások.',
      examples: [
        'Többszöri nem kívánt megkeresés válasz nélkül is.',
        'Gúnyolódás, megszégyenítés a közösségben.',
        'Személyes adatok nyilvánosságra hozatalával való fenyegetés.',
      ],
    },
    {
      id: 'self-harm',
      label: 'Veszélyeztetettség jelzése',
      description: 'Amennyiben úgy ítéled meg, hogy valaki veszélyben van, kérjük jelezd. Sürgős esetben hívd a 112-t.',
      examples: [
        'Önsértésre utaló tartalom megjelenítése.',
        'Közvetlen veszélyhelyzetre utaló kijelentések.',
      ],
    },
    {
      id: 'impersonation',
      label: 'Hamis személyazonosság',
      description: 'Tilos más személy vagy szervezet nevében fellépni a platformon.',
      examples: [
        'Más felhasználó nevének és képének jogosulatlan használata.',
        'Gyógyszertár vagy intézmény nevében történő hamis megjelenés.',
      ],
    },
    {
      id: 'violence',
      label: 'Fenyegetés, erőszakra uszítás',
      description: 'Minden erőszakra buzdító vagy fenyegető tartalom tiltott.',
      examples: [
        'Közvetlen fenyegetés más felhasználó felé.',
        'Erőszakos cselekmények támogatása vagy népszerűsítése.',
      ],
    },
    {
      id: 'inappropriate',
      label: 'Kifogásolható tartalom',
      description: 'A Pharmagister szakmai közösség, ezért az ide nem illő tartalom nem tolerálható.',
      examples: [
        'Obszcén vagy szexuális jellegű tartalom.',
        'A szakmai közeghez méltatlan, megbotránkoztató anyag.',
      ],
    },
    {
      id: 'restricted',
      label: 'Tiltott hirdetés vagy értékesítés',
      description: 'Egyes termékek és szolgáltatások reklámozása nem engedélyezett.',
      examples: [
        'Jogszabályba ütköző termékek hirdetése.',
        'Engedély nélküli gyógyszer-forgalmazás.',
      ],
    },
    {
      id: 'spam',
      label: 'Spam vagy megtévesztés',
      description: 'A félrevezető és kéretlen tartalmak rontják a közösségi élményt.',
      examples: [
        'Tömeges, ismétlődő reklámjellegű üzenetek.',
        'Adathalász linkek vagy csalárd ajánlatok.',
      ],
    },
    {
      id: 'other',
      label: 'Egyéb probléma',
      description: 'Ha a felsorolt kategóriák közül egyik sem fedi le a problémát, itt részletezheted.',
      examples: [],
    },
  ],
  message: [
    {
      id: 'harassment',
      label: 'Zaklató viselkedés',
      description: 'A platformon mindenkinek joga van a tiszteletteljes bánásmódhoz. Ide tartoznak a bántalmazó, megfélemlítő megnyilvánulások.',
      examples: [
        'Többszöri nem kívánt megkeresés válasz nélkül is.',
        'Gúnyolódás, megszégyenítés a közösségben.',
        'Személyes adatok nyilvánosságra hozatalával való fenyegetés.',
      ],
    },
    {
      id: 'threat',
      label: 'Közvetlen fenyegetés',
      description: 'Semmilyen fenyegető megnyilvánulás nem megengedett a platformon.',
      examples: [
        'Személyedet érintő közvetlen fenyegetés.',
        'Bármilyen jellegű ártó szándék kifejezése.',
      ],
    },
    {
      id: 'inappropriate',
      label: 'Kifogásolható tartalom',
      description: 'A Pharmagister szakmai közösség, ezért az ide nem illő tartalom nem tolerálható.',
      examples: [
        'Obszcén vagy szexuális jellegű üzenetek.',
        'A szakmai közeghez méltatlan, megbotránkoztató anyag.',
      ],
    },
    {
      id: 'spam',
      label: 'Spam vagy megtévesztés',
      description: 'A félrevezető és kéretlen tartalmak rontják a közösségi élményt.',
      examples: [
        'Tömeges, ismétlődő reklámjellegű üzenetek.',
        'Adathalász linkek vagy csalárd ajánlatok.',
      ],
    },
    {
      id: 'impersonation',
      label: 'Hamis személyazonosság',
      description: 'Tilos más személy vagy szervezet nevében fellépni a platformon.',
      examples: [
        'Más felhasználó nevének és képének jogosulatlan használata.',
        'Gyógyszertár vagy intézmény nevében történő hamis megjelenés.',
      ],
    },
    {
      id: 'other',
      label: 'Egyéb probléma',
      description: 'Ha a felsorolt kategóriák közül egyik sem fedi le a problémát, itt részletezheted.',
      examples: [],
    },
  ],
  demand: [
    {
      id: 'fake',
      label: 'Valótlan hirdetés',
      description: 'Megtévesztő vagy fiktív álláshirdetések nem szerepelhetnek a platformon.',
      examples: [
        'Nem létező pozíciók meghirdetése.',
        'Valóságtól eltérő munkakörülmények feltüntetése.',
      ],
    },
    {
      id: 'spam',
      label: 'Spam vagy megtévesztés',
      description: 'A félrevezető és kéretlen tartalmak rontják a közösségi élményt.',
      examples: [
        'Ismétlődő, duplikált hirdetések.',
        'Félrevezető információk közlése.',
      ],
    },
    {
      id: 'unprofessional',
      label: 'Nem szakmai jellegű tartalom',
      description: 'Csak a gyógyszertári szakmához kapcsolódó tartalom engedélyezett.',
      examples: [
        'A szakmával összefüggésben nem álló bejegyzés.',
        'Hibás vagy félrevezető szakmai információ.',
      ],
    },
    {
      id: 'other',
      label: 'Egyéb probléma',
      description: 'Ha a felsorolt kategóriák közül egyik sem fedi le a problémát, itt részletezheted.',
      examples: [],
    },
  ],
};

// Comment és post típusok a message kategóriákat használják (univerzális tartalom-jelentés)
reportCategories.comment = reportCategories.message;
reportCategories.communityPost = reportCategories.message;
reportCategories.rssComment = reportCategories.message;
reportCategories.rssPost = reportCategories.message;
reportCategories.pharmaDemandPost = reportCategories.message;
reportCategories.serviceFeedPost = reportCategories.message;
reportCategories.allandoKeresPost = reportCategories.message;

export default function ReportModal({ 
  isOpen, 
  onClose, 
  reportType, // 'user' | 'message' | 'demand' | 'comment' | 'communityPost' | etc.
  reportedUserId,
  reportedUserName,
  itemId,
  itemContent
}) {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [step, setStep] = useState('categories'); // 'categories' | 'detail' | 'success'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = reportCategories[reportType] || reportCategories.user;

  const handleClose = () => {
    onClose();
    // Reset állapotja kis késéssel hogy ne villanjon
    setTimeout(() => {
      setStep('categories');
      setSelectedCategory(null);
      setDetails('');
    }, 300);
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    setLoading(true);

    try {
      const reportRef = doc(collection(db, 'reports'));
      await setDoc(reportRef, {
        reporterId: user.uid,
        reporterEmail: user.email,
        type: reportType,
        reportedUserId: reportedUserId || null,
        reportedUserName: reportedUserName || null,
        itemId: itemId || null,
        itemContent: itemContent || null,
        reason: selectedCategory.label,
        details,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Push + in-app értesítés adminnak
      await createNotificationWithPush({
        userId: ADMIN_UID,
        type: 'content_report',
        title: 'Új bejelentés érkezett',
        message: `${selectedCategory.label} – ${reportedUserName || reportType}${itemContent ? `: "${(itemContent).substring(0, 60)}"` : ''}`,
        data: { url: '/admin' },
        url: '/admin'
      }).catch(() => {});

      // Email értesítés küldése adminnak
      const idToken = await user.getIdToken();
      await fetch('/api/send-report-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          reportType,
          reportedUserName,
          reason: selectedCategory.label,
          details,
        })
      }).catch(() => {});

      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (error) {
      console.error('Report error:', error);
      alert('Hiba történt a jelentés során');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col ${darkMode ? 'bg-[#1a1a2e]' : 'bg-white'}`}>
      
      {/* === 1. LÉPÉS: KATEGÓRIA VÁLASZTÓ === */}
      {step === 'categories' && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            <button
              onClick={handleClose}
              className="text-purple-500 hover:text-purple-400 text-base font-medium"
            >
              Bezárás
            </button>
          </div>

          {/* Tartalom */}
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <h1 className={`text-[1.4rem] font-bold mb-3 leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Mi a probléma?
            </h1>
            <p className={`text-[0.9rem] mb-6 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              A bejelentésed bizalmasan kezeljük. Azonnali veszélyhelyzet esetén kérjük, hívd a 112-t.
            </p>

            {/* Kategória lista */}
            <div className={`divide-y ${darkMode ? 'divide-gray-700/50' : 'divide-gray-200'}`}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setStep('detail');
                  }}
                  className={`w-full flex items-center justify-between py-4 text-left transition-colors -mx-1 px-1 rounded-lg ${
                    darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-base ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{cat.label}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 flex-shrink-0 ml-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === 2. LÉPÉS: RÉSZLETES NÉZET === */}
      {step === 'detail' && selectedCategory && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`pt-[max(1rem,env(safe-area-inset-top))] pb-4 px-4 border-b ${darkMode ? 'border-gray-700/50' : 'border-gray-200'}`}>
            <button
              onClick={() => {
                setStep('categories');
                setSelectedCategory(null);
                setDetails('');
              }}
              className="text-purple-500 hover:text-purple-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Tartalom */}
          <div className="flex-1 overflow-y-auto px-5 pb-32">
            <h2 className={`text-xl font-bold mb-3 mt-5 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {selectedCategory.label}
            </h2>
            <p className={`text-[0.9rem] leading-relaxed mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {selectedCategory.description}
            </p>

            {/* Példák */}
            {selectedCategory.examples.length > 0 && (
              <div className="mb-6">
                <h3 className={`text-base font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Ilyen esetekben alkalmazható:
                </h3>
                <div className="space-y-3">
                  {selectedCategory.examples.map((example, i) => (
                    <div key={i} className={`flex items-start gap-3 pl-1`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${darkMode ? 'bg-purple-400' : 'bg-purple-500'}`} />
                      <span className={`text-[0.9rem] leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{example}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Részletek (opcionális) */}
            <div className="mt-4">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Megjegyzés (nem kötelező)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Részletezd röviden a tapasztaltakat..."
                className={`w-full p-3 rounded-xl border focus:outline-none resize-none ${
                  darkMode 
                    ? 'bg-[#252547] border-gray-700 text-white placeholder-gray-500 focus:border-purple-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500'
                }`}
              />
            </div>
          </div>

          {/* Alsó rögzített sáv */}
          <div className={`fixed bottom-0 left-0 right-0 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            darkMode ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-200'
          }`}>
            <p className={`text-xs text-center mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Bejelentésedet áttekintjük és szükség esetén lépéseket teszünk.
            </p>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold text-base transition-colors ${
                loading
                  ? 'bg-purple-400 text-white/70 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white active:bg-purple-800'
              }`}
            >
              {loading ? 'Küldés...' : 'Bejelentés küldése'}
            </button>
          </div>
        </div>
      )}

      {/* === 3. LÉPÉS: SIKERES JELENTÉS === */}
      {step === 'success' && (
        <div className="flex flex-col items-center justify-center h-full px-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${darkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold mb-3 text-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Bejelentés elküldve
          </h2>
          <p className={`text-center text-base leading-relaxed max-w-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Köszönjük, hogy segítesz a közösség védelmében. A bejelentésedet hamarosan feldolgozzuk.
          </p>
        </div>
      )}
    </div>
  );
}
