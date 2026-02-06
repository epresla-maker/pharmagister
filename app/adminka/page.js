"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Key, BarChart3 } from "lucide-react";

// Adminka szerepkörű felhasználók
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function AdminkaPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || !ADMINKA_EMAILS.includes(user.email)) {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  if (loading || !user || !ADMINKA_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Adminka Panel</h1>
              <p className="text-sm text-gray-500">Üdvözöllek, {userData?.displayName || user.email}</p>
            </div>
          </div>
        </div>

        {/* Menu Cards */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/adminka/password-activations')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Key className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">🔐 Jelszó aktiválások</h2>
                <p className="text-sm text-gray-500">Felhasználók jelszó aktiválási státuszának megtekintése</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/stats')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">📊 Statisztikák</h2>
                <p className="text-sm text-gray-500">Felhasználói aktivitás és regisztrációs statisztikák</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
