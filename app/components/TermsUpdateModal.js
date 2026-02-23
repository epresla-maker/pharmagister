"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * A felhasznalasi feltetelek legutolso verzioja.
 * Ha modositjuk a feltételeket, ezt az értéket növeljük,
 * és a felhasználókat újra elfogadásra kérjük.
 */
export const CURRENT_TERMS_VERSION = '2026-02-23';

export default function TermsUpdateModal() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const [accepting, setAccepting] = useState(false);

  // Csak bejelentkezett felhasználóknak jelenik meg, akik még nem fogadták el az aktuális verziót
  if (!user || !userData) return null;
  if (userData.termsAcceptedVersion === CURRENT_TERMS_VERSION) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error accepting terms:', error);
      alert('Hiba történt. Kérjük, próbáld újra.');
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
            Felhasználási feltételek módosultak
          </h2>
          <p style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 4 }}>
            Hatályos: 2026. február 23.
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
            Kedves Felhasználó!
          </p>
          <p style={{ marginBottom: 16 }}>
            A Pharmagister alkalmazás felhasználási feltételei az alábbi pontokban módosultak.
            Kérjük, olvasd el a változásokat, majd fogadd el a folytatáshoz.
          </p>

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
              Gyogyszertari valaszadasi arany nyilvanos megjelenitese
            </h3>
            <p style={{ marginBottom: 0, fontSize: 14 }}>
              A rendszer mostantol nyilvantartja, hogy a gyogyszertarak milyen aranyban valaszolnak
              (elfogadas vagy elutasitas) a hozzajuk berkezo helyettesitesi jelentkezesekre
              <strong> 72 oran belul</strong>. Ez az adat egy szines visszajelzo sav formajaban
              megjelenik a gyogyszertar neve mellett mindenhol, ahol egy helyettesitesi igenyt
              megtekint egy felhasznalo.
            </p>
          </div>

          {/* 1. Válaszadási visszajelzés */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            1. Reszletek
          </h3>
          <p style={{ marginBottom: 8 }}>
            A visszajelzo sav szazalekos aranyt mutat, es kizarolag osszesitett, anonimizalt
            statisztikan alapul -- egyedi jelentkezok adatai nem kerulnek nyilvanossagra.
          </p>
          <p style={{ marginBottom: 16 }}>
            A sav a kovetkezo modon mukodik: a piros szin alacsony, a narancs kozepes, a zold
            szin magas valaszadasi aranyt jelol. Ha a gyogyszertarnak meg nincs jelentkezoje,
            a sav teljes egeszeben zold.
          </p>

          {/* 2. Adatkezelés */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            2. Adatkezelesi kiegeszites
          </h3>
          <p style={{ marginBottom: 8 }}>
            A válaszadási arány kiszámításához a rendszer az alábbi, már korábban is tárolt adatokat
            használja fel:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
            <li style={{ marginBottom: 4 }}>A jelentkezés beérkezésének időpontja</li>
            <li style={{ marginBottom: 4 }}>A gyógyszertár válaszának (elfogadás/elutasítás) időpontja</li>
            <li style={{ marginBottom: 4 }}>A válasz megtörténtének ténye 72 órán belül</li>
          </ul>
          <p style={{ marginBottom: 16 }}>
            Nem kerülnek feldolgozásra és megjelenítésre a jelentkezők személyes adatai,
            a jelentkezés tartalma vagy a válasz indoklása. A statisztika kizárólag a válasz
            tényét és idejét veszi figyelembe.
          </p>

          {/* 3. Cél */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            3. A modositas celja
          </h3>
          <p style={{ marginBottom: 16 }}>
            A változtatás célja, hogy a helyettesítő gyógyszerészek és szakasszisztensek
            tájékozott döntést hozhassanak a jelentkezésük beadásakor, és előnyben
            részesíthessék az aktívan válaszoló gyógyszertárakat. Ez a funkció a platform
            átláthatóságát és megbízhatóságát szolgálja.
          </p>

          {/* 4. Jogok */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            4. Felhasznaloi jogok
          </h3>
          <p style={{ marginBottom: 16 }}>
            Az adatvédelmi tájékoztatóban rögzített jogaid (hozzáférés, helyesbítés, törlés,
            tiltakozás) változatlanul érvényesek. Ha bármilyen kérdésed van a módosítással
            kapcsolatban, kérjük, írd meg az info@pharmagister.hu címre.
          </p>

          <hr style={{ border: 'none', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, margin: '16px 0' }} />

          <p style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280' }}>
            A Pharmagister alkalmazás további használatához az új feltételek elfogadása szükséges.
            Amennyiben nem kívánod elfogadni, a fiókodat a Beállítások menüben bármikor törölheted.
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
            {accepting ? 'Feldolgozás...' : 'Elolvastam és elfogadom'}
          </button>
        </div>
      </div>
    </div>
  );
}
