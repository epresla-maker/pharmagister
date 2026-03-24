"use client";
import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// --- Jelentési kategóriák részletes adatokkal ---
const reportCategories = {
  user: [
    {
      id: 'harassment',
      label: 'Zaklatás',
      description: 'Fontos tudni, hogyan ismerheted fel a zaklatást. Jogod van arra, hogy biztonságban érezd magad, valamint hogy kedvesen és tisztelettel bánjanak veled.',
      examples: [
        'Valaki ismétlődően üzeneteket küld neked, pedig te nem is reagálsz.',
        'Emberek kigúnyolnak egy chatben.',
        'Valaki azzal fenyeget, hogy megosztja a privát információidat.',
      ],
    },
    {
      id: 'self-harm',
      label: 'Öngyilkosság vagy önsértés',
      description: 'Ha valaki veszélyben van, kérjük, fordulj a helyi segélyhívóhoz. A jelentésedet komolyan vesszük.',
      examples: [
        'Valaki önsértésre utaló tartalmakat oszt meg.',
        'Valaki öngyilkossággal fenyegetőzik.',
      ],
    },
    {
      id: 'impersonation',
      label: 'Valaki másnak adja ki magát',
      description: 'Más személynek vagy szervezetnek kiadni magát sérti a közösségi irányelveinket.',
      examples: [
        'Valaki a te nevedet és fotódat használja.',
        'Valaki egy gyógyszertár vagy intézmény nevében lép fel hamisan.',
      ],
    },
    {
      id: 'violence',
      label: 'Erőszak vagy veszélyes szervezetek',
      description: 'Az erőszakra buzdítás vagy veszélyes szervezetek népszerűsítése nem megengedett.',
      examples: [
        'Valaki erőszakkal fenyeget.',
        'Veszélyes szervezetek propagandáját terjesztik.',
      ],
    },
    {
      id: 'inappropriate',
      label: 'Nem odaillő tartalom',
      description: 'A közösségünk szakmai környezet, ahol a nem megfelelő tartalom nem megengedett.',
      examples: [
        'Szexuális vagy obszcén tartalom megosztása.',
        'Szakmához nem illő, megbotránkoztató tartalom.',
      ],
    },
    {
      id: 'restricted',
      label: 'Korlátozott dolgok értékesítése vagy hirdetése',
      description: 'Bizonyos termékek és szolgáltatások hirdetése korlátozva van a platformon.',
      examples: [
        'Illegális termékek hirdetése.',
        'Engedély nélküli gyógyszerek árusítása.',
      ],
    },
    {
      id: 'spam',
      label: 'Kéretlen vagy csalárd tartalom',
      description: 'A spam és a megtévesztő tartalom rombolja a közösség minőségét.',
      examples: [
        'Valaki ismétlődő reklámüzeneteket küld.',
        'Megtévesztő linkek vagy adathalász kísérletek.',
      ],
    },
    {
      id: 'other',
      label: 'Egyéb',
      description: 'Ha a fentiek közül egyik sem illik, írd le a problémát a saját szavaiddal.',
      examples: [],
    },
  ],
  message: [
    {
      id: 'harassment',
      label: 'Zaklatás',
      description: 'Fontos tudni, hogyan ismerheted fel a zaklatást. Jogod van arra, hogy biztonságban érezd magad, valamint hogy kedvesen és tisztelettel bánjanak veled.',
      examples: [
        'Valaki ismétlődően üzeneteket küld neked, pedig te nem is reagálsz.',
        'Emberek kigúnyolnak egy chatben.',
        'Valaki azzal fenyeget, hogy megosztja a privát információidat.',
      ],
    },
    {
      id: 'threat',
      label: 'Fenyegetés',
      description: 'A fenyegetés semmilyen formában nem elfogadható a platformunkon.',
      examples: [
        'Valaki közvetlenül fenyeget téged.',
        'Valaki azzal fenyeget, hogy árt neked vagy a környezetednek.',
      ],
    },
    {
      id: 'inappropriate',
      label: 'Nem odaillő tartalom',
      description: 'A közösségünk szakmai környezet, ahol a nem megfelelő tartalom nem megengedett.',
      examples: [
        'Szexuális vagy obszcén üzenetek.',
        'Szakmához nem illő, megbotránkoztató tartalom.',
      ],
    },
    {
      id: 'spam',
      label: 'Kéretlen vagy csalárd tartalom',
      description: 'A spam és a megtévesztő tartalom rombolja a közösség minőségét.',
      examples: [
        'Valaki ismétlődő reklámüzeneteket küld.',
        'Megtévesztő linkek vagy adathalász kísérletek.',
      ],
    },
    {
      id: 'impersonation',
      label: 'Valaki másnak adja ki magát',
      description: 'Más személynek vagy szervezetnek kiadni magát sérti a közösségi irányelveinket.',
      examples: [
        'Valaki a te nevedet és fotódat használja.',
        'Valaki egy gyógyszertár vagy intézmény nevében lép fel hamisan.',
      ],
    },
    {
      id: 'other',
      label: 'Egyéb',
      description: 'Ha a fentiek közül egyik sem illik, írd le a problémát a saját szavaiddal.',
      examples: [],
    },
  ],
  demand: [
    {
      id: 'fake',
      label: 'Hamis hirdetés',
      description: 'Hamis vagy megtévesztő hirdetések nem megengedettek a platformon.',
      examples: [
        'Nem létező pozíciók hirdetése.',
        'Hamis munkakörülmények feltüntetése.',
      ],
    },
    {
      id: 'spam',
      label: 'Kéretlen vagy csalárd tartalom',
      description: 'A spam és a megtévesztő tartalom rombolja a közösség minőségét.',
      examples: [
        'Ismétlődő, értelmetlen hirdetések.',
        'Megtévesztő tartalom.',
      ],
    },
    {
      id: 'unprofessional',
      label: 'Szakszerűtlen tartalom',
      description: 'A platformon csak szakmailag releváns tartalom megengedett.',
      examples: [
        'Szakmához nem kapcsolódó tartalom.',
        'Pontatlan vagy félrevezető szakmai információk.',
      ],
    },
    {
      id: 'other',
      label: 'Egyéb',
      description: 'Ha a fentiek közül egyik sem illik, írd le a problémát a saját szavaiddal.',
      examples: [],
    },
  ],
};

export default function ReportModal({ 
  isOpen, 
  onClose, 
  reportType, // 'user' | 'message' | 'demand'
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
      });

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900">
      
      {/* === 1. LÉPÉS: KATEGÓRIA VÁLASZTÓ === */}
      {step === 'categories' && (
        <div className="flex flex-col h-full">
          {/* Header - Mégsem gomb */}
          <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            <button
              onClick={handleClose}
              className="text-blue-400 hover:text-blue-300 text-base font-medium"
            >
              Mégsem
            </button>
          </div>

          {/* Tartalom */}
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <h1 className="text-[1.4rem] font-bold text-white mb-3 leading-tight">
              Válassz ki egy jelentendő problémát.
            </h1>
            <p className="text-gray-400 text-[0.9rem] mb-6 leading-relaxed">
              Nem közöljük az illetővel, hogy ki jelentette. Ha valakit közvetlen veszély fenyeget, ne késlekedj! Hívd azonnal a helyi sürgősségi szolgálatokat.
            </p>

            {/* Kategória lista */}
            <div className="divide-y divide-gray-700">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setStep('detail');
                  }}
                  className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-800/50 transition-colors -mx-1 px-1 rounded-lg"
                >
                  <span className="text-white text-base">{cat.label}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-500 flex-shrink-0 ml-3">
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
          {/* Header kép/ikon terület */}
          <div className="bg-gradient-to-b from-blue-900/80 to-gray-900 pt-[max(1rem,env(safe-area-inset-top))] pb-6">
            {/* Vissza gomb */}
            <div className="px-4 mb-4">
              <button
                onClick={() => {
                  setStep('categories');
                  setSelectedCategory(null);
                  setDetails('');
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>
            
            {/* Ikon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-blue-600/30 rounded-2xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-blue-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Tartalom */}
          <div className="flex-1 overflow-y-auto px-5 pb-32">
            <h2 className="text-xl font-bold text-white mb-3 mt-4">
              {selectedCategory.label}
            </h2>
            <p className="text-gray-400 text-[0.9rem] leading-relaxed mb-6">
              {selectedCategory.description}
            </p>

            {/* Példák */}
            {selectedCategory.examples.length > 0 && (
              <div className="mb-6">
                <h3 className="text-base font-semibold text-white mb-4">
                  Példák arra, hogy milyen tartalmakat jelentsél:
                </h3>
                <div className="space-y-4">
                  {selectedCategory.examples.map((example, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span className="text-gray-300 text-[0.9rem] leading-relaxed">{example}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Részletek (opcionális) */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                További részletek (opcionális)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Írd le a problémát a saját szavaiddal..."
                className="w-full p-3 rounded-xl border bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Alsó rögzített sáv */}
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-gray-500 text-xs text-center mb-3">
              A jelentésedet megvizsgáljuk és szükség esetén intézkedünk.
            </p>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold text-base transition-colors ${
                loading
                  ? 'bg-blue-400 text-white/70 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white active:bg-blue-700'
              }`}
            >
              {loading ? 'Küldés...' : 'Jelentés elküldése'}
            </button>
          </div>
        </div>
      )}

      {/* === 3. LÉPÉS: SIKERES JELENTÉS === */}
      {step === 'success' && (
        <div className="flex flex-col items-center justify-center h-full px-6">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-white mb-3 text-center">
            Köszönjük a jelentést!
          </h2>
          <p className="text-gray-400 text-center text-base leading-relaxed max-w-sm">
            Hamarosan megvizsgáljuk, és ha szükséges, megtesszük a szükséges lépéseket.
          </p>
        </div>
      )}
    </div>
  );
}
