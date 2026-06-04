"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Check, AlertCircle, Lock } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const market = getClientMarket();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(market === 'de' ? 'Token fehlt. Bitte fordere einen neuen Link zur Passwortzuruecksetzung an.' : 'Hiányzó token! Kérj új jelszó-visszaállító linket.');
      setTokenExpired(true);
    }
  }, [token, market]);

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return { minLength, hasUpperCase, hasLowerCase, hasNumber };
  };

  const passwordValidation = validatePassword(newPassword);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isPasswordValid) {
      setError(market === 'de' ? 'Das Passwort erfuellt die Anforderungen nicht.' : 'A jelszó nem felel meg a követelményeknek!');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError(market === 'de' ? 'Die beiden Passwoerter stimmen nicht ueberein.' : 'A két jelszó nem egyezik!');
      return;
    }

    setSaving(true);

    try {
      // Set the new password
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || (market === 'de' ? 'Ein Fehler ist aufgetreten.' : 'Hiba történt'));
      }

      // Send confirmation email
      await fetch('/api/send-password-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: data.user.email, 
          displayName: data.user.displayName 
        })
      });

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err) {
      console.error('Password set error:', err);
      const errorMessage = err.message || (market === 'de' ? 'Beim Festlegen des Passworts ist ein Fehler aufgetreten.' : 'Hiba történt a jelszó beállítása során.');
      setError(errorMessage);
      // Check if token expired or invalid
      if (errorMessage.includes('lejárt') || errorMessage.includes('Érvénytelen') || errorMessage.toLowerCase().includes('abgelaufen') || errorMessage.toLowerCase().includes('ungueltig')) {
        setTokenExpired(true);
      }
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{market === 'de' ? 'Erfolgreich gespeichert!' : 'Sikeres beállítás!'}</h1>
          <p className="text-gray-600 mb-4">
            {market === 'de' ? 'Dein neues Passwort wurde erfolgreich gespeichert. Wir haben dir auch eine Bestaetigungs-E-Mail gesendet.' : 'Az új jelszavad sikeresen be lett állítva. Küldtünk egy megerősítő emailt is.'}
          </p>
          <p className="text-sm text-gray-500">{market === 'de' ? 'Weiterleitung zur Anmeldung...' : 'Átirányítás a bejelentkezéshez...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800 mb-2">Pharmagister</h1>
          <p className="text-gray-600">{market === 'de' ? 'Neues Passwort festlegen' : 'Új jelszó beállítása'}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
              {tokenExpired && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => router.push('/forgot-password')}
                    className="text-purple-600 hover:underline text-sm font-medium"
                  >
                    {market === 'de' ? 'Neues Passwort anfordern' : 'Új jelszó igénylése'} →
                  </button>
                </div>
              )}
            </div>
          )}

          {!token ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">{market === 'de' ? 'Ungueltiger Link. Bitte fordere eine neue E-Mail zur Passwortzuruecksetzung an.' : 'Érvénytelen link. Kérj új jelszó-visszaállító emailt!'}</p>
              <button
                onClick={() => router.push('/forgot-password')}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium"
              >
                {market === 'de' ? 'Neues Passwort anfordern' : 'Új jelszó igénylése'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Info */}
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg mb-4">
                <Lock className="w-5 h-5 text-purple-600" />
                <p className="text-sm text-purple-800">
                  {market === 'de' ? 'Lege ein neues, sicheres Passwort fuer dein Konto fest.' : 'Állíts be egy új, biztonságos jelszót a fiókodhoz.'}
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  {market === 'de' ? 'Neues Passwort' : 'Új jelszó'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Password Requirements */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.minLength ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                      {market === 'de' ? 'Mindestens 8 Zeichen' : 'Legalább 8 karakter'}
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.hasUpperCase ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                      {market === 'de' ? 'Mindestens ein Grossbuchstabe' : 'Legalább egy nagybetű'}
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.hasLowerCase ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                      {market === 'de' ? 'Mindestens ein Kleinbuchstabe' : 'Legalább egy kisbetű'}
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.hasNumber ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                      {market === 'de' ? 'Mindestens eine Zahl' : 'Legalább egy szám'}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  {market === 'de' ? 'Passwort bestaetigen' : 'Jelszó megerősítése'}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{market === 'de' ? 'Die beiden Passwoerter stimmen nicht ueberein.' : 'A két jelszó nem egyezik!'}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || !isPasswordValid || newPassword !== confirmPassword}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  saving || !isPasswordValid || newPassword !== confirmPassword
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {saving ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Passwort speichern' : 'Jelszó beállítása')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SetPasswordContent />
    </Suspense>
  );
}
