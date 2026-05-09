"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Ellenőrizzük, hogy az email megerősítve van-e
      if (!userCredential.user.emailVerified) {
        setError('Kérjük, először erősítsd meg az email címedet! Nézd meg a postaládádat.');
        await signOut(auth); // Kijelentkeztetjük
        setLoading(false);
        return;
      }

      router.push('/pharmagister');
    } catch (err) {
      setError('Hibás email vagy jelszó');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-emerald-50">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/auth-background.png')" }}
      />
      <div className="absolute inset-0 bg-white/10" />
      <div className="relative min-h-[100dvh] overflow-y-auto px-4 py-8">
        <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center">
          <div className="w-full max-w-md rounded-lg border border-white/70 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 backdrop-blur-md sm:p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-emerald-950">Bejelentkezés</h1>
        <p className="text-emerald-800 text-center mb-6">Pharmagister</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Jelszó</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-gray-900 text-xl"
              >
                <span className={showPassword ? '' : 'opacity-40'}>👁️</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-700 text-white py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? 'Betöltés...' : 'Belépés'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-emerald-700 hover:underline"
            >
              Elfelejtett jelszó?
            </button>
          </div>
        </form>

        <p className="text-center mt-4 text-sm">
          Nincs még fiókod?{' '}
          <button
            onClick={() => router.push('/register')}
            className="text-emerald-700 hover:underline"
          >
            Regisztrálj
          </button>
        </p>
          </div>
        </div>
      </div>
    </div>
  );
}
