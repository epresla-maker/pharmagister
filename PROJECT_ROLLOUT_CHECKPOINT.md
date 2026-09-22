# Fizetes rollout checkpoint (Android -> Apple)

Utolso frissites: 2026-09-21
Allapotgazda: GitHub Copilot + epresl

## Hogyan folytassuk laptop ujrainditas utan

1. Nyisd meg ezt a fajlt: PROJECT_ROLLOUT_CHECKPOINT.md
2. Nezd meg a "Aktiv fejezet" szekciot.
3. Onnan folytassuk a kovetkezo "Konkret kovetkezo akcio" ponttal.

## Aktiv fejezet

- Aktiv fejezet: FEJEZET 1 - Android Console veglegesites
- Statusz: IN_PROGRESS
- Konkret kovetkezo akcio: Play Console-ban mindket termeket ujra letrehozni a pontos azonositoival, feltolteni az ikonokat, elmenteni es Active allapotba hozni, majd internal testinget beallitani.

## FEJEZET 0 - Technikai alapok felmerese

Statusz: KESZ

Mit ellenoriztunk:

1. Android oldali natív billing komponensek a legutolso AAB-ben benne vannak.
2. RevenueCat plugin be van kotve Androidon es iOS-en is.
3. Kliens oldali natív vasarlasi flow implementalva van.
4. RevenueCat webhook endpoint implementalva van szerver oldalon.
5. Lokal env ellenorzesek sikeresek.

Bizonyitekok:

1. check:play:billing script: [check-play-billing-readiness.js](check-play-billing-readiness.js)
2. RevenueCat env check: [check-revenuecat-setup.js](check-revenuecat-setup.js)
3. Android manifest billing permission: [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml)
4. Natív purchase helper: [lib/revenuecat.js](lib/revenuecat.js)
5. Product mapping: [lib/nativeDemandCreditProducts.js](lib/nativeDemandCreditProducts.js)
6. UI purchase inditas: [app/components/PharmaDashboard.js](app/components/PharmaDashboard.js)
7. Webhook kezeles: [app/api/payments/revenuecat-webhook/route.js](app/api/payments/revenuecat-webhook/route.js)
8. iOS plugin bekotes: [ios/App/CapApp-SPM/Package.swift](ios/App/CapApp-SPM/Package.swift)
9. iOS plugin lista (PurchasesPlugin): [ios/App/App/capacitor.config.json](ios/App/App/capacitor.config.json)

Legutolso ellenorzott Android AAB:

- Fajl: app-release-v5-clean.aab
- SHA-256: ff477f57b92e63ab3c1a39a4f4b50e145b0461728178001a0c95eabfe7b50b58

## FEJEZET 1 - Android Console veglegesites

Statusz: IN_PROGRESS

Resz-allapot frissites (2026-09-21):

1. App-szintu Play Console nezet megnyitva (Pharmagister dashboard).
2. Monetize menu magyar megfeleloje lathato: "Bevetelszerzes a Playjel".
3. Itt megjelenik az "Inditas" gomb, innen lehet belepni az in-app termek beallitasokba.
4. "Egyszeri termekek" oldalon a lista ures (Nincs talalat).
5. Felhasznaloi megerosites: tegnap a termekek letrehozasa elkezdodott, de a mentes nem sikerult, ezert nem jottek letre.
6. Regular termek letrehozas folyamat elinditva; kitoltott termekleiras oldalon az ikon + adozasi mezok latszanak, mentes elotti allapot.
7. Feltoltheto PNG ikonok generalva Play termekekhez.
   - [play-assets/iap-credits-regular.png](play-assets/iap-credits-regular.png)
   - [play-assets/iap-credits-founder.png](play-assets/iap-credits-founder.png)
8. Regular termek beallitasa 2. lepesen all: "Rendelkezesre allas es arak" oldalon a vasarlasi opcio azonosito + ar beallitas hianyzik.

Cel:

- Play Console + RevenueCat dashboard oldali beallitasok teljes zarasa.

Ellenorizendo pontok:

1. Play Console > Monetize > Products > In-app products:
   - pharmagister_4_credits_regular = Active
   - pharmagister_4_credits_founder = Active
2. Internal testing track:
   - legutolso fizetos AAB release-hez rendelve
   - release published
3. Testers:
   - tesztelo email hozzaadva
   - opt-in linken csatlakozva
4. License testing:
   - tesztelo Google fiok benne van
5. RevenueCat:
   - Google Play app osszekotve a com.pharmagister.app package-dzsel
   - offeringben a fenti ket Android product ID szerepel

Konkret kovetkezo akcio:

- Kattintas: "Bevetelszerzes a Playjel" -> "Inditas" -> "Termekek" -> "In-app termekek" -> "Termék létrehozása".
- A ket termek pontos azonositoja:
  - pharmagister_4_credits_regular
  - pharmagister_4_credits_founder
- Mindket termekre ugyanaz a folyamat: ikon feltoltese, leiras, ar/elerhetoseg beallitasa, mentes, majd Active.

Aktualis blokk (2026-09-22):

1. Play product Active statusz: A felhasznaloi konzolban a termekek letrehozasa folyamatban van, de a megerositett Active allapot meg nincs ellenorizve.
2. Internal testing release publikacio: NEM ISMERT
3. Tester + opt-in allapot: NEM ISMERT
4. License testing allapot: NEM ISMERT
5. RevenueCat Android mapping: NEM ISMERT

Fontos: a product ID-k pontosan meg kell egyezzenek a repositoryben leiro konfiguracioval, latszik itt: [NATIVE_IAP_SETUP.md](NATIVE_IAP_SETUP.md).

Jelenlegi point-of-truth a Play Console feluleten:

- A "Termék létrehozása" oldal megnyitva van.
- A kulcsfontossagu mezok: termekazonosito, ar, ikon, leiras, beszerzes kategoriak.
- A kovetkezo lepes az, hogy a regular termeket pontosan a kodigozott azonositoval mentsd el, majd az Active statuszre allitsd.

Megjegyzes:

- A repository oldali ellenorzesek alapjan a kod/build rendben van.
- A kovetkezo haladas csak konzol-oldali statuszok megerositesevel lehet pontos.
- Kovetkezo konkret lepes: ket egyszeri termek ujra-letrehozasa Play Console-ban, ezuttal mentes + aktivalas ellenorzessel.
- Jelen konkret kovetkezo lepes: regular termek mentesehez ikon feltoltes + termekado-kategoria beallitasa, majd mentes/aktivalas.
- Ikonfajlok keszen vannak, kovetkezo lepes: ikon feltoltes a Play termek oldalon es regular termek mentese.
- Aktualis konkret kovetkezo lepes: vasarlasi opcio azonosito kitoltese, ar beallitasa (Set prices), majd Aktiválás.
- Ha a regular termek sikeresen mentve es Active, akkor a founder termek ugyanazon eljarassal letrehozza a masodik product ID-vel.

## FEJEZET 2 - Android E2E vasarlas teszt

Statusz: NEM_KEZDODOTT

Cel:

- Valodi internal teszt vasarlas sikeres, majd kredit jovairas igazolva.

Siker kriterium:

1. In-app vasarlas UI feljon Androidon.
2. Vasarlas sikeresen lefut.
3. RevenueCat esemény megerkezik.
4. Webhook feldolgozza.
5. user.demandCreditsTotal novekszik.

## FEJEZET 3 - Apple Console veglegesites

Statusz: NEM_KEZDODOTT

Cel:

- App Store Connect + RevenueCat iOS oldali vegleges konfiguracio.

Siker kriterium:

1. Paid Apps / Tax / Bank complete.
2. iOS IAP termekek created + Ready to Submit/Approved allapotban.
3. RevenueCat iOS mapping kesz.
4. TestFlight build es tesztelok rendben.

## FEJEZET 4 - Apple E2E vasarlas teszt

Statusz: NEM_KEZDODOTT

Cel:

- TestFlight in-app vasarlas, webhook jovairas, kredit novelese igazolva.

## FEJEZET 5 - Final go-live zaras

Statusz: NEM_KEZDODOTT

Cel:

- Android + Apple fizetes production ready statusz dokumentalva.

Siker kriterium:

1. Mindket platformon megerositett E2E purchase.
2. Hibaagak (cancel, duplicate, retry) legalabb alap szinten tesztelve.
3. Operacios runbook frissitve.

## Frissitesi szabaly

Minden fejezet vegen kotelezo frissiteni:

1. Aktiv fejezet
2. Statusz
3. Konkret kovetkezo akcio
4. Bizonyitek link(ek)

Igy ujrainditas utan azonnal folytathato lesz a projekt magyarazkodas nelkul.