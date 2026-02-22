"use client";
import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, Trash2, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function DeleteAccountPage() {
  const { darkMode } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Kérjük adja meg az email címét.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/delete-account-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          reason: reason.trim(),
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        setError('Hiba történt. Kérjük írjon közvetlenül az info@pharmagister.hu címre.');
      }
    } catch (err) {
      console.error('Delete account request error:', err);
      setError('Hiba történt. Kérjük írjon közvetlenül az info@pharmagister.hu címre.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (isLoggedIn === null) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Logged in user - redirect to instant deletion in Settings
  if (isLoggedIn) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </Link>
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Fiók törlése
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-8 text-center`}>
            <Settings className="w-16 h-16 text-purple-600 mx-auto mb-4" />
            <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Azonnali fiók törlés
            </h2>
            <p className="leading-relaxed mb-6">
              Be vagy jelentkezve, így <strong>azonnal törölheted</strong> a fiókodat a Beállítások oldalon. 
              Nem kell várnod — az adataid azonnal törlésre kerülnek.
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="inline-block px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Fiók törlése a Beállításokban
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Beállítások → Fiók törlése → Azonnali törlés
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </Link>
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Fiók törlése
            </h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-8 text-center`}>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Kérés elküldve
            </h2>
            <p className="leading-relaxed mb-6">
              Fiók törlési kérését megkaptuk. Munkatársunk <strong>72 órán belül</strong> kapcsolatba lép Önnel 
              az <strong>{email}</strong> email címen a kérés feldolgozásához.
            </p>
            <p className="text-sm mb-6">
              A GDPR szabályok értelmében adatai <strong>30 napon belül</strong> törlésre kerülnek a rendszerünkből.
            </p>
            <Link 
              href="/"
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Vissza a főoldalra
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </Link>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Fiók és adatok törlése
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6`}>
          
          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Figyelem! Visszavonhatatlan művelet
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  A fiók törlése <strong>végleges és visszavonhatatlan</strong>. Az alábbi adatok <strong>véglegesen törlésre</strong> kerülnek:
                </p>
                <ul className="text-sm text-yellow-800 dark:text-yellow-200 list-disc pl-5 mt-2 space-y-1">
                  <li>Felhasználói profil és beállítások</li>
                  <li>Helyettesítési igények és jelentkezések</li>
                  <li>Chat üzenetek és beszélgetések</li>
                  <li>Értesítési előzmények</li>
                  <li>Profilkép és egyéb feltöltött média</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mb-6">
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Hogyan működik?
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Töltse ki az alábbi űrlapot az email címével ami a fiókjához tartozik</li>
              <li>Munkatársunk 72 órán belül kapcsolatba lép Önnel az email megerősítéshez</li>
              <li>Megerősítés után adatai 30 napon belül törlésre kerülnek (GDPR előírás szerint)</li>
            </ol>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Email cím <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fiok@pelda.hu"
                className={`w-full px-4 py-3 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Adja meg azt az email címet, amellyel regisztrált.
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Törlés oka (opcionális)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Miért szeretné törölni a fiókját? (Ez segít nekünk javítani a szolgáltatásunkat)"
                className={`w-full px-4 py-3 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none`}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                  submitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {submitting ? 'Küldés...' : 'Fiók törlésének kérelmezése'}
              </button>
              <Link
                href="/"
                className={`px-6 py-3 rounded-lg font-semibold ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                } transition-colors`}
              >
                Mégse
              </Link>
            </div>
          </form>

          {/* Alternative contact */}
          <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className="text-sm text-center">
              <strong>Egyéb kérdés?</strong> Írjon nekünk:{' '}
              <a href="mailto:info@pharmagister.hu" className="text-purple-600 hover:text-purple-700 font-medium">
                info@pharmagister.hu
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
