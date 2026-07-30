"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getClientMarket } from '@/lib/marketI18n';

/**
 * A felhasznalasi feltetelek legutolso verzioja.
 * Ha modositjuk a feltételeket, ezt az értéket növeljük,
 * és a felhasználókat újra elfogadásra kérjük.
 */
export const CURRENT_TERMS_VERSION = '2026-03-04';

export default function TermsUpdateModal() {
  const { user, userData, loading } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();
  const [accepting, setAccepting] = useState(false);
  const [acceptedVersionOverride, setAcceptedVersionOverride] = useState(null);
  const acceptedVersion = acceptedVersionOverride ?? userData?.termsAcceptedVersion ?? null;

  // Csak auth betöltés után döntsünk a modalról, különben villanhat induláskor.
  if (loading) return null;
  // Csak bejelentkezett felhasználóknak jelenik meg, akik még nem fogadták el az aktuális verziót.
  if (!user || !userData) return null;
  if (acceptedVersion === CURRENT_TERMS_VERSION) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
      });
      setAcceptedVersionOverride(CURRENT_TERMS_VERSION);
    } catch (error) {
      console.error('Error accepting terms:', error);
      alert(market === 'de' ? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' : 'Hiba történt. Kérjük, próbáld újra.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
          color: darkMode ? '#f3f4f6' : '#111827',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
      >
        {/* Fejléc */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            background: darkMode ? '#111827' : '#f9fafb',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {market === 'de' ? 'Nutzungsbedingungen wurden aktualisiert' : 'Felhasználási feltételek módosultak'}
          </h2>
          <p style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 4 }}>
            {market === 'de' ? 'Gueltig ab: 4. Maerz 2026.' : 'Hatályos: 2026. március 4.'}
          </p>
        </div>

        {/* Tartalom - görgethető */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            lineHeight: 1.7,
            fontSize: 14,
          }}
        >
          <p style={{ marginBottom: 16 }}>
            {market === 'de' ? 'Liebe Nutzerin, lieber Nutzer!' : 'Kedves Felhasználó!'}
          </p>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Die Nutzungsbedingungen der Pharmagister App wurden in den folgenden Punkten geaendert. Bitte lies die Aenderungen und akzeptiere sie, um fortzufahren.'
              : 'A Pharmagister alkalmazás felhasználási feltételei az alábbi pontokban módosultak. Kérjük, olvasd el a változásokat, majd fogadd el a folytatáshoz.'}
          </p>

          <hr style={{ border: 'none', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, margin: '16px 0' }} />

          {/* Hiánycikk kereső blokk */}
          <div style={{
            padding: '16px 20px',
            marginBottom: 20,
            borderRadius: 12,
            border: `2px solid ${darkMode ? '#059669' : '#10b981'}`,
            backgroundColor: darkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: darkMode ? '#6ee7b7' : '#059669' }}>
              {market === 'de' ? 'Neue Funktion: Engpass-Suche' : 'Új funkció: Hiánycikk kereső'}
            </h3>
            <p style={{ marginBottom: 0, fontSize: 14 }}>
              {market === 'de'
                ? 'Die Engpass-Suche dient ausschliesslich dem informativen Austausch zwischen registrierten Apotheken und Mitarbeitenden. Auf der Plattform finden keine Verkaeufe oder Transaktionen statt; die Kontaktaufnahme erfolgt stets offline, per Telefon oder E-Mail. Pharmagister uebernimmt keine Haftung fuer Verfuegbarkeit oder moegliche Folgen im Zusammenhang mit Engpassartikeln.'
                : 'A Hiánycikk kereső funkció kizárólag tájékoztató jellegű információmegosztást szolgál a regisztrált gyógyszertárak és alkalmazottak között. Az oldalon nem történik értékesítés vagy tranzakció, és a felhasználók közötti kapcsolatfelvétel minden esetben offline, telefonon vagy emailben történik. A Pharmagister nem vállal felelősséget a hiánycikkek elérhetőségéért vagy az abból származó esetleges következményekért.'}
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, margin: '16px 0' }} />

          {/* Kiemelt blokk */}
          <div style={{
            padding: '16px 20px',
            marginBottom: 20,
            borderRadius: 12,
            border: `2px solid ${darkMode ? '#7c3aed' : '#6B46C1'}`,
            backgroundColor: darkMode ? 'rgba(107,70,193,0.15)' : '#f5f3ff',
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: darkMode ? '#c4b5fd' : '#6B46C1' }}>
              {market === 'de' ? 'Oeffentliche Anzeige der Apotheken-Antwortquote' : 'Gyógyszertári válaszadási arány nyilvános megjelenítése'}
            </h3>
            <p style={{ marginBottom: 0, fontSize: 14 }}>
              {market === 'de'
                ? <>Das System erfasst jetzt, in welchem Anteil Apotheken auf eingehende Vertretungsbewerbungen (Annahme oder Ablehnung) <strong>innerhalb von 72 Stunden</strong> reagieren. Dieser Wert wird als farbiger Indikator neben dem Apothekennamen angezeigt, ueberall dort, wo eine Vertretungsanfrage sichtbar ist.</>
                : 'A rendszer mostantól nyilvántartja, hogy a gyógyszertárak milyen arányban válaszolnak (elfogadás vagy elutasítás) a hozzájuk beérkező helyettesítési jelentkezésekre 72 órán belül. Ez az adat egy színes visszajelző sáv formájában megjelenik a gyógyszertár neve mellett mindenhol, ahol egy helyettesítési igényt megtekint egy felhasználó.'}
            </p>
          </div>

          {/* 1. Válaszadási visszajelzés */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '1. Details' : '1. Részletek'}
          </h3>
          <p style={{ marginBottom: 8 }}>
            {market === 'de'
              ? 'Der Indikator zeigt einen Prozentwert und basiert ausschliesslich auf aggregierten, anonymisierten Statistiken; personenbezogene Daten einzelner Bewerber werden nicht veroeffentlicht.'
              : 'A visszajelző sáv százalékos arányt mutat, és kizárólag összesített, anonimizált statisztikán alapul -- egyedi jelentkezők adatai nem kerülnek nyilvánosságra.'}
          </p>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Die Farblogik ist wie folgt: Rot bedeutet niedrige, Orange mittlere und Gruen hohe Antwortquote. Hat eine Apotheke noch keine Bewerbungen, erscheint der Balken vollstaendig gruen.'
              : 'A sáv a következő módon működik: a piros szín alacsony, a narancs közepes, a zöld szín magas válaszadási arányt jelöl. Ha a gyógyszertárnak még nincs jelentkezője, a sáv teljes egészében zöld.'}
          </p>

          {/* 2. Adatkezelés */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '2. Ergaenzung zur Datenverarbeitung' : '2. Adatkezelési kiegészítés'}
          </h3>
          <p style={{ marginBottom: 8 }}>
            {market === 'de'
              ? 'Zur Berechnung der Antwortquote nutzt das System folgende bereits gespeicherte Daten:'
              : 'A válaszadási arány kiszámításához a rendszer az alábbi, már korábban is tárolt adatokat használja fel:'}
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
            <li style={{ marginBottom: 4 }}>{market === 'de' ? 'Zeitpunkt des Bewerbungseingangs' : 'A jelentkezés beérkezésének időpontja'}</li>
            <li style={{ marginBottom: 4 }}>{market === 'de' ? 'Zeitpunkt der Antwort der Apotheke (Annahme/Ablehnung)' : 'A gyógyszertár válaszának (elfogadás/elutasítás) időpontja'}</li>
            <li style={{ marginBottom: 4 }}>{market === 'de' ? 'Ob die Antwort innerhalb von 72 Stunden erfolgte' : 'A válasz megtörténtének ténye 72 órán belül'}</li>
          </ul>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Es werden keine personenbezogenen Daten der Bewerber, keine Bewerbungsinhalte und keine Begruendungen der Antworten verarbeitet oder angezeigt. Die Statistik beruecksichtigt ausschliesslich Antwortzeitpunkt und Antwortfakt.'
              : 'Nem kerülnek feldolgozásra és megjelenítésre a jelentkezők személyes adatai, a jelentkezés tartalma vagy a válasz indoklása. A statisztika kizárólag a válasz tényét és idejét veszi figyelembe.'}
          </p>

          {/* 3. Cél */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '3. Ziel der Aenderung' : '3. A módosítás célja'}
          </h3>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Die Aenderung soll Vertretungsapothekern und Assistenten eine informierte Entscheidung bei Bewerbungen ermoeglichen und aktiv antwortende Apotheken sichtbar machen. Die Funktion staerkt Transparenz und Verlaesslichkeit der Plattform.'
              : 'A változtatás célja, hogy a helyettesítő gyógyszerészek és szakasszisztensek tájékozott döntést hozhassanak a jelentkezésük beadásakor, és előnyben részesíthessék az aktívan válaszoló gyógyszertárakat. Ez a funkció a platform átláthatóságát és megbízhatóságát szolgálja.'}
          </p>

          {/* 4. Jogok */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '4. Nutzerrechte' : '4. Felhasználói jogok'}
          </h3>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Deine in der Datenschutzerklaerung festgelegten Rechte (Auskunft, Berichtigung, Loeschung, Widerspruch) bleiben unveraendert gueltig. Bei Fragen zur Aenderung kontaktiere uns bitte unter epresla@icloud.com.'
              : 'Az adatvédelmi tájékoztatóban rögzített jogaid (hozzáférés, helyesbítés, törlés, tiltakozás) változatlanul érvényesek. Ha bármilyen kérdésed van a módosítással kapcsolatban, kérjük, írd meg az epresla@icloud.com címre.'}
          </p>

          <hr style={{ border: 'none', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, margin: '16px 0' }} />

          <p style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280' }}>
            {market === 'de'
              ? 'Zur weiteren Nutzung der Pharmagister App ist die Annahme der neuen Bedingungen erforderlich. Wenn du sie nicht akzeptieren moechtest, kannst du dein Konto jederzeit im Einstellungsmenue loeschen.'
              : 'A Pharmagister alkalmazás további használatához az új feltételek elfogadása szükséges. Amennyiben nem kívánod elfogadni, a fiókodat a Beállítások menüben bármikor törölheted.'}
          </p>
        </div>

        {/* Elfogadás gomb */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            background: darkMode ? '#111827' : '#f9fafb',
          }}
        >
          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              backgroundColor: accepting ? '#9ca3af' : '#6B46C1',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 600,
              cursor: accepting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => { if (!accepting) e.target.style.backgroundColor = '#5a3aa3'; }}
            onMouseOut={(e) => { if (!accepting) e.target.style.backgroundColor = '#6B46C1'; }}
          >
            {accepting ? (market === 'de' ? 'Wird verarbeitet...' : 'Feldolgozás...') : (market === 'de' ? 'Ich habe gelesen und akzeptiere' : 'Elolvastam és elfogadom')}
          </button>
        </div>
      </div>
    </div>
  );
}
