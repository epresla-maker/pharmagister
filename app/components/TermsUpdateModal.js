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
export const CURRENT_TERMS_VERSION = '2026-09-22';

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
            {market === 'de' ? 'Gueltig ab: 22. September 2026.' : 'Hatályos: 2026. szeptember 22.'}
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

          {/* Fizetos funkcio blokk */}
          <div style={{
            padding: '16px 20px',
            marginBottom: 20,
            borderRadius: 12,
            border: `2px solid ${darkMode ? '#059669' : '#10b981'}`,
            backgroundColor: darkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: darkMode ? '#6ee7b7' : '#059669' }}>
              {market === 'de' ? 'Neue Funktion: In-App-Kauf' : 'Új funkció: Alkalmazáson belüli vásárlás'}
            </h3>
            <p style={{ marginBottom: 0, fontSize: 14 }}>
              {market === 'de'
                ? 'In der mobilen App steht jetzt ein In-App-Kauf zur Verfuegung, mit dem du ein zusaetzliches Bedarfs-Kreditpaket ueber den Apple App Store oder Google Play kaufen kannst. Bisher waren alle Funktionen der App kostenlos -- dies ist die erste kostenpflichtige Funktion, die wir einfuehren.'
                : 'A mobilalkalmazásban mostantól elérhető egy alkalmazáson belüli vásárlási lehetőség (In-App Purchase), amellyel kiegészítő kereslet-kredit csomagot vásárolhatsz az Apple App Store-on vagy a Google Play Áruházon keresztül. Eddig az alkalmazás minden funkciója ingyenes volt -- ez az első fizetős funkció, amit bevezetünk.'}
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
              {market === 'de' ? 'Details zum Kauf' : 'A vásárlás részletei'}
            </h3>
            <p style={{ marginBottom: 0, fontSize: 14 }}>
              {market === 'de'
                ? 'Das gekaufte Guthaben ist ein einmaliges Produkt (kein Abonnement). Die Zahlung wird von Apple bzw. Google ueber deren eigenes Zahlungssystem abgewickelt; die App hat keinen Zugriff auf deine Zahlungs- oder Kartendaten. Rueckerstattungsantraege stellst du direkt beim Apple- bzw. Google-Support, gemaess den jeweils geltenden Store-Richtlinien.'
                : 'A megvásárolt kredit egyszeri termék (nem előfizetés). A fizetést az Apple, illetve a Google kezeli a saját fizetési rendszerén keresztül -- az alkalmazás nem fér hozzá a fizetési vagy bankkártya-adataidhoz. Visszatérítési igényedet közvetlenül az Apple, illetve a Google ügyfélszolgálatán keresztül kezdeményezheted, a mindenkori áruházi szabályzat szerint.'}
            </p>
          </div>

          {/* 1. Reszletek */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '1. Wofuer wird das Guthaben verwendet?' : '1. Mire használható fel a kredit?'}
          </h3>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Das Guthaben kannst du zur Veroeffentlichung von Vertretungsanfragen (Bedarfsanzeigen) verwenden. Der Kauf ist freiwillig -- die Grundfunktionen der App (Registrierung, Suche nach Vertretungen, Nachrichtenversand) bleiben weiterhin vollstaendig kostenlos.'
              : 'A kreditet helyettesítési igények (keresleti hirdetések) közzétételére használhatod fel. A vásárlás önkéntes -- az alkalmazás alapfunkciói (regisztráció, helyettesítés keresése, üzenetküldés) továbbra is teljesen ingyenesek maradnak.'}
          </p>

          {/* 2. Adatkezeles */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '2. Ergaenzung zur Datenverarbeitung' : '2. Adatkezelési kiegészítés'}
          </h3>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Zur technischen Freischaltung des Kaufs nutzen wir den Dienst RevenueCat. Dabei werden die Kauf-ID, die Produkt-ID und eine anonyme, geraetegebundene Nutzer-ID uebertragen. Deine Zahlungs- oder Kartendaten sieht weder RevenueCat noch die Pharmagister-App -- diese werden ausschliesslich von Apple bzw. Google verarbeitet.'
              : 'A vásárlás technikai aktiválásához a RevenueCat szolgáltatást használjuk. Ennek során átadásra kerül a vásárlás azonosítója, a termékazonosító és egy anonim, eszközhöz kötött felhasználói azonosító. A fizetési vagy bankkártya-adataidat sem a RevenueCat, sem a Pharmagister alkalmazás nem látja -- ezeket kizárólag az Apple, illetve a Google kezeli.'}
          </p>

          {/* 3. Cel */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {market === 'de' ? '3. Ziel der Aenderung' : '3. A módosítás célja'}
          </h3>
          <p style={{ marginBottom: 16 }}>
            {market === 'de'
              ? 'Die neue, optionale Kaufmoeglichkeit dient der langfristigen Finanzierung und Weiterentwicklung des Dienstes, waehrend die Kernfunktionen der Plattform fuer alle Nutzer weiterhin kostenlos zugaenglich bleiben.'
              : 'Az új, opcionális vásárlási lehetőség a szolgáltatás hosszabb távú finanszírozását és továbbfejlesztését szolgálja, míg a platform alapfunkciói továbbra is minden felhasználó számára ingyenesen elérhetők maradnak.'}
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
