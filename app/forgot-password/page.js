"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Hiba történt');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Hiba történt. Kérlek próbáld újra.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email elküldve!</h1>
          <p className="text-gray-600 mb-6">
            Ha az email cím létezik a rendszerben, küldtünk egy jelszó-visszaállító linket. 
            Kérlek ellenőrizd a postaládádat (és a spam mappát is).
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium"
          >
            Vissza a bejelentkezéshez
          </button>
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
          <p className="text-gray-600">Elfelejtett jelszó</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Back button */}
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-2 text-gray-600 hover:text-purple-600 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Vissza a bejelentkezéshez</span>
          </button>

          {/* Info */}
          <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg mb-6">
            <Mail className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-purple-800">
              Add meg az email címedet és küldünk egy linket, amivel új jelszót állíthatsz be.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Email cím
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="pelda@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                loading || !email
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Küldés...
                </>
              ) : (
                'Jelszó-visszaállító link küldése'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
