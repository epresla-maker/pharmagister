"use client";
import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function ChildSafetyPage() {
  const { darkMode } = useTheme();
  const [showHungarian, setShowHungarian] = useState(false);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 pt-safe-small ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Child Safety Standards
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6 space-y-6`}>

          <div className="text-sm text-gray-500 mb-4">
            Effective: March 24, 2026 | Hatályos: 2026. március 24.
          </div>

          {/* Introduction */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              1. Introduction
            </h2>
            <p className="leading-relaxed">
              Pharmagister (com.pharmagister.app), developed by Epres László, is a professional platform
              designed exclusively for licensed pharmacists, pharmacy technicians, and pharmacy staff in Hungary.
              The app facilitates pharmacy substitution job matching, professional community features, and
              continuing education resources. Pharmagister is intended for users aged 18 and above.
            </p>
            <p className="leading-relaxed mt-3">
              We are deeply committed to child safety and maintain a zero-tolerance policy toward child sexual
              abuse and exploitation (CSAE) on our platform. This document outlines our Child Safety Standards
              in compliance with Google Play&apos;s Child Safety Standards policy.
            </p>
          </section>

          {/* Prohibition of CSAE */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              2. Prohibition of Child Sexual Abuse and Exploitation (CSAE)
            </h2>
            <p className="leading-relaxed mb-3">
              Pharmagister strictly and explicitly prohibits any form of child sexual abuse and exploitation
              (CSAE) content, behavior, or activity on our platform, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Child sexual abuse material (CSAM) — any visual, written, or other depiction of minors in sexually explicit situations</li>
              <li>Grooming — building trust with a minor for the purpose of sexual exploitation</li>
              <li>Solicitation of minors for sexual purposes</li>
              <li>Sextortion involving minors</li>
              <li>Trafficking of minors</li>
              <li>Any other form of sexualization, abuse, or exploitation of children</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Any user found engaging in, promoting, or distributing CSAE content or behavior will have their
              account immediately and permanently terminated, and the incident will be reported to the
              relevant law enforcement authorities, including the National Center for Missing & Exploited
              Children (NCMEC) and Hungarian authorities (NMHH, rendőrség).
            </p>
          </section>

          {/* User Reporting */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              3. In-App Reporting Mechanism
            </h2>
            <p className="leading-relaxed mb-3">
              Pharmagister provides multiple in-app mechanisms for users to report inappropriate content or behavior:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Report modal on community posts:</strong> Every community post has a &quot;Report&quot; (Jelentés) button that opens an in-app reporting modal where users can select a reason and submit the report directly</li>
              <li><strong>Report modal on chat messages:</strong> In private chat conversations, users can report individual messages or the other user via the same in-app reporting modal</li>
              <li><strong>In-app Support page:</strong> A dedicated Support page is accessible from the Settings menu at any time, providing direct contact options</li>
              <li><strong>Email:</strong> Reports can also be sent directly to <a href="mailto:info@pharmagister.hu" className="text-purple-600 hover:underline">info@pharmagister.hu</a></li>
            </ul>
            <p className="leading-relaxed mt-3">
              All reports are stored in our database and reviewed by the app operator. Reports related to
              child safety are treated with the highest priority and are reviewed within 24 hours.
            </p>
          </section>

          {/* CSAM Prevention & Enforcement */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              4. CSAM Prevention, Response, and Enforcement
            </h2>
            <p className="leading-relaxed mb-3">
              Pharmagister has the following measures in place to prevent and address CSAM:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Age restriction:</strong> The app is restricted to users aged 18+. Registration requires a valid email address. We do not knowingly collect data from minors.</li>
              <li><strong>Content moderation:</strong> User-generated content (community posts, chat messages) is subject to review and moderation by the app operator</li>
              <li><strong>Immediate content removal:</strong> Any identified CSAM or CSAE content is removed immediately upon discovery or upon receiving a user report</li>
              <li><strong>Account suspension:</strong> Accounts suspected of CSAE activity are immediately suspended pending investigation</li>
              <li><strong>Permanent ban:</strong> Confirmed CSAE violations result in permanent account termination with no possibility of reinstatement</li>
              <li><strong>Reporting to authorities:</strong> All confirmed CSAM/CSAE incidents are reported to the relevant law enforcement authorities, including the National Center for Missing &amp; Exploited Children (NCMEC) and Hungarian law enforcement (rendőrség)</li>
              <li><strong>Evidence preservation:</strong> Relevant data is preserved and provided to law enforcement upon request, in compliance with applicable legal requirements</li>
            </ul>
          </section>

          {/* Child Safety Point of Contact */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              5. Child Safety Point of Contact
            </h2>
            <p className="leading-relaxed mb-3">
              For any child safety concerns or to report CSAE-related issues, please contact our designated
              Child Safety officer:
            </p>
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 space-y-2`}>
              <p className="font-semibold text-lg">Child Safety Contact</p>
              <p><strong>Name:</strong> Epres László</p>
              <p><strong>Title:</strong> Child Safety Officer &amp; App Operator</p>
              <p><strong>Organization:</strong> Pharmagister (com.pharmagister.app)</p>
              <p><strong>Email:</strong> <a href="mailto:info@pharmagister.hu" className="text-purple-600 hover:underline">info@pharmagister.hu</a></p>
              <p><strong>Response time:</strong> Within 24–48 hours</p>
              <p><strong>Languages:</strong> Hungarian, English</p>
            </div>
            <p className="leading-relaxed mt-3">
              This designated contact person is authorized and able to speak to Pharmagister&apos;s CSAM
              prevention practices, content moderation procedures, and full compliance with Google Play&apos;s
              Child Safety and Child Endangerment policies. This contact information is kept up to date
              in the Child Safety Standards declaration on Google Play.
            </p>
          </section>

          {/* Legal Compliance */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              6. Legal Compliance
            </h2>
            <p className="leading-relaxed">
              Pharmagister complies with all applicable child safety laws and regulations, including but not
              limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>European Union regulations on combating child sexual abuse</li>
              <li>Hungarian Criminal Code (Btk.) provisions regarding child protection</li>
              <li>Google Play&apos;s Child Safety Standards policy</li>
              <li>COPPA (Children&apos;s Online Privacy Protection Act) principles</li>
            </ul>
          </section>

          {/* Updates */}
          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              7. Updates to This Policy
            </h2>
            <p className="leading-relaxed">
              This Child Safety Standards document may be updated periodically to reflect changes in
              applicable laws, regulations, or platform policies. Users will be notified of material changes
              through the app or via email.
            </p>
          </section>

          {/* Hungarian version toggle */}
          <div className={`border-t pt-6 mt-6 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => setShowHungarian(!showHungarian)}
              className={`flex items-center gap-2 font-semibold text-lg ${darkMode ? 'text-white' : 'text-gray-900'} hover:text-purple-600 transition-colors`}
            >
              🇭🇺 Magyar verzió
              {showHungarian ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showHungarian && (
              <div className="mt-4 space-y-6">
                <section>
                  <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    1. Bevezetés
                  </h2>
                  <p className="leading-relaxed">
                    A Pharmagister (com.pharmagister.app), fejlesztője Epres László, egy kizárólag gyógyszerészeknek,
                    patikai szakasszisztenseknek és gyógyszertári dolgozóknak készült szakmai platform Magyarországon.
                    Az alkalmazás gyógyszertári helyettesítés-közvetítést, szakmai közösségi funkciókat és
                    továbbképzési információkat biztosít. A Pharmagister kizárólag 18 éven felüli felhasználóknak szól.
                  </p>
                  <p className="leading-relaxed mt-3">
                    Mélyen elkötelezettek vagyunk a gyermekbiztonság iránt, és zéró tolerancia politikát
                    alkalmazunk a gyermekek szexuális bántalmazásával és kizsákmányolásával (CSAE) szemben
                    a platformunkon.
                  </p>
                </section>

                <section>
                  <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    2. A gyermekek szexuális bántalmazásának és kizsákmányolásának (CSAE) tiltása
                  </h2>
                  <p className="leading-relaxed mb-3">
                    A Pharmagister szigorúan és kifejezetten tiltja a gyermekek szexuális bántalmazásával és
                    kizsákmányolásával (CSAE) kapcsolatos bármilyen tartalmat, viselkedést vagy tevékenységet,
                    beleértve, de nem kizárólagosan:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Gyermekek szexuális bántalmazásáról készült anyagok (CSAM)</li>
                    <li>Grooming — bizalomépítés kiskorúval szexuális kizsákmányolás céljából</li>
                    <li>Kiskorúak szexuális célú megkeresése</li>
                    <li>Kiskorúakat érintő szextorzió</li>
                    <li>Kiskorúak kereskedelme</li>
                    <li>Gyermekek bármilyen egyéb szexualizálása, bántalmazása vagy kizsákmányolása</li>
                  </ul>
                  <p className="leading-relaxed mt-3">
                    Az ilyen tevékenységben részt vevő felhasználók fiókját azonnal és véglegesen megszüntetjük,
                    és az esetet bejelentjük az illetékes hatóságoknak (rendőrség, NCMEC).
                  </p>
                </section>

                <section>
                  <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    3. Alkalmazáson belüli bejelentési mechanizmus
                  </h2>
                  <p className="leading-relaxed mb-3">
                    A Pharmagister több bejelentési lehetőséget biztosít a felhasználóknak:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Jelentés gomb közösségi posztokon:</strong> Minden közösségi bejegyzésnél elérhető a „Jelentés" gomb</li>
                    <li><strong>Jelentés gomb chat üzenetekben:</strong> Privát beszélgetésekben az üzenetek és felhasználók jelenthetők</li>
                    <li><strong>Támogatás oldal:</strong> A Beállítások menüből bármikor elérhető</li>
                    <li><strong>Email:</strong> <a href="mailto:info@pharmagister.hu" className="text-purple-600 hover:underline">info@pharmagister.hu</a></li>
                  </ul>
                </section>

                <section>
                  <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    4. CSAM megelőzés, kezelés és végrehajtás
                  </h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Korhatár:</strong> Az alkalmazás kizárólag 18 éven felülieknek szól</li>
                    <li><strong>Tartalom moderáció:</strong> A felhasználói tartalmakat ellenőrizzük és moderáljuk</li>
                    <li><strong>Azonnali eltávolítás:</strong> A CSAM/CSAE tartalmat azonnal eltávolítjuk</li>
                    <li><strong>Fiók felfüggesztés:</strong> Gyanú esetén azonnali felfüggesztés</li>
                    <li><strong>Végleges kitiltás:</strong> Megerősített esetben végleges fiókmegszüntetés</li>
                    <li><strong>Hatósági bejelentés:</strong> Minden megerősített esetet bejelentünk a hatóságoknak</li>
                    <li><strong>Bizonyítékok megőrzése:</strong> A releváns adatokat megőrizzük a hatóságok számára</li>
                  </ul>
                </section>

                <section>
                  <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    5. Gyermekbiztonsági kapcsolattartó
                  </h2>
                  <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 space-y-2`}>
                    <p className="font-semibold text-lg">Gyermekbiztonsági kapcsolattartó</p>
                    <p><strong>Név:</strong> Epres László</p>
                    <p><strong>Beosztás:</strong> Gyermekbiztonsági felelős és alkalmazás-üzemeltető</p>
                    <p><strong>Szervezet:</strong> Pharmagister (com.pharmagister.app)</p>
                    <p><strong>Email:</strong> <a href="mailto:info@pharmagister.hu" className="text-purple-600 hover:underline">info@pharmagister.hu</a></p>
                    <p><strong>Válaszidő:</strong> 24–48 órán belül</p>
                    <p><strong>Nyelvek:</strong> magyar, angol</p>
                  </div>
                </section>

                <section>
                  <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    6. Jogi megfelelőség
                  </h2>
                  <p className="leading-relaxed">
                    A Pharmagister megfelel minden vonatkozó gyermekvédelmi jogszabálynak, beleértve
                    az Európai Unió vonatkozó rendeleteit, a magyar Büntető Törvénykönyv (Btk.) gyermekvédelmi
                    rendelkezéseit és a Google Play Gyermekbiztonsági Szabályzatát.
                  </p>
                </section>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`border-t pt-4 mt-6 text-sm ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            <p>Pharmagister &mdash; developed by Epres László</p>
            <p>Contact: <a href="mailto:info@pharmagister.hu" className="text-purple-600 hover:underline">info@pharmagister.hu</a></p>
            <p className="mt-2">
              <Link href="/privacy-policy" className="text-purple-600 hover:underline">Privacy Policy</Link>
              {' | '}
              <Link href="/support" className="text-purple-600 hover:underline">Support</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
