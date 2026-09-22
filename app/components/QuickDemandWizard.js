"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { collection, addDoc, doc, setDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getClientMarket } from '@/lib/marketI18n';
import { getDemandCreditBalance } from '@/lib/demandCredits';
import { CheckCircle2, Loader2 } from 'lucide-react';

const TOTAL_STEPS = 4;

function getTomorrowValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
}

const INITIAL_FORM_DATA = {
  position: '',
  workHours: '',
  minExperience: '',
  requiredSoftware: [],
  otherSoftware: '',
  maxHourlyRate: '',
  additionalRequirements: '',
};

export default function QuickDemandWizard() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const market = getClientMarket();
  const locale = market === 'de' ? 'de-DE' : 'hu-HU';
  const tomorrowValue = getTomorrowValue();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [date, setDate] = useState(tomorrowValue);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const creditBalance = getDemandCreditBalance(userData || {});
  const profileComplete = Boolean(userData?.pharmaProfileComplete);
  const otherSoftwareLabel = market === 'de' ? 'Sonstige' : 'Egyéb';

  const positionOptions = [
    { value: 'pharmacist', label: market === 'de' ? 'Apotheker/in' : 'Gyógyszerész', icon: '💊' },
    { value: 'assistant', label: market === 'de' ? 'PTA' : 'Szakasszisztens', icon: '📋' },
    ...(market === 'de' ? [{ value: 'pka', label: 'PKA', icon: '🧑‍⚕️' }] : []),
  ];

  const shiftPresets = ['8:00-16:00', '12:00-20:00', market === 'de' ? 'Ganzer Tag' : 'Egész nap'];

  const experienceOptions = [
    { value: '', label: market === 'de' ? 'Nincs' : 'Nincs követelmény' },
    { value: '0-1', label: market === 'de' ? '0-1 Jahr' : '0-1 év' },
    { value: '1-3', label: market === 'de' ? '1-3 Jahre' : '1-3 év' },
    { value: '3-5', label: market === 'de' ? '3-5 Jahre' : '3-5 év' },
    { value: '5-10', label: market === 'de' ? '5-10 Jahre' : '5-10 év' },
    { value: '10+', label: market === 'de' ? '10+ Jahre' : '10+ év' },
  ];

  const softwareOptions = ['Lx-Line', 'Novodata', 'Quadro Byte', 'Daxa', 'Primula', otherSoftwareLabel];

  const cardClass = `rounded-3xl border-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} p-6 sm:p-8 shadow-sm`;
  const pillBase = 'rounded-2xl border-2 px-5 py-3 text-base sm:text-lg font-bold transition-colors';
  const pillActive = 'border-[#6B46C1] bg-[#6B46C1] text-white';
  const pillInactive = darkMode
    ? 'border-gray-600 bg-gray-900 text-white hover:border-[#6B46C1]'
    : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#6B46C1]';
  const inputClass = `w-full rounded-2xl border-2 px-5 py-4 text-lg font-semibold ${
    darkMode ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-[#E5E7EB] text-[#111827] placeholder-[#9CA3AF]'
  } focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1]`;

  const toggleSoftware = (software) => {
    setFormData((prev) => ({
      ...prev,
      requiredSoftware: prev.requiredSoftware.includes(software)
        ? prev.requiredSoftware.filter((s) => s !== software)
        : [...prev.requiredSoftware, software],
    }));
  };

  const canContinue = () => {
    if (step === 1) return Boolean(formData.position);
    if (step === 2) return Boolean(date);
    if (step === 3) {
      if (formData.requiredSoftware.includes(otherSoftwareLabel)) {
        return Boolean(formData.otherSoftware.trim());
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!canContinue() || step >= TOTAL_STEPS) return;
    setStep((prev) => prev + 1);
  };

  const goBack = () => {
    if (step === 1) {
      router.push('/pharmagister?tab=dashboard');
      return;
    }
    setStep((prev) => prev - 1);
  };

  const resetWizard = () => {
    setFormData(INITIAL_FORM_DATA);
    setDate(tomorrowValue);
    setStep(1);
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!user || !userData) return;

    if (!profileComplete) {
      alert(market === 'de' ? 'Bitte fuelle zuerst dein Profil aus!' : 'Kérlek először töltsd ki a profilodat!');
      return;
    }

    if (creditBalance.decreaseActive && creditBalance.remainingCredits <= 0) {
      alert(
        market === 'de'
          ? 'Keine verbleibenden Anfrage-Credits. Bitte frage ein neues Paket an.'
          : 'Nincs elérhető igényfeladási kereted. Igényelj új csomagot.'
      );
      return;
    }

    let safeDate = date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chosenDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(chosenDate.getTime()) || chosenDate <= today) {
      safeDate = tomorrowValue;
      setDate(tomorrowValue);
    }

    setLoading(true);
    try {
      const fullAddress = `${userData.pharmacyZipCode || ''} ${userData.pharmacyCity || ''}, ${userData.pharmacyStreet || ''} ${userData.pharmacyHouseNumber || ''}`.trim();
      const positionLabel = positionOptions.find((p) => p.value === formData.position)?.label || '';

      const demandData = {
        pharmacyId: user.uid,
        market,
        pharmacyName: userData.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár'),
        pharmacyCity: userData.pharmacyCity || '',
        pharmacyZipCode: userData.pharmacyZipCode || '',
        pharmacyStreet: userData.pharmacyStreet || '',
        pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
        pharmacyFullAddress: fullAddress,
        pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
        date: safeDate,
        position: formData.position,
        workHours: formData.workHours,
        minExperience: formData.minExperience,
        requiredSoftware: formData.requiredSoftware,
        otherSoftware: formData.otherSoftware || '',
        maxHourlyRate: formData.maxHourlyRate ? parseInt(formData.maxHourlyRate, 10) : null,
        additionalRequirements: formData.additionalRequirements,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
      };

      const demandRef = await addDoc(collection(db, 'pharmaDemands'), demandData);

      try {
        await setDoc(doc(db, 'firestoreStats', 'demands'), { totalEverCreated: increment(1) }, { merge: true });
      } catch (statsError) {
        console.log('Stats update failed (non-critical):', statsError);
      }

      await addDoc(collection(db, 'serviceFeedPosts'), {
        postType: 'pharmaDemand',
        module: 'pharmagister',
        market,
        pharmaDemandId: demandRef.id,
        pharmacyId: user.uid,
        pharmacyName: userData.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár'),
        pharmacyCity: userData.pharmacyCity || '',
        pharmacyZipCode: userData.pharmacyZipCode || '',
        pharmacyStreet: userData.pharmacyStreet || '',
        pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
        pharmacyFullAddress: fullAddress,
        pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
        position: formData.position,
        positionLabel,
        workHours: formData.workHours,
        minExperience: formData.minExperience,
        requiredSoftware: formData.requiredSoftware,
        otherSoftware: formData.otherSoftware || '',
        maxHourlyRate: formData.maxHourlyRate ? parseInt(formData.maxHourlyRate, 10) : null,
        additionalRequirements: formData.additionalRequirements,
        date: safeDate,
        createdAt: new Date(),
        userId: user.uid,
      });

      try {
        const idToken = await user.getIdToken();
        await fetch('/api/notify-new-demand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            demandId: demandRef.id,
            pharmacyZipCode: userData.pharmacyZipCode || '',
            position: formData.position,
            pharmacyName: userData.pharmacyName || (market === 'de' ? 'Apotheke' : 'Gyógyszertár'),
            date: safeDate,
          }),
        });
      } catch (notifyError) {
        console.log('Push notification failed (non-critical):', notifyError);
      }

      setSuccess(true);
    } catch (error) {
      console.error('Error creating demand:', error);
      alert(market === 'de' ? 'Fehler beim Erstellen der Anfrage.' : 'Hiba történt az igény feladása során.');
    } finally {
      setLoading(false);
    }
  };

  const datePreview = (() => {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  if (success) {
    return (
      <div className={`${cardClass} text-center`}>
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className={`text-2xl sm:text-3xl font-extrabold mb-2 ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
          {market === 'de' ? 'Anfrage erfolgreich erstellt!' : 'Sikeresen feladtad az igényt!'}
        </h2>
        <p className={`mb-7 text-base ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
          {market === 'de' ? 'Wir benachrichtigen die passenden Vertretungen.' : 'Értesítjük a megfelelő helyettesítőket.'}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push('/pharmagister?tab=calendar')}
            className="w-full rounded-2xl bg-[#6B46C1] px-6 py-4 text-lg font-bold text-white hover:bg-[#5a3aa3] transition-colors"
          >
            {market === 'de' ? 'Kalender ansehen' : 'Naptár megtekintése'}
          </button>
          <button
            type="button"
            onClick={resetWizard}
            className={`w-full rounded-2xl border-2 px-6 py-4 text-lg font-bold transition-colors ${
              darkMode ? 'border-gray-600 text-white hover:bg-gray-700' : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F3F4F6]'
            }`}
          >
            {market === 'de' ? 'Neue Anfrage erstellen' : 'Új igény feladása'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/pharmagister?tab=dashboard')}
            className={`text-sm font-semibold underline ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}
          >
            {market === 'de' ? 'Zum Dashboard' : 'Ugrás a vezérlőpultra'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-3xl sm:text-4xl font-extrabold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
          {market === 'de' ? 'Vertretung suchen' : 'Helyettes keresése'}
        </h1>
        <p className={`mt-1 text-base ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
          {market === 'de' ? 'In wenigen Schritten eine neue Anfrage erstellen.' : 'Néhány lépésben add fel az új igényt.'}
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className={`text-sm font-bold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
            {market === 'de' ? `Schritt ${step} von ${TOTAL_STEPS}` : `${step}. lépés / ${TOTAL_STEPS}`}
          </span>
          <span className="text-sm font-bold text-[#6B46C1]">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-[#E5E7EB]'}`}>
          <div
            className="h-full rounded-full bg-[#6B46C1] transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
        <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-[#4B5563]'}`}>
          {market === 'de' ? 'Anfrage-Credits' : 'Igényfeladási keret'}
        </span>
        <span className="text-sm font-bold text-[#6B46C1]">
          {creditBalance.remainingCredits} / {creditBalance.totalCredits}
        </span>
      </div>

      {!profileComplete && (
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800">
            ⚠️ {market === 'de' ? 'Bitte vervollstaendige zuerst dein Profil.' : 'Kérlek először töltsd ki a profilodat.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/pharmagister/setup?role=pharmacy&edit=true')}
            className="mt-2 text-sm font-bold text-orange-900 underline"
          >
            {market === 'de' ? 'Profil ausfuellen' : 'Profil kitöltése'}
          </button>
        </div>
      )}

      <div className={cardClass}>
        {step === 1 && (
          <div className="space-y-5">
            <h2 className={`text-2xl sm:text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Wen suchst du?' : 'Kit keresel?'}
            </h2>
            <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
              {market === 'de' ? 'Waehle die passende Position aus.' : 'Válaszd ki, milyen szakembert keresel a helyettesítéshez.'}
            </p>
            <div className="grid grid-cols-1 gap-3">
              {positionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, position: option.value }));
                    setStep(2);
                  }}
                  className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-5 text-left transition-colors ${
                    formData.position === option.value ? pillActive : pillInactive
                  }`}
                >
                  <span className="text-3xl">{option.icon}</span>
                  <span className="text-xl font-bold">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className={`text-2xl sm:text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Wann brauchst du sie?' : 'Mikorra van szükséged rá?'}
            </h2>
            <div>
              <label className={`mb-2 block text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Datum' : 'Dátum'}
              </label>
              <input
                type="date"
                value={date}
                min={tomorrowValue}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <p className={`mb-3 text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Schicht' : 'Műszak'}
              </p>
              <div className="flex flex-wrap gap-3">
                {shiftPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, workHours: prev.workHours === preset ? '' : preset }))}
                    className={`${pillBase} ${formData.workHours === preset ? pillActive : pillInactive}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={`mb-2 block text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Eigene Zeit (optional)' : 'Egyedi időpont (opcionális)'}
              </label>
              <input
                type="text"
                value={formData.workHours}
                onChange={(e) => setFormData({ ...formData, workHours: e.target.value })}
                placeholder={market === 'de' ? 'z.B. 9:00-17:00' : 'pl. 9:00-17:00'}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className={`text-2xl sm:text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Welche Erfahrung erwartest du?' : 'Milyen tapasztalatot vársz?'}
            </h2>
            <div>
              <p className={`mb-3 text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Minimum Erfahrung (optional)' : 'Minimum tapasztalat (opcionális)'}
              </p>
              <div className="flex flex-wrap gap-3">
                {experienceOptions.map((option) => (
                  <button
                    key={option.value || 'none'}
                    type="button"
                    onClick={() => setFormData({ ...formData, minExperience: option.value })}
                    className={`${pillBase} ${formData.minExperience === option.value ? pillActive : pillInactive}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`mb-3 text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Softwarekenntnisse (optional)' : 'Szoftverismeret (opcionális)'}
              </p>
              <div className="flex flex-wrap gap-3">
                {softwareOptions.map((software) => (
                  <button
                    key={software}
                    type="button"
                    onClick={() => toggleSoftware(software)}
                    className={`${pillBase} ${formData.requiredSoftware.includes(software) ? pillActive : pillInactive}`}
                  >
                    {software}
                  </button>
                ))}
              </div>
              {formData.requiredSoftware.includes(otherSoftwareLabel) && (
                <input
                  type="text"
                  value={formData.otherSoftware}
                  onChange={(e) => setFormData({ ...formData, otherSoftware: e.target.value })}
                  placeholder={market === 'de' ? 'Name eingeben' : 'Név megadása'}
                  className={`${inputClass} mt-3`}
                />
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className={`text-2xl sm:text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              {market === 'de' ? 'Letzter Schritt' : 'Utolsó lépés'}
            </h2>
            <div>
              <label className={`mb-2 block text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Maximaler Stundenlohn (optional)' : 'Maximum órabér (opcionális)'}
              </label>
              <input
                type="number"
                min="0"
                value={formData.maxHourlyRate}
                onChange={(e) => setFormData({ ...formData, maxHourlyRate: e.target.value })}
                placeholder={market === 'de' ? 'z.B. 5000' : 'pl. 5000'}
                className={inputClass}
              />
            </div>
            <div>
              <label className={`mb-2 block text-base font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Weitere Anforderungen (optional)' : 'További megjegyzés (opcionális)'}
              </label>
              <textarea
                rows={3}
                value={formData.additionalRequirements}
                onChange={(e) => setFormData({ ...formData, additionalRequirements: e.target.value })}
                placeholder={market === 'de' ? 'Weitere Erwartungen...' : 'Egyéb elvárások...'}
                className={inputClass}
              />
            </div>
            <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
              <p className={`mb-2 text-lg font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                {market === 'de' ? 'Zusammenfassung' : 'Összegzés'}
              </p>
              <ul className={`space-y-1 text-base ${darkMode ? 'text-gray-300' : 'text-[#4B5563]'}`}>
                <li>
                  <strong>{market === 'de' ? 'Position' : 'Pozíció'}:</strong>{' '}
                  {positionOptions.find((p) => p.value === formData.position)?.label}
                </li>
                <li>
                  <strong>{market === 'de' ? 'Datum' : 'Dátum'}:</strong> {datePreview}
                </li>
                <li>
                  <strong>{market === 'de' ? 'Schicht' : 'Műszak'}:</strong>{' '}
                  {formData.workHours || (market === 'de' ? 'Nicht angegeben' : 'Nincs megadva')}
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={goBack}
            className={`flex-1 rounded-2xl border-2 px-5 py-4 text-lg font-bold transition-colors ${
              darkMode ? 'border-gray-600 text-white hover:bg-gray-700' : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F3F4F6]'
            }`}
          >
            {step === 1 ? (market === 'de' ? 'Abbrechen' : 'Mégse') : market === 'de' ? 'Zurueck' : 'Vissza'}
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue()}
              className="flex-1 rounded-2xl bg-[#6B46C1] px-5 py-4 text-lg font-bold text-white transition-colors hover:bg-[#5a3aa3] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {market === 'de' ? 'Weiter' : 'Tovább'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#6B46C1] px-5 py-4 text-lg font-bold text-white transition-colors hover:bg-[#5a3aa3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {market === 'de' ? 'Anfrage absenden' : 'Igény feladása'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
