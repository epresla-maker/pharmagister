"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Smartphone, Download, Bot } from "lucide-react";
import Link from "next/link";

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

// Ezeket a linkeket cseréld ki a tényleges Cloudinary/tárolt fájl URL-ekre
const APP_DOWNLOADS = {
  android: {
    name: "Pharmagister Android",
    version: "1.0", 
    size: "~4 MB",
    url: null, // Régi verzió törölve - új ikonos verzió készül
    notes: "APK fájl. Telepítéshez engedélyezd az 'Ismeretlen források' opciót az Android beállításokban.",
    icon: Bot
  }
};

export default function AdminAppsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      const isAdmin = user && ADMIN_EMAILS.includes(user.email);
      const isAdminka = user && ADMINKA_EMAILS.includes(user.email);
      if (!isAdmin && !isAdminka) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const isAdminka = user && ADMINKA_EMAILS.includes(user.email);
  if (!isAdmin && !isAdminka) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white p-4 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link 
            href={isAdmin ? "/admin" : "/adminka"}
            className="p-2 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow"
          >
            <ArrowLeft className="w-6 h-6 text-purple-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📱 Mobil alkalmazások</h1>
            <p className="text-gray-500 text-sm">Letölthető iOS és Android verziók</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Smartphone className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-purple-800">Natív alkalmazások</h3>
              <p className="text-sm text-purple-700">
                Ezek a natív Pharmagister alkalmazások közvetlenül telepíthetők az eszközökre.
                A webes PWA verzió továbbra is elérhető a pharmagister.hu oldalon.
              </p>
            </div>
          </div>
        </div>

        {/* Download Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(APP_DOWNLOADS).map(([key, app]) => {
            const Icon = app.icon;
            return (
              <div
                key={key}
                className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{app.name}</h2>
                    <p className="text-gray-500 text-sm">
                      Verzió: {app.version} • {app.size}
                    </p>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">
                  {app.notes}
                </p>

                {app.url ? (
                  <a
                    href={app.url}
                    download
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
                  >
                    <Download className="w-5 h-5" />
                    Letöltés
                  </a>
                ) : (
                  <div className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-500 text-center font-medium">
                    Még nincs feltöltve
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upload Instructions for Admin */}
        {isAdmin && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">📤 Fájlok feltöltése (Admin)</h3>
            <p className="text-sm text-yellow-700 mb-3">
              A mobil alkalmazások feltöltéséhez:
            </p>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Töltsd fel a fájlokat Cloudinary-ra vagy más tárhelyre</li>
              <li>Másold be a publikus URL-eket a kódba</li>
              <li>Frissítsd ezt az oldalt</li>
            </ol>
            <div className="mt-4 p-3 bg-white rounded-lg font-mono text-xs text-gray-600 overflow-x-auto">
              <p>Android APK: ~/pharmagister/android/app/build/outputs/apk/debug/app-debug.apk</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
