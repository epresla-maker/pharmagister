"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Home, Calendar, MessageCircle, Bell, Settings, User, Heart } from 'lucide-react';
import RouteGuard from '@/app/components/RouteGuard';
import { getClientMarket } from '@/lib/marketI18n';

export default function HelpPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();
  const [expandedSection, setExpandedSection] = useState('kezdooldal');

  const pharmaRole = userData?.pharmaRole;

  const sections = [
    {
      id: 'kezdooldal',
      title: market === 'de' ? 'Startseite (Feed)' : 'Kezdőoldal (Hírfolyam)',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            {market === 'de' ? <>Die Startseite ist dein <strong>Feed</strong>, wo du alle wichtigen Informationen findest:</> : <>A kezdőoldal a <strong>hírfolyam</strong>, ahol minden fontos információt megtalálsz:</>}
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>{market === 'de' ? 'Vertretungsanfragen:' : 'Helyettesítési igények:'}</strong> {market === 'de' ? 'Von Apotheken erstellte Anfragen erscheinen als Karten.' : 'A gyógyszertárak által feladott igények kártyaként jelennek meg.'}</li>
            <li><strong>{market === 'de' ? 'Admin-Posts:' : 'Admin posztok:'}</strong> {market === 'de' ? 'Wichtige Mitteilungen und News vom Betriebsteam.' : 'Fontos közlemények és hírek a rendszer üzemeltetőitől.'}</li>
            <li><strong>{market === 'de' ? 'Benutzer-Posts:' : 'Felhasználói posztok:'}</strong> {market === 'de' ? 'Beitraege anderer Nutzer.' : 'Más felhasználók bejegyzései.'}</li>
          </ul>
        </div>
      )
    },
    {
      id: 'pharmagister',
      title: market === 'de' ? 'Pharmagister (Kalender)' : 'Pharmagister (Naptár)',
      icon: Calendar,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            {market === 'de' ? 'Das Pharmagister-Modul ist das Zentrum des Vertretungssystems:' : 'A Pharmagister modul a helyettesítési rendszer központja:'}
          </p>
          
          {pharmaRole === 'pharmacy' ? (
            <div className="space-y-3">
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>{market === 'de' ? 'Fuer Apotheken:' : 'Gyógyszertáraknak:'}</h4>
              <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
                <li><strong>{market === 'de' ? 'Anfrage erstellen:' : 'Igény feladása:'}</strong> {market === 'de' ? 'Klicke im Kalender auf einen Tag, waehle die Position und fuelle die Daten aus.' : 'Kattints egy napra a naptárban, válaszd ki a pozíciót és töltsd ki az adatokat.'}</li>
                <li><strong>{market === 'de' ? 'Bewerber:' : 'Jelentkezők:'}</strong> {market === 'de' ? 'Du siehst eingehende Bewerbungen in den Anfragedetails.' : 'A beérkezett jelentkezéseket az igény részleteinél látod.'}</li>
                <li><strong>{market === 'de' ? 'Annehmen/Ablehnen:' : 'Elfogadás/Elutasítás:'}</strong> {market === 'de' ? 'Entscheide mit einem Klick ueber Bewerber.' : 'Dönts a jelentkezőkről egy kattintással.'}</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>{market === 'de' ? 'Fuer Vertretende:' : 'Helyettesítőknek:'}</h4>
              <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
                <li><strong>{market === 'de' ? 'Anfragen durchsehen:' : 'Igények böngészése:'}</strong> {market === 'de' ? 'Im Kalender siehst du ausgeschriebene Anfragen.' : 'A naptárban látod a meghirdetett igényeket.'}</li>
                <li><strong>{market === 'de' ? 'Bewerben:' : 'Jelentkezés:'}</strong> {market === 'de' ? 'Oeffne die Anfrage und tippe auf "Ich bewerbe mich".' : 'Kattints az igényre, majd a "Jelentkezem" gombra.'}</li>
                <li><strong>{market === 'de' ? 'Status:' : 'Státusz:'}</strong> {market === 'de' ? 'Verfolge den Status deiner Bewerbungen (offen, angenommen, abgelehnt).' : 'Kövesd a jelentkezéseid állapotát (függőben, elfogadva, elutasítva).'}</li>
              </ul>
            </div>
          )}
          
          <div className={`${darkMode ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              <strong>{market === 'de' ? 'Nach Annahme:' : 'Elfogadás után:'}</strong> {market === 'de' ? 'Beide Seiten erhalten die Kontaktdaten der anderen Partei.' : 'Mindkét fél megkapja a másik elérhetőségeit.'}
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'uzenetek',
      title: market === 'de' ? 'Nachrichten' : 'Üzenetek',
      icon: MessageCircle,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            {market === 'de' ? 'Private Nachrichten mit anderen Nutzern:' : 'Privát üzenetváltás más felhasználókkal:'}
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>{market === 'de' ? 'Konversation starten:' : 'Beszélgetés indítása:'}</strong> {market === 'de' ? 'Vom Benutzerprofil aus kannst du einen neuen Chat starten.' : 'Egy felhasználó profiljáról indíthatsz új beszélgetést.'}</li>
            <li><strong>{market === 'de' ? 'Nachricht senden:' : 'Üzenet küldése:'}</strong> {market === 'de' ? 'Schreibe deine Nachricht und tippe auf Senden.' : 'Írd be az üzeneted és nyomd meg a küldés gombot.'}</li>
            <li><strong>{market === 'de' ? 'Benachrichtigungen:' : 'Értesítések:'}</strong> {market === 'de' ? 'Du bekommst Push-Benachrichtigungen bei neuen Nachrichten.' : 'Push értesítést kapsz új üzenetről.'}</li>
          </ul>
          <div className={`${darkMode ? 'bg-blue-900/30 border-blue-600' : 'bg-blue-50 border-blue-500'} border-l-4 p-3 rounded-r-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              <strong>Badge:</strong> {market === 'de' ? 'Die Anzahl ungelesener Nachrichten wird im unteren Menue angezeigt.' : 'Az olvasatlan üzenetek száma megjelenik az alsó menüben.'}
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'ertesitesek',
      title: market === 'de' ? 'Benachrichtigungen' : 'Értesítések',
      icon: Bell,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            {market === 'de' ? 'Auf der Benachrichtigungsseite siehst du alle wichtigen Ereignisse:' : 'Az értesítések oldalon látod az összes fontos eseményt:'}
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>{market === 'de' ? 'Neue Bewerbung:' : 'Új jelentkezés:'}</strong> {market === 'de' ? 'Jemand hat sich auf deine Anfrage beworben.' : 'Valaki jelentkezett az igényedre.'}</li>
            <li><strong>{market === 'de' ? 'Annahme:' : 'Elfogadás:'}</strong> {market === 'de' ? 'Deine Bewerbung wurde angenommen.' : 'A jelentkezésedet elfogadták.'}</li>
            <li><strong>{market === 'de' ? 'Neue Nachricht:' : 'Új üzenet:'}</strong> {market === 'de' ? 'Du hast eine private Nachricht erhalten.' : 'Privát üzenetet kaptál.'}</li>
            <li><strong>{market === 'de' ? 'System-Benachrichtigungen:' : 'Rendszer értesítések:'}</strong> {market === 'de' ? 'Wichtige Informationen.' : 'Fontos információk.'}</li>
          </ul>

        </div>
      )
    },
    {
      id: 'profil',
      title: market === 'de' ? 'Profil und Einstellungen' : 'Profil és Beállítások',
      icon: User,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            {market === 'de' ? 'Verwaltung deines Profils und deiner Einstellungen:' : 'A profilod és beállításaid kezelése:'}
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'} ml-2`}>
            <li><strong>{market === 'de' ? 'Profilbild:' : 'Profilkép:'}</strong> {market === 'de' ? 'Lade ein Foto hoch, damit man dich leichter erkennt.' : 'Tölts fel egy fotót, hogy mások felismerjenek.'}</li>
            <li><strong>{market === 'de' ? 'Daten:' : 'Adatok:'}</strong> {market === 'de' ? 'Halte deine beruflichen Daten aktuell.' : 'Tartsd naprakészen a szakmai adataidat.'}</li>
            <li><strong>{market === 'de' ? 'Vorstellung:' : 'Bemutatkozás:'}</strong> {market === 'de' ? 'Schreibe ein paar Zeilen ueber dich.' : 'Írj pár sort magadról.'}</li>
          </ul>
        </div>
      )
    },
    {
      id: 'navigacio',
      title: market === 'de' ? 'Navigation' : 'Navigáció',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            {market === 'de' ? 'In der unteren Navigationsleiste findest du 5 Hauptpunkte:' : 'Az alsó navigációs sávon 5 fő menüpont található:'}
          </p>
          <div className="grid grid-cols-5 gap-2 mt-3">
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Home className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Start' : 'Főoldal'}</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <MessageCircle className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Nachrichten' : 'Üzenetek'}</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Bell className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Hinweise' : 'Értesítések'}</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Calendar className={`w-5 h-5 mx-auto text-purple-500`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>Pharmagister</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Settings className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Einstellungen' : 'Beállítások'}</p>
            </div>
          </div>

        </div>
      )
    },
    {
      id: 'tippek',
      title: market === 'de' ? 'Nutzliche Tipps' : 'Hasznos tippek',
      icon: Heart,
      content: (
        <div className="space-y-4">
          <ul className={`list-disc list-inside space-y-3 text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
            <li><strong>{market === 'de' ? 'Push-Benachrichtigungen:' : 'Push értesítések:'}</strong> {market === 'de' ? 'Aktiviere sie, damit du nichts verpasst.' : 'Engedélyezd, hogy ne maradj le semmiről.'}</li>
            <li><strong>{market === 'de' ? 'Profil ausfuellen:' : 'Profil kitöltése:'}</strong> {market === 'de' ? 'Je detaillierter dein Profil ist, desto eher wirst du ausgewaehlt.' : 'Minél részletesebb a profilod, annál nagyobb eséllyel választanak.'}</li>
            <li><strong>{market === 'de' ? 'Schnelle Antwort:' : 'Gyors válasz:'}</strong> {market === 'de' ? 'Schnelle Reaktion erhoeht die Annahmechance.' : 'A gyors reakció növeli az elfogadás esélyét.'}</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <RouteGuard>
      <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10 pt-safe-small`}>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
            >
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
            </button>
            <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Hilfe' : 'Súgó'}</h1>
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
                <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Wie funktioniert die Seite?' : 'Hogyan működik az oldal?'}</h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Detaillierte Anleitung' : 'Részletes útmutató'}</p>
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
        </div>
      </div>
    </RouteGuard>
  );
}
