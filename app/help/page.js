"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Home, Calendar, MessageCircle, Bell, Settings, User, Search, Heart, Send } from 'lucide-react';
import RouteGuard from '@/app/components/RouteGuard';

export default function HelpPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { darkMode } = useTheme();
  const [expandedSection, setExpandedSection] = useState('kezdooldal');

  const pharmaRole = userData?.pharmaRole;

  const sections = [
    {
      id: 'kezdooldal',
      title: '🏠 Kezdőoldal (Hírfolyam)',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            A kezdőoldal a <strong>hírfolyam</strong>, ahol minden fontos információt megtalálsz:
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>Helyettesítési igények:</strong> A gyógyszertárak által feladott igények kártyaként jelennek meg.</li>
            <li><strong>Admin posztok:</strong> Fontos közlemények és hírek a rendszer üzemeltetőitől.</li>
            <li><strong>Felhasználói posztok:</strong> Más felhasználók bejegyzései.</li>
          </ul>
          <div className={`${darkMode ? 'bg-cyan-900/30 border-cyan-600' : 'bg-cyan-50 border-cyan-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              💡 <strong>Tipp:</strong> Húzd le az oldalt a frissítéshez (pull-to-refresh).
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'hozzaszolas',
      title: '💬 Hozzászólások',
      icon: MessageCircle,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            Bármelyik poszthoz hozzászólhatsz:
          </p>
          <ol className={`list-decimal list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li>Kattints a <strong>"Hozzászólás"</strong> gombra a poszt alatt.</li>
            <li>Megnyílik a poszt részletes nézete.</li>
            <li>Az oldal alján található a beviteli mező.</li>
            <li>Írd be a hozzászólásod és nyomd meg a küldés gombot.</li>
          </ol>
          <div className={`${darkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-purple-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              💬 <strong>Válasz:</strong> Egy hozzászólásra válaszolni a "Válasz" gombbal tudsz.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'pharmagister',
      title: '📅 Pharmagister (Naptár)',
      icon: Calendar,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            A Pharmagister modul a helyettesítési rendszer központja:
          </p>
          
          {pharmaRole === 'pharmacy' ? (
            <div className="space-y-3">
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>Gyógyszertáraknak:</h4>
              <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
                <li><strong>Igény feladása:</strong> Kattints egy napra a naptárban, válaszd ki a pozíciót és töltsd ki az adatokat.</li>
                <li><strong>Jelentkezők:</strong> A beérkezett jelentkezéseket az igény részleteinél látod.</li>
                <li><strong>Elfogadás/Elutasítás:</strong> Dönts a jelentkezőkről egy kattintással.</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>Helyettesítőknek:</h4>
              <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
                <li><strong>Igények böngészése:</strong> A naptárban látod a meghirdetett igényeket.</li>
                <li><strong>Jelentkezés:</strong> Kattints az igényre, majd a "Jelentkezem" gombra.</li>
                <li><strong>Státusz:</strong> Kövesd a jelentkezéseid állapotát (függőben, elfogadva, elutasítva).</li>
              </ul>
            </div>
          )}
          
          <div className={`${darkMode ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              ✅ <strong>Elfogadás után:</strong> Mindkét fél megkapja a másik elérhetőségeit.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'uzenetek',
      title: '✉️ Üzenetek',
      icon: MessageCircle,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            Privát üzenetváltás más felhasználókkal:
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>Beszélgetés indítása:</strong> Egy felhasználó profiljáról indíthatsz új beszélgetést.</li>
            <li><strong>Üzenet küldése:</strong> Írd be az üzeneted és nyomd meg a küldés gombot.</li>
            <li><strong>Értesítések:</strong> Push értesítést kapsz új üzenetről.</li>
          </ul>
          <div className={`${darkMode ? 'bg-blue-900/30 border-blue-600' : 'bg-blue-50 border-blue-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              🔔 <strong>Badge:</strong> Az olvasatlan üzenetek száma megjelenik az alsó menüben.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'ertesitesek',
      title: '🔔 Értesítések',
      icon: Bell,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            Az értesítések oldalon látod az összes fontos eseményt:
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>Új jelentkezés:</strong> Valaki jelentkezett az igényedre.</li>
            <li><strong>Elfogadás:</strong> A jelentkezésedet elfogadták.</li>
            <li><strong>Új üzenet:</strong> Privát üzenetet kaptál.</li>
            <li><strong>Rendszer értesítések:</strong> Fontos információk.</li>
          </ul>
          <div className={`${darkMode ? 'bg-yellow-900/30 border-yellow-600' : 'bg-yellow-50 border-yellow-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              📱 <strong>Push értesítések:</strong> Engedélyezd a böngészőben a valós idejű értesítésekhez!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'profil',
      title: '👤 Profil és Beállítások',
      icon: User,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            A profilod és beállításaid kezelése:
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>Profilkép:</strong> Tölts fel egy fotót, hogy mások felismerjenek.</li>
            <li><strong>Adatok:</strong> Tartsd naprakészen a szakmai adataidat.</li>
            <li><strong>Bemutatkozás:</strong> Írj pár sort magadról.</li>
            <li><strong>Sötét mód:</strong> Váltás világos/sötét téma között.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'navigacio',
      title: '🧭 Navigáció',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            Az alsó navigációs sávon 5 fő menüpont található:
          </p>
          <div className="grid grid-cols-5 gap-2 mt-3">
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Home className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Főoldal</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <MessageCircle className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Üzenetek</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Bell className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Értesítések</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Calendar className={`w-5 h-5 mx-auto text-purple-500`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>Pharmagister</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Settings className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Beállítások</p>
            </div>
          </div>
          <div className={`${darkMode ? 'bg-cyan-900/30 border-cyan-600' : 'bg-cyan-50 border-cyan-500'} border-l-4 p-3 rounded-r-lg mt-3`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              💡 <strong>Tipp:</strong> Görgetéskor az alsó menü eltűnik, felfelé görgetéskor visszatér.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'tippek',
      title: '💡 Hasznos tippek',
      icon: Heart,
      content: (
        <div className="space-y-4">
          <ul className={`list-disc list-inside space-y-3 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            <li><strong>PWA telepítés:</strong> Add hozzá az alkalmazást a kezdőképernyődhöz a jobb élményért.</li>
            <li><strong>Push értesítések:</strong> Engedélyezd, hogy ne maradj le semmiről.</li>
            <li><strong>Profil kitöltése:</strong> Minél részletesebb a profilod, annál nagyobb eséllyel választanak.</li>
            <li><strong>Gyors válasz:</strong> A gyors reakció növeli az elfogadás esélyét.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <RouteGuard>
      <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
            >
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
            </button>
            <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Súgó</h1>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Header Info */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Hogyan működik az oldal?</h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Részletes útmutató</p>
              </div>
            </div>
          </div>

          {/* Accordion Sections */}
          {sections.map((section) => (
            <div 
              key={section.id}
              className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}
            >
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className={`w-full flex items-center justify-between px-4 py-3 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
              >
                <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{section.title}</span>
                {expandedSection === section.id ? (
                  <ChevronUp className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                ) : (
                  <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                )}
              </button>
              
              {expandedSection === section.id && (
                <div className={`px-4 pb-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'} border-t pt-3`}>
                  {section.content}
                </div>
              )}
            </div>
          ))}

          {/* Contact */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 shadow-sm mt-6`}>
            <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Kapcsolat</h3>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Ha további kérdésed van, vedd fel velünk a kapcsolatot az{' '}
              <a href="mailto:support@pharmagister.hu" className="text-[#6B46C1] underline">
                support@pharmagister.hu
              </a>{' '}
              címen.
            </p>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
