"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import HomeCareRouteGuard from '@/app/components/HomeCareRouteGuard';

const ALLOWED_HOMECARE_EMAILS = new Set(['epresla@icloud.com']);

const ROLE_OPTIONS = [
  {
    key: 'agency',
    title: 'Szolgáltató szervezet',
    description: 'Otthonápolási szolgáltatás nyújtása intézményi háttérrel.',
  },
  {
    key: 'caregiver',
    title: 'Ápoló / gondozó szakember',
    description: 'Személyes ellátási szolgáltatás biztosítása.',
  },
  {
    key: 'client',
    title: 'Ellátást igénylő / hozzátartozó',
    description: 'Otthonápolási segítség igénylése.',
  },
];

function validateForm(role, form) {
  if (!role) return 'Válassz szerepkört.';
  if (!form.phone.trim()) return 'A telefonszám megadása kötelező.';
  if (!form.city.trim()) return 'A város megadása kötelező.';

  if (role === 'agency') {
    if (!form.companyName.trim()) return 'A szervezet neve kötelező.';
    if (!form.contactName.trim()) return 'A kapcsolattartó neve kötelező.';
    if (!form.serviceArea.trim()) return 'A szolgáltatási terület kötelező.';
  }

  if (role === 'caregiver') {
    if (!form.displayName.trim()) return 'A megjelenő név kötelező.';
    if (!form.qualification.trim()) return 'A végzettség megadása kötelező.';
    if (!form.experienceYears.trim()) return 'A tapasztalat megadása kötelező.';
  }

  if (role === 'client') {
    if (!form.clientName.trim()) return 'Az igénylő neve kötelező.';
    if (!form.careNeed.trim()) return 'Az ellátási igény rövid leírása kötelező.';
  }

  return '';
}

function OtthonapolasSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData } = useAuth();

  const roleFromQuery = searchParams.get('role');
  const editMode = searchParams.get('edit') === 'true';
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const isAllowed = ALLOWED_HOMECARE_EMAILS.has(userEmail);

  const [selectedRole, setSelectedRole] = useState(roleFromQuery || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    serviceArea: '',
    displayName: '',
    qualification: '',
    experienceYears: '',
    clientName: '',
    careNeed: '',
    city: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    if (!editMode && userData?.homeCareRole) {
      router.replace('/otthonapolas');
      return;
    }

    if (userData && editMode) {
      setSelectedRole(userData.homeCareRole || roleFromQuery || '');
      setForm({
        companyName: userData.homeCareCompanyName || '',
        contactName: userData.homeCareContactName || '',
        serviceArea: userData.homeCareServiceArea || '',
        displayName: userData.homeCareDisplayName || userData.displayName || '',
        qualification: userData.homeCareQualification || '',
        experienceYears: String(userData.homeCareExperienceYears || ''),
        clientName: userData.homeCareClientName || '',
        careNeed: userData.homeCareCareNeed || '',
        city: userData.homeCareCity || '',
        phone: userData.homeCarePhone || userData.phone || '',
        notes: userData.homeCareNotes || '',
      });
    }
  }, [editMode, roleFromQuery, router, userData]);

  const selectedRoleMeta = useMemo(
    () => ROLE_OPTIONS.find((item) => item.key === selectedRole),
    [selectedRole]
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!isAllowed) {
      setError('Ehhez a modulhoz jelenleg nincs jogosultságod.');
      return;
    }

    const validationError = validateForm(selectedRole, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user?.uid) {
      setError('Nem található bejelentkezett felhasználó.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        homeCareRole: selectedRole,
        homeCareProfileComplete: true,
        homeCareCompanyName: form.companyName.trim(),
        homeCareContactName: form.contactName.trim(),
        homeCareServiceArea: form.serviceArea.trim(),
        homeCareDisplayName: form.displayName.trim(),
        homeCareQualification: form.qualification.trim(),
        homeCareExperienceYears: form.experienceYears ? Number(form.experienceYears) : null,
        homeCareClientName: form.clientName.trim(),
        homeCareCareNeed: form.careNeed.trim(),
        homeCareCity: form.city.trim(),
        homeCarePhone: form.phone.trim(),
        homeCareNotes: form.notes.trim(),
        homeCareUpdatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'users', user.uid), payload);
      router.push('/otthonapolas');
    } catch (submitError) {
      setError('Hiba történt a mentés során. Próbáld újra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <HomeCareRouteGuard>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 px-4 py-8 pb-28">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm sm:p-8">
          <button
            onClick={() => router.push('/otthonapolas')}
            className="mb-4 text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            ← Vissza az otthonápolási felületre
          </button>

          <h1 className="text-2xl font-bold text-slate-900">
            {editMode ? 'Otthonápolási profil szerkesztése' : 'Otthonápolási profil beállítása'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">A Pharmagistertől külön modul, saját adatlappal.</p>

          {!isAllowed && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Ez az oldal egyelőre zárt teszt alatt van. Csak a kijelölt fiók használhatja.
            </div>
          )}

          {!editMode && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedRole(option.key)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedRole === option.key
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <h3 className="text-sm font-semibold text-slate-900">{option.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">{option.description}</p>
                </button>
              ))}
            </div>
          )}

          {selectedRoleMeta && (
            <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
              Kiválasztott szerepkör: <strong>{selectedRoleMeta.title}</strong>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {selectedRole === 'agency' && (
              <>
                <Input label="Szervezet neve *" value={form.companyName} onChange={(value) => updateField('companyName', value)} />
                <Input label="Kapcsolattartó neve *" value={form.contactName} onChange={(value) => updateField('contactName', value)} />
                <Input label="Szolgáltatási terület *" value={form.serviceArea} onChange={(value) => updateField('serviceArea', value)} placeholder="pl. Budapest XI-XII. kerület" />
              </>
            )}

            {selectedRole === 'caregiver' && (
              <>
                <Input label="Megjelenő név *" value={form.displayName} onChange={(value) => updateField('displayName', value)} />
                <Input label="Végzettség *" value={form.qualification} onChange={(value) => updateField('qualification', value)} placeholder="pl. OKJ ápoló, diplomás ápoló" />
                <Input label="Tapasztalat (év) *" type="number" value={form.experienceYears} onChange={(value) => updateField('experienceYears', value)} />
              </>
            )}

            {selectedRole === 'client' && (
              <>
                <Input label="Igénylő neve *" value={form.clientName} onChange={(value) => updateField('clientName', value)} />
                <TextArea label="Ellátási igény rövid leírása *" value={form.careNeed} onChange={(value) => updateField('careNeed', value)} />
              </>
            )}

            <Input label="Város *" value={form.city} onChange={(value) => updateField('city', value)} />
            <Input label="Telefonszám *" value={form.phone} onChange={(value) => updateField('phone', value)} />
            <TextArea label="Megjegyzés" value={form.notes} onChange={(value) => updateField('notes', value)} />

            <button
              type="submit"
              disabled={loading || !isAllowed}
              className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? 'Mentés...' : 'Profil mentése'}
            </button>
          </form>
        </div>
      </div>
    </HomeCareRouteGuard>
  );
}

export default function OtthonapolasSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      }
    >
      <OtthonapolasSetupContent />
    </Suspense>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
