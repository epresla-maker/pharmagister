"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getClientMarket } from "@/lib/marketI18n";
import { MARKET_COOKIE, normalizeMarket } from "@/lib/market";

function createVerificationToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PartnerRegisterPage() {
  const router = useRouter();
  const detectedMarket = normalizeMarket(getClientMarket());

  const [selectedMarket, setSelectedMarket] = useState("");
  const market = selectedMarket ? normalizeMarket(selectedMarket) : detectedMarket;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [partnerType, setPartnerType] = useState("marketplace");
  const [campaignFocus, setCampaignFocus] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleMarketSelect = (nextMarket) => {
    const normalized = normalizeMarket(nextMarket);
    setSelectedMarket(normalized);
    document.cookie = `${MARKET_COOKIE}=${normalized}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedMarket) {
      setError(market === "de" ? "Waehle bitte die Sprache aus." : "Válassz nyelvet a regisztrációhoz.");
      return;
    }

    if (!acceptedPrivacy) {
      setError(market === "de" ? "Bitte akzeptiere die Datenschutzerklaerung." : "Az adatvédelmi tájékoztató elfogadása kötelező.");
      return;
    }

    if (password !== confirmPassword) {
      setError(market === "de" ? "Die Passwoerter stimmen nicht ueberein." : "A jelszavak nem egyeznek.");
      return;
    }

    if (password.length < 8) {
      setError(market === "de" ? "Das Passwort muss mindestens 8 Zeichen lang sein." : "A jelszónak legalább 8 karakterből kell állnia.");
      return;
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(market === "de" ? "Das Passwort muss mindestens einen Grossbuchstaben und eine Zahl enthalten." : "A jelszónak tartalmaznia kell legalább egy nagybetűt és egy számot.");
      return;
    }

    const registrationMarket = normalizeMarket(selectedMarket);
    setLoading(true);

    try {
      document.cookie = `${MARKET_COOKIE}=${registrationMarket}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const verificationToken = createVerificationToken();
      const nowIso = new Date().toISOString();

      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: userCredential.user.email,
        market: registrationMarket,
        createdAt: nowIso,
        emailVerified: false,
        privacyAcceptedAt: nowIso,
        verificationToken,
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),

        accountType: partnerType === "marketplace" ? "partner_marketplace" : "partner_professional",
        partnerAdvertiser: partnerType === "marketplace",
        partnerProfessional: partnerType === "professional",
        partnerProfileComplete: true,
        pharmagisterRole: null,
        pharmaProfileComplete: false,

        partnerProfile: {
          type: partnerType,
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          taxNumber: taxNumber.trim() || null,
          website: website.trim() || null,
          campaignFocus: partnerType === "professional" ? campaignFocus.trim() || null : null,
          status: "active",
          createdAt: nowIso,
        },
      });

      await fetch("/api/send-verification-email-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userCredential.user.email,
          market: registrationMarket,
          verificationToken,
        }),
      });

      await signOut(auth);
      setSuccess(true);
    } catch (err) {
      if (err?.code === "auth/email-already-in-use") {
        setError(market === "de" ? "Diese E-Mail-Adresse wird bereits verwendet." : "Ez az e-mail cím már használatban van.");
      } else {
        setError(market === "de" ? "Hiba a partner regisztráció során." : "Hiba történt a partner regisztráció során.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-emerald-50">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/auth-background.png')" }} />
      <div className="absolute inset-0 bg-white/10" />

      <div className="relative min-h-[100dvh] overflow-y-auto px-4 py-8">
        <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center">
          <div className="w-full max-w-lg rounded-lg border border-white/70 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 backdrop-blur-md sm:p-8">
            <h1 className="mb-2 text-center text-3xl font-bold text-emerald-950">
              {market === "de" ? "Partner-Registrierung" : "Partner regisztráció"}
            </h1>
            <p className="mb-6 text-center text-emerald-800">Pharmagister Partner</p>

            {success ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="mb-3 font-semibold">
                  {market === "de" ? "Registrierung erfolgreich." : "Sikeres partner regisztráció."}
                </p>
                <p className="mb-4">
                  {market === "de"
                    ? "Wir haben eine Aktivierungs-E-Mail gesendet. Bitte bestaetige dein Konto und melde dich danach an."
                    : "Aktiváló e-mailt küldtünk. Erősítsd meg a fiókot, majd jelentkezz be."}
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
                >
                  {market === "de" ? "Zur Anmeldung" : "Tovább a bejelentkezéshez"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {market === "de" ? "Partnertyp" : "Partner típus"}
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPartnerType("marketplace")}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${
                        partnerType === "marketplace"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-gray-300 bg-white text-gray-700"
                      }`}
                    >
                      <p className="font-semibold">{market === "de" ? "An- und Verkauf" : "Adok-Veszek piactér"}</p>
                      <p className="mt-1 text-xs opacity-80">{market === "de" ? "Produktanzeigen auf dem Marktplatz" : "Termék hirdetések a piactéren"}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartnerType("professional")}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${
                        partnerType === "professional"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-gray-300 bg-white text-gray-700"
                      }`}
                    >
                      <p className="font-semibold">{market === "de" ? "Fachpartner" : "Szakmai partner"}</p>
                      <p className="mt-1 text-xs opacity-80">{market === "de" ? "Promotions und Herstellerkampagnen" : "Promóciók és gyártói kampányok"}</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {market === "de" ? "Sprache/Lokalisierung" : "Nyelv/lokalizáció"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleMarketSelect("hu")}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                        selectedMarket === "hu"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      HU
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarketSelect("de")}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                        selectedMarket === "de"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      DE
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">{market === "de" ? "Firmenname" : "Cégnév"}</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">{market === "de" ? "Kontaktperson" : "Kapcsolattartó neve"}</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">{market === "de" ? "Steuernummer (optional)" : "Adószám (opcionális)"}</label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Weboldal (opcionális)</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://"
                  />
                </div>

                {partnerType === "professional" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {market === "de" ? "Kampány fókusz (opcionális)" : "Kampány fókusz (opcionális)"}
                    </label>
                    <input
                      type="text"
                      value={campaignFocus}
                      onChange={(e) => setCampaignFocus(e.target.value)}
                      className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder={market === "de" ? "Pl. OTC Produkte, Saisonkampagnen" : "Pl. OTC termékek, szezonális kampányok"}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">{market === "de" ? "Passwort" : "Jelszó"}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">{market === "de" ? "Passwort bestaetigen" : "Jelszó megerősítése"}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    minLength={8}
                  />
                </div>

                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-700"
                  />
                  <span>
                    {market === "de" ? "Ich akzeptiere die" : "Elfogadom az"}{" "}
                    <a href="/privacy-policy" target="_blank" className="font-medium text-emerald-700 hover:underline">
                      {market === "de" ? "Datenschutzerklaerung" : "adatvédelmi tájékoztatót"}
                    </a>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !acceptedPrivacy}
                  className="w-full rounded-lg bg-emerald-700 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {loading
                    ? market === "de"
                      ? "Wird geladen..."
                      : "Betöltés..."
                    : market === "de"
                    ? partnerType === "marketplace"
                      ? "Marktplatz-Partner registrieren"
                      : "Fachpartner registrieren"
                    : partnerType === "marketplace"
                    ? "Piactér partner regisztráció"
                    : "Szakmai partner regisztráció"}
                </button>

                <div className="text-center text-sm">
                  <button type="button" onClick={() => router.push("/register")} className="text-emerald-700 hover:underline">
                    {market === "de" ? "Normale Registrierung" : "Normál regisztráció"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
