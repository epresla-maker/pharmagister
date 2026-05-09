"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function HomeCareLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        setError('Kérjük, először erősítsd meg az email címedet.');
        await signOut(auth);
        setLoading(false);
        return;
      }

      router.push('/otthonapolas');
    } catch (err) {
      setError('Hibás email vagy jelszó.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#dcfce7,transparent_35%),radial-gradient(circle_at_90%_20%,#ccfbf1,transparent_30%),#f8fafc]">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-teal-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 text-center">Otthonápolás belépés</h1>
          <p className="text-center text-sm text-slate-600 mt-2">Külön modul a pharmagister.hu alatt</p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jelszó</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? 'Belépés...' : 'Belépés otthonápolásba'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button onClick={() => router.push('/login')} className="text-teal-700 hover:underline">
              Vissza a Pharmagister belépéshez
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
