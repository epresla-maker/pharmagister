'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function AccountActionPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/account-action?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data);
      } else {
        setTokenData(data);
      }
    } catch (err) {
      setError({ error: 'Hiba történt a token ellenőrzése során', code: 'NETWORK_ERROR' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/account-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, confirm: true })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data);
        setProcessing(false);
      } else {
        setResult(data);
        setCompleted(true);
        setProcessing(false);
      }
    } catch (err) {
      setError({ error: 'Hiba történt a művelet végrehajtása során', code: 'NETWORK_ERROR' });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Token ellenőrzése...</p>
        </div>
      </div>
    );
  }

  if (completed && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          {result.action === 'keep' ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Fiók megtartva!</h1>
              <p className="text-gray-600 mb-6">
                {result.message}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                A fiókod aktív marad. Most állítsd be a jelszavadat, hogy tudjál belépni!
              </p>
              {result.passwordSetUrl && (
                <a
                  href={result.passwordSetUrl}
                  className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Jelszó beállítása →
                </a>
              )}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Fiók törölve</h1>
              <p className="text-gray-600 mb-6">
                {result.message}
              </p>
              <p className="text-sm text-gray-500">
                Minden adatod törlésre került az adatbázisból.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    let errorMessage = 'Ismeretlen hiba történt';
    let errorIcon = <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;

    if (error.code === 'INVALID_TOKEN') {
      errorMessage = 'Ez a link érvénytelen. Lehet, hogy már törölve lett a fiókod, vagy rossz linket használtál.';
    } else if (error.code === 'ALREADY_USED') {
      errorMessage = 'Ez a link már fel lett használva. Nem lehet újra felhasználni.';
      errorIcon = <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />;
    } else if (error.code === 'EXPIRED') {
      errorMessage = 'Ez a link lejárt. Kérlek, vedd fel velünk a kapcsolatot, ha segítségre van szükséged.';
      errorIcon = <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />;
    } else if (error.error) {
      errorMessage = error.error;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          {errorIcon}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hiba</h1>
          <p className="text-gray-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (tokenData) {
    const isKeep = tokenData.action === 'keep';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            {isKeep ? (
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isKeep ? 'Fiók megtartása' : 'Fiók törlése'}
            </h1>
            <p className="text-gray-600">
              Szia, <strong>{tokenData.name}</strong>!
            </p>
            <p className="text-sm text-gray-500 mt-1">{tokenData.email}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            {isKeep ? (
              <p className="text-gray-700">
                Ha ezt a gombot megnyomod, a fiókod <strong>aktív marad</strong> az oldalunkon. 
                Később aktiválhatod a jelszavadat és beléphetssz.
              </p>
            ) : (
              <div>
                <p className="text-gray-700 mb-2">
                  Ha ezt a gombot megnyomod, a fiókod és <strong>minden adatod véglegesen törlésre kerül</strong>:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>Felhasználói adatok</li>
                  <li>Beállítások</li>
                  <li>Push értesítések</li>
                  <li>Minden kapcsolódó információ</li>
                </ul>
                <p className="text-sm text-red-600 mt-3 font-medium">
                  ⚠️ Ez a művelet nem vonható vissza!
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={processing}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isKeep
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {processing ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Feldolgozás...
              </span>
            ) : isKeep ? (
              'Igen, megtartom a fiókomat'
            ) : (
              'Igen, töröljétek a fiókomat'
            )}
          </button>

          {!isKeep && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Ha mégsem szeretnéd törölni a fiókodat, egyszerűen zárd be ezt az oldalt.
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
