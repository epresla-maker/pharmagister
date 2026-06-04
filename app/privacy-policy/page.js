"use client";
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import { getClientMarket } from '@/lib/marketI18n';

export default function PrivacyPolicyPage() {
  const { darkMode } = useTheme();
  const market = getClientMarket();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 pt-safe-small ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? 'Datenschutzhinweis' : 'Adatvédelmi Tájékoztató'}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6 space-y-6`}>
          
          <div className="text-sm text-gray-500 mb-4">
            {market === 'de' ? 'Gueltig ab: 11. Februar 2026' : 'Hatályos: 2026. február 11.'} |{' '}
            <Link href="/privacy-policy/en" className="text-purple-600 hover:underline">{market === 'de' ? 'Englische Version' : 'English version'}</Link>
          </div>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '1. Einleitung' : '1. Bevezetés'}
            </h2>
            <p className="leading-relaxed">
              {market === 'de'
                ? 'Der Betreiber der Pharmagister-App ("App", "Dienst") verpflichtet sich zum Schutz personenbezogener Daten der Nutzer. Dieser Datenschutzhinweis beschreibt, welche Daten wir erfassen, wie wir sie verwenden und welche Rechte Sie in Bezug auf Ihre Daten haben.'
                : 'A Pharmagister alkalmazás („Alkalmazás", „Szolgáltatás") üzemeltetője elkötelezett a felhasználók személyes adatainak védelme iránt. Ez az Adatvédelmi Tájékoztató ismerteti, hogy milyen adatokat gyűjtünk, hogyan használjuk fel azokat, és milyen jogok illetik meg Önt az adataival kapcsolatban.'}
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '2. Verantwortlicher' : '2. Adatkezelő'}
            </h2>
            <p className="leading-relaxed">
              <strong>{market === 'de' ? 'Entwickler:' : 'Fejlesztő neve:'}</strong> Epres László<br />
              <strong>{market === 'de' ? 'Name der App:' : 'Alkalmazás neve:'}</strong> Pharmagister<br />
              <strong>E-mail:</strong> epresla@icloud.com<br />
              <strong>{market === 'de' ? 'Webseite:' : 'Weboldal:'}</strong> https://pharmagister.hu
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '3. Erhobene Daten' : '3. Gyűjtött adatok'}
            </h2>
            <p className="leading-relaxed mb-3">
              {market === 'de' ? 'Bei der Nutzung der App erfassen und verarbeiten wir folgende personenbezogene Daten:' : 'Az Alkalmazás használata során az alábbi személyes adatokat gyűjtjük és kezeljük:'}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{market === 'de' ? 'Registrierungsdaten:' : 'Regisztrációs adatok:'}</strong> {market === 'de' ? 'Name, E-Mail-Adresse, Passwort (verschluesselt)' : 'név, e-mail cím, jelszó (titkosítva)'}</li>
              <li><strong>{market === 'de' ? 'Profildaten:' : 'Profil adatok:'}</strong> {market === 'de' ? 'Telefonnummer, Profilbild, Kurzvorstellung, Berufserfahrung' : 'telefonszám, profilkép, bemutatkozás, szakmai tapasztalat'}</li>
              <li><strong>{market === 'de' ? 'Vertretungsanfragen:' : 'Helyettesítési igények:'}</strong> {market === 'de' ? 'Daten, Ort (PLZ), Positionsart' : 'dátumok, helyszín (irányítószám), pozíció típusa'}</li>
              <li><strong>{market === 'de' ? 'Kommunikationsdaten:' : 'Kommunikációs adatok:'}</strong> {market === 'de' ? 'Nachrichten, Benachrichtigungen' : 'üzenetek, értesítések'}</li>
              <li><strong>{market === 'de' ? 'Technische Daten:' : 'Technikai adatok:'}</strong> {market === 'de' ? 'Geraetetyp, Push-Token' : 'eszköz típusa, push notification token'}</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '4. Zwecke der Datenverarbeitung' : '4. Az adatkezelés célja'}
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{market === 'de' ? 'Erstellung und Verwaltung von Nutzerkonten' : 'Felhasználói fiók létrehozása és kezelése'}</li>
              <li>{market === 'de' ? 'Vermittlung von Vertretungsanfragen und Bewerbungen' : 'Helyettesítési igények és jelentkezések közvetítése'}</li>
              <li>{market === 'de' ? 'Kommunikation zwischen Nutzern ermoeglichen' : 'Felhasználók közötti kommunikáció biztosítása'}</li>
              <li>{market === 'de' ? 'Versand von Push-Benachrichtigungen (neue Anfragen, Nachrichten)' : 'Push értesítések küldése (új igények, üzenetek)'}</li>
              <li>{market === 'de' ? 'Weiterentwicklung des Dienstes und Fehlerbehebungen' : 'Szolgáltatás fejlesztése és hibák javítása'}</li>
              <li><strong>{market === 'de' ? 'Messung der Antwortquote:' : 'Válaszadási arány mérése:'}</strong> {market === 'de' ? 'Wir zeigen bei Vertretungsanfragen die 72-Stunden-Antwortquote von Apotheken prozentual an, um die Servicequalitaet zu verbessern. Dieser Wert wird automatisch aus den Antworten auf Bewerbungen berechnet.' : 'a gyógyszertárak 72 órán belüli válaszadási arányát százalékosan megjelenítjük a helyettesítési igényeknél, a szolgáltatás minőségének javítása érdekében. Ez az adat a jelentkezésekre adott válaszok alapján automatikusan kerül kiszámításra.'}</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '5. Rechtsgrundlagen' : '5. Az adatkezelés jogalapja'}
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{market === 'de' ? 'Vertragserfuellung:' : 'Szerződés teljesítése:'}</strong> {market === 'de' ? 'Daten, die zur Erbringung des Dienstes erforderlich sind (DSGVO Art. 6 Abs. 1 lit. b)' : 'a szolgáltatás nyújtásához szükséges adatok (GDPR 6. cikk (1) b)'}</li>
              <li><strong>{market === 'de' ? 'Einwilligung:' : 'Hozzájárulás:'}</strong> {market === 'de' ? 'Push-Benachrichtigungen, optionale Profildaten (DSGVO Art. 6 Abs. 1 lit. a)' : 'push értesítések, opcionális profil adatok (GDPR 6. cikk (1) a)'}</li>
              <li><strong>{market === 'de' ? 'Berechtigtes Interesse:' : 'Jogos érdek:'}</strong> {market === 'de' ? 'Sicherheit des Dienstes, Missbrauchspraevention (DSGVO Art. 6 Abs. 1 lit. f)' : 'szolgáltatás biztonsága, visszaélések megelőzése (GDPR 6. cikk (1) f)'}</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '6. Datenweitergabe' : '6. Adatok megosztása'}
            </h2>
            <p className="leading-relaxed mb-3">
              {market === 'de' ? 'Wir geben personenbezogene Daten nur in folgenden Faellen an Dritte weiter:' : 'Személyes adatait harmadik féllel csak az alábbi esetekben osztjuk meg:'}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{market === 'de' ? 'Andere Nutzer:' : 'Más felhasználókkal:'}</strong> {market === 'de' ? 'Bei Bewerbungen kann die Apotheke die von Ihnen freigegebenen Daten sehen (konfigurierbar).' : 'jelentkezéskor a gyógyszertár láthatja az Ön által megosztott adatokat (beállítható)'}</li>
              <li><strong>{market === 'de' ? 'Dienstleister:' : 'Szolgáltatók:'}</strong>
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li>{market === 'de' ? 'Firebase (Google) - Datenspeicherung, Authentifizierung, Push-Benachrichtigungen' : 'Firebase (Google) - adattárolás, autentikáció, push értesítések'}</li>
                  <li>{market === 'de' ? 'Cloudinary - Speicherung und Verarbeitung von Bildern und Mediendateien' : 'Cloudinary - képek és médiafájlok tárolása, feldolgozása'}</li>
                </ul>
              </li>
              <li><strong>{market === 'de' ? 'Rechtliche Verpflichtung:' : 'Jogi kötelezettség:'}</strong> {market === 'de' ? 'bei behoerdlichen Anfragen' : 'hatósági megkeresés esetén'}</li>
            </ul>
            <p className="leading-relaxed mt-3">
              <strong>{market === 'de' ? 'Wir verkaufen Ihre personenbezogenen Daten nicht und geben sie nicht zu Werbezwecken weiter.' : 'Nem értékesítjük és nem adjuk ki személyes adatait hirdetési célokra.'}</strong>
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '7. Datenspeicherung und Sicherheit' : '7. Adatok tárolása és biztonsága'}
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{market === 'de' ? 'Die Daten werden auf EU-Servern von Google Firebase gespeichert' : 'Az adatokat a Google Firebase EU-s szerverein tároljuk'}</li>
              <li>{market === 'de' ? 'Passwoerter werden verschluesselt (Hash) gespeichert' : 'A jelszavak titkosítva (hash) kerülnek tárolásra'}</li>
              <li>{market === 'de' ? 'Wir verwenden HTTPS-verschluesselte Verbindungen' : 'HTTPS titkosított kapcsolatot használunk'}</li>
              <li>{market === 'de' ? 'Nur befugte Personen haben Zugriff auf die Daten' : 'Az adatokhoz csak az arra jogosultak férhetnek hozzá'}</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '8. Speicherdauer' : '8. Adatmegőrzési idő'}
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{market === 'de' ? 'Kontodaten: bis zur Loeschung des Kontos' : 'Felhasználói fiók adatai: a fiók törléséig'}</li>
              <li>{market === 'de' ? 'Vertretungsanfragen: 1 Jahr nach Ablauf' : 'Helyettesítési igények: az igény lejárta után 1 év'}</li>
              <li>{market === 'de' ? 'Nachrichten: 2 Jahre' : 'Üzenetek: 2 év'}</li>
              <li>{market === 'de' ? 'Bei Konto-Loeschung werden alle Daten innerhalb von 30 Tagen geloescht' : 'Fiók törlése esetén az összes adat 30 napon belül törlésre kerül'}</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '9. Ihre Rechte' : '9. Az Ön jogai'}
            </h2>
            <p className="leading-relaxed mb-3">
              {market === 'de' ? 'Nach der DSGVO haben Sie folgende Rechte:' : 'A GDPR alapján Önt az alábbi jogok illetik meg:'}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{market === 'de' ? 'Auskunftsrecht:' : 'Hozzáférés joga:'}</strong> {market === 'de' ? 'Sie koennen eine Kopie Ihrer gespeicherten Daten anfordern' : 'kérheti a tárolt adatainak másolatát'}</li>
              <li><strong>{market === 'de' ? 'Recht auf Berichtigung:' : 'Helyesbítés joga:'}</strong> {market === 'de' ? 'Sie koennen die Korrektur Ihrer Daten verlangen' : 'kérheti adatai javítását'}</li>
              <li><strong>{market === 'de' ? 'Recht auf Loeschung:' : 'Törlés joga:'}</strong> {market === 'de' ? 'Sie koennen die Loeschung Ihrer Daten verlangen ("Recht auf Vergessenwerden")' : 'kérheti adatai törlését („elfeledtetéshez való jog")'}</li>
              <li><strong>{market === 'de' ? 'Recht auf Einschraenkung:' : 'Korlátozás joga:'}</strong> {market === 'de' ? 'Sie koennen die Einschraenkung der Verarbeitung verlangen' : 'kérheti az adatkezelés korlátozását'}</li>
              <li><strong>{market === 'de' ? 'Datenuebertragbarkeit:' : 'Adathordozhatóság:'}</strong> {market === 'de' ? 'Sie koennen die Uebertragung Ihrer Daten an einen anderen Anbieter verlangen' : 'kérheti adatai átadását más szolgáltatónak'}</li>
              <li><strong>{market === 'de' ? 'Widerspruchsrecht:' : 'Tiltakozás joga:'}</strong> {market === 'de' ? 'Sie koennen der Datenverarbeitung widersprechen' : 'tiltakozhat az adatkezelés ellen'}</li>
            </ul>
            <p className="leading-relaxed mt-3">
              {market === 'de' ? 'Zur Ausuebung Ihrer Rechte schreiben Sie an ' : 'Jogai gyakorlásához írjon az '}<strong>epresla@icloud.com</strong>{market === 'de' ? '. Fuer die sofortige Loeschung Ihres Kontos melden Sie sich in der App an und navigieren zu ' : ' e-mail címre. Fiókja azonnali törléséhez lépjen be az alkalmazásba és navigáljon a '}{' '}
              <Link href="/settings" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                {market === 'de' ? 'Einstellungen → Konto loeschen' : 'Beállítások → Fiók törlése'}
              </Link>{' '}
              {market === 'de' ? 'oder nutzen Sie das ' : 'menüpontra, vagy használja a '}{' '}
              <Link href="/delete-account" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                {market === 'de' ? 'Loeschformular' : 'törlési űrlapot'}
              </Link>{market === 'de' ? '.' : '.'}
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '10. Push-Benachrichtigungen' : '10. Push értesítések'}
            </h2>
            <p className="leading-relaxed">
              {market === 'de' ? 'Die App kann Push-Benachrichtigungen zu neuen Vertretungsanfragen, Nachrichten und Bewerbungen senden. Sie koennen Benachrichtigungen jederzeit in den App-Einstellungen oder in den Systemeinstellungen Ihres Geraets deaktivieren.' : 'Az Alkalmazás push értesítéseket küldhet új helyettesítési igényekről, üzenetekről és jelentkezésekről. Az értesítéseket bármikor kikapcsolhatja az Alkalmazás beállításaiban vagy a telefon rendszerbeállításaiban.'}
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '11. Daten von Minderjaehrigen' : '11. Gyermekek adatai'}
            </h2>
            <p className="leading-relaxed">
              {market === 'de' ? 'Die App richtet sich an Nutzer ab 18 Jahren. Wir erfassen wissentlich keine Daten von Personen unter 18 Jahren.' : 'Az Alkalmazás 18 éven felüli felhasználóknak szól. Tudatosan nem gyűjtünk adatokat 18 év alatti személyektől.'}
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '12. Aenderungen' : '12. Változások'}
            </h2>
            <p className="leading-relaxed">
              {market === 'de' ? 'Wir behalten uns das Recht vor, diesen Datenschutzhinweis zu aendern. Ueber wesentliche Aenderungen informieren wir Nutzer in der App oder per E-Mail.' : 'Fenntartjuk a jogot, hogy ezt az Adatvédelmi Tájékoztatót módosítsuk. A lényeges változásokról értesítjük felhasználóinkat az Alkalmazásban vagy e-mailben.'}
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '13. Beschwerde' : '13. Panasz'}
            </h2>
            <p className="leading-relaxed">
              {market === 'de' ? 'Wenn Sie der Ansicht sind, dass wir Ihre Daten unrechtmaessig verarbeiten, koennen Sie bei der ungarischen Datenschutzbehoerde (NAIH) Beschwerde einlegen:' : 'Ha úgy érzi, hogy adatait jogellenesen kezeljük, panaszt tehet a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH):'}<br /><br />
              <strong>{market === 'de' ? 'Adresse:' : 'Cím:'}</strong> 1055 Budapest, Falk Miksa utca 9-11.<br />
              <strong>Telefon:</strong> +36 1 391-1400<br />
              <strong>E-mail:</strong> ugyfelszolgalat@naih.hu<br />
              <strong>Web:</strong> https://naih.hu
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? '14. Kontakt' : '14. Kapcsolat'}
            </h2>
            <p className="leading-relaxed">
              {market === 'de' ? 'Bei Datenschutzfragen kontaktieren Sie uns:' : 'Adatvédelmi kérdésekkel kapcsolatban írjon nekünk:'}<br /><br />
              <strong>{market === 'de' ? 'Entwickler:' : 'Fejlesztő:'}</strong> Epres László<br />
              <strong>E-mail:</strong> epresla@icloud.com<br />
              <strong>{market === 'de' ? 'Webseite:' : 'Weboldal:'}</strong> https://pharmagister.hu
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
