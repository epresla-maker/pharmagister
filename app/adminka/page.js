"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Key, BarChart3, TestTube, Smartphone, ClipboardList, FileText, Users, Building2, Mail, ListChecks, Flag, MessageSquare } from "lucide-react";
import { getClientMarket } from '@/lib/marketI18n';

// Adminka szerepkörű felhasználók
const ADMINKA_EMAILS = ['etinatina22@gmail.com', 'epresla@icloud.com'];

export default function AdminkaPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const normalizedEmail = String(user?.email || userData?.email || '').trim().toLowerCase();
  const isAuthorized = ADMINKA_EMAILS.some((email) => email.toLowerCase() === normalizedEmail);

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push('/');
    }
  }, [user, loading, isAuthorized, router]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
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
              <h1 className="text-2xl font-bold text-gray-900">{market === 'de' ? 'Adminka-Bereich' : 'Adminka Panel'}</h1>
              <p className="text-sm text-gray-500">{market === 'de' ? 'Willkommen, ' : 'Üdvözöllek, '}{userData?.displayName || user.email}</p>
            </div>
          </div>
        </div>

        {/* Menu Cards */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/admin/approvals')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <ClipboardList className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '📋 NNK-Freigaben' : '📋 NNK Jóváhagyások'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'NNK-Freigabeanfragen ansehen (nur Lesen)' : 'NNK jóváhagyási kérelmek megtekintése (csak olvasás)'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/posts')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '📝 Beitraege verwalten' : '📝 Posztok kezelése'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Beitraege ansehen (nur Lesen)' : 'Posztok megtekintése (csak olvasás)'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/adminka/password-activations')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Key className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '🔐 Passwortaktivierungen' : '🔐 Jelszó aktiválások'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Status der Passwortaktivierung von Benutzern anzeigen' : 'Felhasználók jelszó aktiválási státuszának megtekintése'}</p>
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
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '📊 Statistiken' : '📊 Statisztikák'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Nutzeraktivitaet und Registrierungsstatistiken' : 'Felhasználói aktivitás és regisztrációs statisztikák'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/rss-test')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <TestTube className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">🧪 RSS Feed Teszt</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Testumgebung fuer die RSS-News-Integration' : 'Tesztelési környezet az RSS hírek integrációjához'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/adminka/apps')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-100 rounded-xl">
                <Smartphone className="w-8 h-8 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '📱 Mobile Apps' : '📱 Mobil alkalmazások'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Herunterladbare iOS- und Android-Versionen' : 'Letölthető iOS és Android verziók'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/users')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-pink-100 rounded-xl">
                <Users className="w-8 h-8 text-pink-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '👥 Benutzer verwalten' : '👥 Felhasználók kezelése'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Registrierte Benutzer ansehen (nur Lesen)' : 'Regisztrált felhasználók megtekintése (csak olvasás)'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/pharmacies')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Building2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '🏥 Apotheken verwalten' : '🏥 Gyógyszertárak kezelése'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Apotheken ansehen (nur Lesen)' : 'Gyógyszertárak megtekintése (csak olvasás)'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/email')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <Mail className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '✉️ E-Mail senden' : '✉️ Email küldés'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'E-Mail-Versand ansehen (nur Lesen)' : 'Email küldés megtekintése (csak olvasás)'}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/demands')}
            className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-100 rounded-xl">
                <ListChecks className="w-8 h-8 text-violet-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '📋 Anfragen verwalten' : '📋 Igények kezelése'}</h2>
                <p className="text-sm text-gray-500">{market === 'de' ? 'Anfragen ansehen (nur Lesen)' : 'Igények megtekintése (csak olvasás)'}</p>
              </div>
            </div>
          </button>

          {normalizedEmail === 'epresla@icloud.com' ? (
            <button
              onClick={() => router.push('/admin/demand-credits')}
              className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-fuchsia-100 rounded-xl">
                  <ListChecks className="w-8 h-8 text-fuchsia-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '💳 Kredit-Kaeufe' : '💳 Kreditvasarlasok'}</h2>
                  <p className="text-sm text-gray-500">{market === 'de' ? 'Vollstaendige Kreditverwaltung und Kaufhistorie' : 'Teljes kreditkezeles es vasarlasi elozmenyek'}</p>
                </div>
              </div>
            </button>
          ) : null}

          {normalizedEmail === 'epresla@icloud.com' ? (
            <button
              onClick={() => router.push('/admin/chats')}
              className="w-full bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sky-100 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{market === 'de' ? '💬 Chats' : '💬 Chatek'}</h2>
                  <p className="text-sm text-gray-500">{market === 'de' ? 'Alle Gespraeche einsehen' : 'Összes beszélgetés megtekintése'}</p>
                </div>
              </div>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
