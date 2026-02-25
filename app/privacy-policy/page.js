"use client";
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  const { darkMode } = useTheme();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Adatvédelmi Tájékoztató
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6 space-y-6`}>
          
          <div className="text-sm text-gray-500 mb-4">
            Hatályos: 2026. február 11. |{' '}
            <Link href="/privacy-policy/en" className="text-purple-600 hover:underline">English version</Link>
          </div>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              1. Bevezetés
            </h2>
            <p className="leading-relaxed">
              A Pharmagister alkalmazás („Alkalmazás", „Szolgáltatás") üzemeltetője elkötelezett a felhasználók 
              személyes adatainak védelme iránt. Ez az Adatvédelmi Tájékoztató ismerteti, hogy milyen adatokat 
              gyűjtünk, hogyan használjuk fel azokat, és milyen jogok illetik meg Önt az adataival kapcsolatban.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              2. Adatkezelő
            </h2>
            <p className="leading-relaxed">
              <strong>Fejlesztő neve:</strong> Epres László<br />
              <strong>Alkalmazás neve:</strong> Pharmagister<br />
              <strong>E-mail:</strong> info@pharmagister.hu<br />
              <strong>Weboldal:</strong> https://pharmagister.hu
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              3. Gyűjtött adatok
            </h2>
            <p className="leading-relaxed mb-3">
              Az Alkalmazás használata során az alábbi személyes adatokat gyűjtjük és kezeljük:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Regisztrációs adatok:</strong> név, e-mail cím, jelszó (titkosítva)</li>
              <li><strong>Profil adatok:</strong> telefonszám, profilkép, bemutatkozás, szakmai tapasztalat</li>
              <li><strong>Helyettesítési igények:</strong> dátumok, helyszín (irányítószám), pozíció típusa</li>
              <li><strong>Kommunikációs adatok:</strong> üzenetek, értesítések</li>
              <li><strong>Technikai adatok:</strong> eszköz típusa, push notification token</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              4. Az adatkezelés célja
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Felhasználói fiók létrehozása és kezelése</li>
              <li>Helyettesítési igények és jelentkezések közvetítése</li>
              <li>Felhasználók közötti kommunikáció biztosítása</li>
              <li>Push értesítések küldése (új igények, üzenetek)</li>
              <li>Szolgáltatás fejlesztése és hibák javítása</li>
              <li><strong>Válaszadási arány mérése:</strong> a gyógyszertárak 72 órán belüli válaszadási arányát százalékosan megjelenítjük a helyettesítési igényeknél, a szolgáltatás minőségének javítása érdekében. Ez az adat a jelentkezésekre adott válaszok alapján automatikusan kerül kiszámításra.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              5. Az adatkezelés jogalapja
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Szerződés teljesítése:</strong> a szolgáltatás nyújtásához szükséges adatok (GDPR 6. cikk (1) b)</li>
              <li><strong>Hozzájárulás:</strong> push értesítések, opcionális profil adatok (GDPR 6. cikk (1) a)</li>
              <li><strong>Jogos érdek:</strong> szolgáltatás biztonsága, visszaélések megelőzése (GDPR 6. cikk (1) f)</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              6. Adatok megosztása
            </h2>
            <p className="leading-relaxed mb-3">
              Személyes adatait harmadik féllel csak az alábbi esetekben osztjuk meg:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Más felhasználókkal:</strong> jelentkezéskor a gyógyszertár láthatja az Ön által megosztott adatokat (beállítható)</li>
              <li><strong>Szolgáltatók:</strong>
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li>Firebase (Google) - adattárolás, autentikáció, push értesítések</li>
                  <li>Cloudinary - képek és médiafájlok tárolása, feldolgozása</li>
                </ul>
              </li>
              <li><strong>Jogi kötelezettség:</strong> hatósági megkeresés esetén</li>
            </ul>
            <p className="leading-relaxed mt-3">
              <strong>Nem értékesítjük és nem adjuk ki személyes adatait hirdetési célokra.</strong>
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              7. Adatok tárolása és biztonsága
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Az adatokat a Google Firebase EU-s szerverein tároljuk</li>
              <li>A jelszavak titkosítva (hash) kerülnek tárolásra</li>
              <li>HTTPS titkosított kapcsolatot használunk</li>
              <li>Az adatokhoz csak az arra jogosultak férhetnek hozzá</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              8. Adatmegőrzési idő
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Felhasználói fiók adatai: a fiók törléséig</li>
              <li>Helyettesítési igények: az igény lejárta után 1 év</li>
              <li>Üzenetek: 2 év</li>
              <li>Fiók törlése esetén az összes adat 30 napon belül törlésre kerül</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              9. Az Ön jogai
            </h2>
            <p className="leading-relaxed mb-3">
              A GDPR alapján Önt az alábbi jogok illetik meg:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Hozzáférés joga:</strong> kérheti a tárolt adatainak másolatát</li>
              <li><strong>Helyesbítés joga:</strong> kérheti adatai javítását</li>
              <li><strong>Törlés joga:</strong> kérheti adatai törlését („elfeledtetéshez való jog")</li>
              <li><strong>Korlátozás joga:</strong> kérheti az adatkezelés korlátozását</li>
              <li><strong>Adathordozhatóság:</strong> kérheti adatai átadását más szolgáltatónak</li>
              <li><strong>Tiltakozás joga:</strong> tiltakozhat az adatkezelés ellen</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Jogai gyakorlásához írjon az <strong>info@pharmagister.hu</strong> e-mail címre. Fiókja azonnali törléséhez lépjen be az alkalmazásba és navigáljon a{' '}
              <Link href="/settings" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                Beállítások → Fiók törlése
              </Link>{' '}
              menüpontra, vagy használja a{' '}
              <Link href="/delete-account" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                törlési űrlapot
              </Link>.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              10. Push értesítések
            </h2>
            <p className="leading-relaxed">
              Az Alkalmazás push értesítéseket küldhet új helyettesítési igényekről, üzenetekről és 
              jelentkezésekről. Az értesítéseket bármikor kikapcsolhatja az Alkalmazás beállításaiban 
              vagy a telefon rendszerbeállításaiban.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              11. Gyermekek adatai
            </h2>
            <p className="leading-relaxed">
              Az Alkalmazás 18 éven felüli felhasználóknak szól. Tudatosan nem gyűjtünk adatokat 
              18 év alatti személyektől.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              12. Változások
            </h2>
            <p className="leading-relaxed">
              Fenntartjuk a jogot, hogy ezt az Adatvédelmi Tájékoztatót módosítsuk. A lényeges 
              változásokról értesítjük felhasználóinkat az Alkalmazásban vagy e-mailben.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              13. Panasz
            </h2>
            <p className="leading-relaxed">
              Ha úgy érzi, hogy adatait jogellenesen kezeljük, panaszt tehet a Nemzeti Adatvédelmi 
              és Információszabadság Hatóságnál (NAIH):<br /><br />
              <strong>Cím:</strong> 1055 Budapest, Falk Miksa utca 9-11.<br />
              <strong>Telefon:</strong> +36 1 391-1400<br />
              <strong>E-mail:</strong> ugyfelszolgalat@naih.hu<br />
              <strong>Web:</strong> https://naih.hu
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              14. Kapcsolat
            </h2>
            <p className="leading-relaxed">
              Adatvédelmi kérdésekkel kapcsolatban írjon nekünk:<br /><br />
              <strong>Fejlesztő:</strong> Epres László<br />
              <strong>E-mail:</strong> info@pharmagister.hu<br />
              <strong>Weboldal:</strong> https://pharmagister.hu
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
