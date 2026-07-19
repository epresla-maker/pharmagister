"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClientMarket } from '../../lib/marketI18n';
import { MARKET_COOKIE, normalizeMarket } from '../../lib/market';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMarket = searchParams.get('market');
  const market = normalizeMarket(urlMarket || getClientMarket());
  const [status, setStatus] = useState('loading'); // loading, success, error, expired
  const [message, setMessage] = useState(market === 'de' ? 'E-Mail-Adresse wird bestaetigt...' : 'Email cím ellenőrzése...');

  useEffect(() => {
    document.cookie = `${MARKET_COOKIE}=${market}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, [market]);

  useEffect(() => {
    setMessage(market === 'de' ? 'E-Mail-Adresse wird bestaetigt...' : 'Email cím ellenőrzése...');
  }, [market]);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage(market === 'de' ? 'Ungueltiger Verifizierungslink' : 'Érvénytelen verifikációs link');
        return;
      }

      try {
        // API route hívása (Firebase Admin SDK-val frissíti a Firestore ÉS Firebase Auth-ot is)
        const response = await fetch('/api/verify-email-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, market }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 410) {
            setStatus('expired');
            setMessage(data.error);
          } else {
            setStatus('error');
            setMessage(data.error || (market === 'de' ? 'Fehler bei der E-Mail-Bestaetigung' : 'Hiba történt az email megerősítése során'));
          }
          return;
        }

        setStatus('success');
        setMessage(market === 'de' ? 'E-Mail-Adresse erfolgreich bestaetigt! ✅' : 'Email cím sikeresen megerősítve! ✅');
        
        // 3 mp múlva átirányítás
        setTimeout(() => {
          router.push('/login?verified=true');
        }, 3000);

      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(market === 'de' ? 'Fehler bei der E-Mail-Bestaetigung' : 'Hiba történt az email megerősítése során');
      }
    };

    verifyEmail();
  }, [searchParams, router, market]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-2">{message}</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">{market === 'de' ? 'Erfolgreich!' : 'Sikeres!'}</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">{market === 'de' ? 'Weiterleitung zur Anmeldung...' : 'Átirányítás a bejelentkezéshez...'}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">{market === 'de' ? 'Fehler' : 'Hiba'}</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => router.push('/register')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              {market === 'de' ? 'Zurueck zur Registrierung' : 'Vissza a regisztrációhoz'}
            </button>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="text-6xl mb-4">⏰</div>
            <h1 className="text-2xl font-bold text-orange-600 mb-2">{market === 'de' ? 'Abgelaufen' : 'Lejárt'}</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              {market === 'de' ? 'Neuen Link anfordern' : 'Új link kérése'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
