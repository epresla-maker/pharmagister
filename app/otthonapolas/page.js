"use client";

import { useRouter } from 'next/navigation';
import { Home, HeartHandshake, Building2, User, Users, ArrowLeft } from 'lucide-react';
import HomeCareRouteGuard from '@/app/components/HomeCareRouteGuard';
import { useAuth } from '@/context/AuthContext';
import { HOME_CARE_ROLE_LABELS, HOME_CARE_ROLE_OPTIONS, canAccessHomeCare } from '@/lib/homeCare';

const ROLE_CARD_META = {
  client: {
    icon: <Users className="h-5 w-5 text-sky-700" />,
    colorClass: 'bg-sky-100',
  },
  caregiver: {
    icon: <User className="h-5 w-5 text-emerald-700" />,
    colorClass: 'bg-emerald-100',
  },
  agency: {
    icon: <Building2 className="h-5 w-5 text-teal-700" />,
    colorClass: 'bg-teal-100',
  },
};

const DASHBOARD_CONTENT = {
  client: {
    title: 'Ellátási igények',
    summary: 'Igényfeladás, ajánlatok és kapcsolatfelvétel egy külön otthonápolási térben.',
    actions: [
      { title: 'Új ellátási igény', description: 'Város, gyakoriság, napszak és rövid ellátási leírás.', status: 'Következő' },
      { title: 'Igényeim', description: 'Aktív, lezárt és piszkozat állapotú otthonápolási igények.', status: 'Tervezve' },
      { title: 'Jelentkezők', description: 'Szakemberek és szolgáltatók ajánlatai egy helyen.', status: 'Tervezve' },
    ],
  },
  caregiver: {
    title: 'Szakember munkafelület',
    summary: 'Elérhető igények, jelentkezések és szakmai profil kezelése.',
    actions: [
      { title: 'Elérhető igények', description: 'Szűrés város, időszak és ellátási típus szerint.', status: 'Következő' },
      { title: 'Jelentkezéseim', description: 'Folyamatban lévő és lezárt megkeresések követése.', status: 'Tervezve' },
      { title: 'Elérhetőség', description: 'Szolgáltatási terület, időablakok és profiladatok.', status: 'Profilból' },
    ],
  },
  agency: {
    title: 'Szolgáltatói munkafelület',
    summary: 'Céges profil, munkatársak és beérkező otthonápolási igények kezelése.',
    actions: [
      { title: 'Beérkező igények', description: 'Területi és szolgáltatási szűrés intézményi válaszadáshoz.', status: 'Következő' },
      { title: 'Munkatársak', description: 'Ápolók, gondozók és kapacitások kezelése.', status: 'Tervezve' },
      { title: 'Cégprofil', description: 'Szolgáltatási területek és kapcsolattartási adatok.', status: 'Profilból' },
    ],
  },
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

function DashboardAction({ title, description, status }) {
  return (
    <button
      type="button"
      disabled
      className="min-h-[132px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm disabled:cursor-not-allowed disabled:opacity-80"
    >
      <div className="flex h-full flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              {status}
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
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
  const isAllowed = canAccessHomeCare(user);
  const dashboard = role ? DASHBOARD_CONTENT[role] : null;

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
                <p className="mb-2 text-sm font-medium text-slate-700">Válassz belépési irányt:</p>
                {HOME_CARE_ROLE_OPTIONS.map((option) => {
                  const meta = ROLE_CARD_META[option.key];
                  return (
                    <RoleCard
                      key={option.key}
                      icon={meta.icon}
                      title={option.title}
                      description={option.description}
                      colorClass={meta.colorClass}
                      onClick={() => router.push(`/otthonapolas/setup?role=${option.key}`)}
                    />
                  );
                })}
              </div>
            )}

            {isAllowed && role && dashboard && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                      {HOME_CARE_ROLE_LABELS[role] || role}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                      Zárt béta
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                      {profileComplete ? 'Profil kész' : 'Profil hiányos'}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-slate-900">{dashboard.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{dashboard.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {dashboard.actions.map((action) => (
                    <DashboardAction key={action.title} {...action} />
                  ))}
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
