"use client";

import { useRouter } from 'next/navigation';
import { Home, HeartHandshake, Building2, User, Users, ArrowLeft } from 'lucide-react';
import HomeCareRouteGuard from '@/app/components/HomeCareRouteGuard';
import { useAuth } from '@/context/AuthContext';

const ALLOWED_HOMECARE_EMAILS = new Set(['epresla@icloud.com']);

const ROLE_LABELS = {
  agency: 'Szolgáltató szervezet',
  caregiver: 'Ápoló / gondozó szakember',
  client: 'Ellátást igénylő / hozzátartozó',
};

function RoleCard({ icon, title, description, onClick, colorClass }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className={`mt-1 flex h-11 w-11 items-center justify-center rounded-xl ${colorClass}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default function OtthonapolasPage() {
  const router = useRouter();
  const { user, userData } = useAuth();

  const role = userData?.homeCareRole || null;
  const profileComplete = Boolean(userData?.homeCareProfileComplete);
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const isAllowed = ALLOWED_HOMECARE_EMAILS.has(userEmail);

  return (
    <HomeCareRouteGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#dcfce7,transparent_35%),radial-gradient(circle_at_90%_20%,#ccfbf1,transparent_30%),#f8fafc] px-4 py-8 pb-28">
        <div className="mx-auto w-full max-w-3xl">
          <button
            onClick={() => router.push('/pharmagister')}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Vissza a Pharmagisterbe
          </button>

          <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-6 flex items-start gap-3">
              <div className="mt-1 rounded-xl bg-emerald-100 p-2 text-emerald-700">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Otthonápolási szolgáltatások</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Különálló felület az otthoni ápolási igények és szolgáltatások kezelésére.
                </p>
              </div>
            </div>

            {!isAllowed && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  Ez a modul jelenleg zárt teszt alatt áll. Egyelőre csak a kijelölt fiók számára érhető el.
                </p>
              </div>
            )}

            {isAllowed && !role && (
              <div className="space-y-3">
                <p className="mb-2 text-sm font-medium text-slate-700">Válassz szerepkört az induláshoz:</p>
                <RoleCard
                  icon={<Building2 className="h-5 w-5 text-teal-700" />}
                  title="Szolgáltató szervezet"
                  description="Cégként vagy intézményként kínálok otthonápolási szolgáltatást."
                  colorClass="bg-teal-100"
                  onClick={() => router.push('/otthonapolas/setup?role=agency')}
                />
                <RoleCard
                  icon={<User className="h-5 w-5 text-emerald-700" />}
                  title="Ápoló / gondozó szakember"
                  description="Magánszemélyként vállalok otthonápolási feladatokat."
                  colorClass="bg-emerald-100"
                  onClick={() => router.push('/otthonapolas/setup?role=caregiver')}
                />
                <RoleCard
                  icon={<Users className="h-5 w-5 text-sky-700" />}
                  title="Ellátást igénylő / hozzátartozó"
                  description="Saját vagy hozzátartozói ellátáshoz keresek segítséget."
                  colorClass="bg-sky-100"
                  onClick={() => router.push('/otthonapolas/setup?role=client')}
                />
              </div>
            )}

            {isAllowed && role && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-900">
                    Aktív szerepkör: <strong>{ROLE_LABELS[role] || role}</strong>
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Profil állapot: {profileComplete ? 'kész' : 'hiányos'}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => router.push('/otthonapolas/setup?edit=true')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <Home className="h-4 w-4" />
                    Profil szerkesztése
                  </button>
                  <button
                    onClick={() => router.push('/kozosseg')}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Vissza a közösséghez
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </HomeCareRouteGuard>
  );
}
