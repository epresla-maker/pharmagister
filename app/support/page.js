"use client";
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, Mail, Globe, Shield, Trash2, HelpCircle, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function SupportPage() {
  const { darkMode } = useTheme();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 pt-safe-small ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </Link>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-600" />
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Támogatás / Support
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6">

        {/* Welcome */}
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6`}>
          <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Üdvözöljük a Pharmagister támogatási oldalán!
          </h2>
          <p className="leading-relaxed">
            A Pharmagister egy gyógyszertári helyettesítés-közvetítő platform, amely összeköti a gyógyszertárakat
            és a helyettesítő gyógyszerészeket/szakasszisztenseket Magyarországon.
            Ha bármilyen kérdése, problémája vagy javaslata van, az alábbi elérhetőségeken állunk rendelkezésére.
          </p>
        </div>

        {/* Contact */}
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6`}>
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Kapcsolat
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>E-mail</p>
                <a href="mailto:epresla@icloud.com" className="text-purple-600 hover:underline">
                  epresla@icloud.com
                </a>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Válaszidő: általában 24 órán belül
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Weboldal</p>
                <a href="https://pharmagister.hu" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                  https://pharmagister.hu
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6`}>
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Gyakran ismételt kérdések
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Hogyan regisztrálhatok?
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                A regisztráció ingyenes. Nyissa meg az alkalmazást, kattintson a "Regisztráció" gombra,
                adja meg az e-mail címét és válasszon jelszót. A regisztráció után e-mailben kapott linkkel
                erősítse meg a fiókját.
              </p>
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Hogyan adhatok fel helyettesítési igényt?
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Gyógyszertárként jelentkezzen be, lépjen a naptár nézetre, kattintson egy jövőbeli napra,
                és töltse ki az igény adatait (pozíció, munkaidő, követelmények).
              </p>
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Hogyan jelentkezhetek egy igényre?
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Helyettesítőként böngésszen a naptárban vagy a vezérlőpulton, válassza ki a megfelelő
                igényt, és kattintson a "Jelentkezem" gombra. A gyógyszertár értesítést kap a jelentkezéséről.
              </p>
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Elfelejtett jelszó
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                A bejelentkezési oldalon kattintson az "Elfelejtett jelszó" linkre, adja meg regisztrált
                e-mail címét, és a rendszer elküldi a jelszó-visszaállítási hivatkozást.
              </p>
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Hogyan törölhetem a fiókomat?
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Lépjen a Beállítások menübe, majd kattintson a "Fiók törlése" gombra.
                A törlés azonnali és végleges -- minden adata (profil, igények, jelentkezések, üzenetek)
                visszavonhatatlanul törlődik. Alternatív megoldásként a{' '}
                <Link href="/delete-account" className="text-purple-600 hover:underline">
                  fiók törlési űrlapon
                </Link>{' '}
                is kérheti a törlést.
              </p>
            </div>
          </div>
        </div>

        {/* Useful links */}
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6`}>
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Hasznos hivatkozások
          </h2>
          <div className="space-y-3">
            <Link href="/help" className="flex items-center gap-3 group">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-teal-900/30' : 'bg-teal-100'}`}>
                <HelpCircle className="w-5 h-5 text-teal-600" />
              </div>
              <span className="text-purple-600 group-hover:underline">Súgó - részletes használati útmutató</span>
            </Link>
            <Link href="/privacy-policy" className="flex items-center gap-3 group">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-purple-600 group-hover:underline">Adatvédelmi tájékoztató</span>
            </Link>
            <Link href="/delete-account" className="flex items-center gap-3 group">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-purple-600 group-hover:underline">Fiók törlése</span>
            </Link>
          </div>
        </div>

        {/* Developer info */}
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6`}>
          <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Fejlesztő
          </h2>
          <p className="leading-relaxed">
            <strong>Név:</strong> Epres László<br />
            <strong>E-mail:</strong> epresla@icloud.com<br />
            <strong>Alkalmazás:</strong> Pharmagister v1.0.0
          </p>
        </div>

      </div>
    </div>
  );
}
