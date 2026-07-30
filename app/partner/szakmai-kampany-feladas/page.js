"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

const CAMPAIGN_TYPES = [
  { id: "promotion", label: "Promóció" },
  { id: "manufacturer_campaign", label: "Gyártói kampány" },
  { id: "education", label: "Edukációs kampány" },
  { id: "other", label: "Egyéb" },
];

export default function ProfessionalCampaignComposerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading } = useAuth();

  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [campaignType, setCampaignType] = useState("promotion");
  const [targetAudience, setTargetAudience] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState("");

  const isProfessionalPartner = useMemo(
    () => Boolean(userData?.partnerProfessional || userData?.accountType === "partner_professional"),
    [userData]
  );

  useEffect(() => {
    if (!isEditMode || !editId || !user?.uid) return;

    const loadExisting = async () => {
      setLoadingDraft(true);
      try {
        const snap = await getDoc(doc(db, "partnerProfessionalCampaigns", editId));
        if (!snap.exists()) return;

        const row = snap.data();
        if (row.ownerId !== user.uid) return;

        setTitle(row.title || "");
        setDescription(row.description || "");
        setCampaignType(row.campaignType || "promotion");
        setTargetAudience(row.targetAudience || "");
        setBudget(row.budget != null ? String(row.budget) : "");
        setStartDate(row.startDate || "");
        setEndDate(row.endDate || "");
        setLandingUrl(row.landingUrl || "");
      } catch (e) {
        console.error("Campaign load error:", e);
      } finally {
        setLoadingDraft(false);
      }
    };

    loadExisting();
  }, [isEditMode, editId, user?.uid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isProfessionalPartner) {
      setError("Ehhez szakmai partner fiók szükséges.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("A cím és leírás kötelező.");
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError("A kezdődátum nem lehet későbbi a záródátumnál.");
      return;
    }

    const parsedBudget = Number(String(budget).replace(/\s+/g, "").replace(",", "."));
    const normalizedBudget = Number.isFinite(parsedBudget) ? Math.max(0, Math.round(parsedBudget)) : null;

    const ownerName =
      userData?.partnerProfile?.companyName || userData?.displayName || userData?.email || "Szakmai partner";

    const payload = {
      ownerId: user.uid,
      ownerName,
      ownerEmail: userData?.email || user?.email || null,
      campaignType,
      title: title.trim(),
      description: description.trim(),
      targetAudience: targetAudience.trim() || null,
      budget: normalizedBudget,
      startDate: startDate || null,
      endDate: endDate || null,
      landingUrl: landingUrl.trim() || null,
      status: "pending",
      market: userData?.market || "hu",
      updatedAt: serverTimestamp(),
    };

    setSubmitting(true);
    try {
      if (isEditMode && editId) {
        await updateDoc(doc(db, "partnerProfessionalCampaigns", editId), payload);
      } else {
        await addDoc(collection(db, "partnerProfessionalCampaigns"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      router.push("/partner/szakmai-kampanyaim");
    } catch (e) {
      console.error("Campaign submit error:", e);
      setError("Nem sikerült menteni a kampányt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditMode ? "Szakmai kampány szerkesztése" : "Szakmai kampány feladása"}
            </h1>
            <button
              type="button"
              onClick={() => router.push("/partner")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Vissza
            </button>
          </div>

          {loading || loadingDraft ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">Betöltés...</div>
          ) : !isProfessionalPartner ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              Ehhez szakmai partner fiók szükséges.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kampány címe</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kampány típusa</label>
                <select
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Leírás</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Célcsoport (opcionális)</label>
                  <input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Pl. patikavezetők"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kampány büdzsé (Ft, opcionális)</label>
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    type="number"
                    min="0"
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kezdés (opcionális)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Zárás (opcionális)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Landing URL (opcionális)</label>
                <input
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                  type="url"
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? "Mentés..." : isEditMode ? "Kampány frissítése" : "Kampány beküldése"}
              </button>

              <p className="text-xs text-slate-500">
                A kampány a fő hírfolyamban csak admin jóváhagyás után jelenik meg.
              </p>
            </form>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
