"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function PartnerDashboardPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  const [stats, setStats] = useState({ all: 0, approved: 0, pending: 0, sold: 0 });
  const [campaignStats, setCampaignStats] = useState({ all: 0, active: 0, pending: 0, closed: 0, rejected: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const partnerType = useMemo(() => {
    const accountType = userData?.accountType;
    if (accountType === "partner_marketplace" || accountType === "partner_advertiser" || userData?.partnerAdvertiser) {
      return "marketplace";
    }
    if (accountType === "partner_professional" || userData?.partnerProfessional) {
      return "professional";
    }
    return null;
  }, [userData]);

  const isPartner = useMemo(
    () => Boolean(partnerType),
    [partnerType]
  );

  useEffect(() => {
    if (!user?.uid || !isPartner) {
      setStatsLoading(false);
      return;
    }

    const loadStats = async () => {
      setStatsLoading(true);
      try {
        if (partnerType === "marketplace") {
          const snap = await getDocs(
            query(collection(db, "equipmentMarketplacePosts"), where("sellerId", "==", user.uid))
          );

          const rows = snap.docs
            .map((d) => d.data())
            .filter((x) => ["partner_advertiser", "partner_marketplace"].includes(String(x.sellerType || "")));

          setStats({
            all: rows.length,
            approved: rows.filter((x) => x.status === "approved").length,
            pending: rows.filter((x) => x.status === "pending").length,
            sold: rows.filter((x) => x.status === "sold").length,
          });
        } else {
          const snap = await getDocs(
            query(collection(db, "partnerProfessionalCampaigns"), where("ownerId", "==", user.uid))
          );

          const rows = snap.docs.map((d) => d.data());
          setCampaignStats({
            all: rows.length,
            active: rows.filter((x) => x.status === "active").length,
            pending: rows.filter((x) => x.status === "pending").length,
            closed: rows.filter((x) => x.status === "closed").length,
            rejected: rows.filter((x) => x.status === "rejected").length,
          });
        }
      } catch (e) {
        console.error("Partner stats load error:", e);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [user?.uid, isPartner, partnerType]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-700" />
      </div>
    );
  }

  return (
    <RouteGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-6 pb-32">
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-100">Pharmagister</p>
            <h1 className="mt-2 text-3xl font-bold">
              {partnerType === "professional" ? "Szakmai partner központ" : "Partner hirdetői központ"}
            </h1>
            <p className="mt-2 text-emerald-50">
              {partnerType === "professional"
                ? "Saját felület promóciókhoz, gyártói kampányokhoz és szakmai aktivitásokhoz."
                : "Saját partner felület hirdetések feladásához és kezeléséhez."}
            </p>
          </div>

          {!isPartner ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="font-semibold">Ehhez a felülethez partner regisztráció szükséges.</p>
              <p className="mt-1 text-sm">Regisztrálj partner hirdetőként, majd jelentkezz be újra.</p>
              <button
                type="button"
                onClick={() => router.push("/register/partner")}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Partner regisztráció
              </button>
            </div>
          ) : (
            <>
              {partnerType === "marketplace" ? (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatCard label="Összes" value={statsLoading ? "..." : String(stats.all)} />
                    <StatCard label="Aktív" value={statsLoading ? "..." : String(stats.approved)} />
                    <StatCard label="Függőben" value={statsLoading ? "..." : String(stats.pending)} />
                    <StatCard label="Eladva" value={statsLoading ? "..." : String(stats.sold)} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <ActionCard
                      title="Új hirdetés feladása"
                      text="Termék vagy szolgáltatás rögzítése a piactérre."
                      button="Hirdetés feladása"
                      onClick={() => router.push("/partner/hirdetes-feladas")}
                    />
                    <ActionCard
                      title="Saját hirdetések kezelése"
                      text="Szerkesztés, státuszváltás, törlés egy helyen."
                      button="Hirdetések kezelése"
                      onClick={() => router.push("/partner/hirdeteseim")}
                    />
                    <ActionCard
                      title="Megjelenés a piactéren"
                      text="Nézd meg, hogyan látszanak a hirdetések a Pharmagister piactéren."
                      button="Piactér megnyitása"
                      onClick={() => router.push("/pharmagister/eszkozpiacter")}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <StatCard label="Összes kampány" value={statsLoading ? "..." : String(campaignStats.all)} />
                    <StatCard label="Aktív" value={statsLoading ? "..." : String(campaignStats.active)} />
                    <StatCard label="Függő" value={statsLoading ? "..." : String(campaignStats.pending)} />
                    <StatCard label="Lezárt" value={statsLoading ? "..." : String(campaignStats.closed)} />
                    <StatCard label="Elutasított" value={statsLoading ? "..." : String(campaignStats.rejected)} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ActionCard
                      title="Új kampány feladása"
                      text="Promóció, gyártói kampány vagy edukációs megjelenés indítása."
                      button="Kampány feladása"
                      onClick={() => router.push("/partner/szakmai-kampany-feladas")}
                    />
                    <ActionCard
                      title="Saját kampányok kezelése"
                      text="Kampány státuszok, szerkesztés és lezárás."
                      button="Kampányaim"
                      onClick={() => router.push("/partner/szakmai-kampanyaim")}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ActionCard({ title, text, button, onClick }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {button}
      </button>
    </div>
  );
}
