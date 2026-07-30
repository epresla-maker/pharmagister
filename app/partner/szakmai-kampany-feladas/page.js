"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

const CAMPAIGN_TYPES = [
  { id: "promotion", label: "Promóció", accent: "from-emerald-500 to-teal-500" },
  { id: "manufacturer_campaign", label: "Gyártói kampány", accent: "from-violet-500 to-fuchsia-500" },
  { id: "education", label: "Edukációs kampány", accent: "from-sky-500 to-cyan-500" },
  { id: "other", label: "Egyéb", accent: "from-amber-500 to-orange-500" },
];

const STORY_THEMES = [
  { id: "energetikus", label: "Energetikus", badge: "⚡" },
  { id: "elegáns", label: "Elegáns", badge: "✨" },
  { id: "oktató", label: "Oktató", badge: "🎓" },
  { id: "exkluzív", label: "Exkluzív", badge: "💎" },
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
  const [storyTheme, setStoryTheme] = useState("energetikus");
  const [targetAudience, setTargetAudience] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Tudj meg többet");
  const [submitting, setSubmitting] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState("");

  const isProfessionalPartner = useMemo(
    () => Boolean(userData?.partnerProfessional || userData?.accountType === "partner_professional"),
    [userData]
  );

  const selectedTheme = useMemo(() => CAMPAIGN_TYPES.find((item) => item.id === campaignType) || CAMPAIGN_TYPES[0], [campaignType]);

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
        setStoryTheme(row.storyTheme || "energetikus");
        setTargetAudience(row.targetAudience || "");
        setBudget(row.budget != null ? String(row.budget) : "");
        setStartDate(row.startDate || "");
        setEndDate(row.endDate || "");
        setLandingUrl(row.landingUrl || "");
        setCoverImageUrl(row.coverImageUrl || "");
        setCtaLabel(row.ctaLabel || "Tudj meg többet");
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
      setError("A cím és a fő üzenet kötelező.");
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
      storyTheme,
      title: title.trim(),
      description: description.trim(),
      ctaLabel: ctaLabel.trim() || "Tudj meg többet",
      coverImageUrl: coverImageUrl.trim() || null,
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(135deg,#f8fafc_0%,#eefbf5_100%)] px-4 py-6 pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Story creator</p>
              <h1 className="text-2xl font-bold text-slate-900">
                {isEditMode ? "Szakmai kampány szerkesztése" : "Új szakmai kampány varázsló"}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/partner")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Vissza a központba
            </button>
          </div>

          {loading || loadingDraft ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-slate-600 shadow-sm">Betöltés...</div>
          ) : !isProfessionalPartner ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
              Ehhez szakmai partner fiók szükséges.
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.28)] backdrop-blur">
                {error && <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Készíts egy igazán modern, story-szerű kampányt</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    A bal oldali mezők egyszerűen vezérlik a jobb oldali előnézetet — így gyorsan látod, hogyan fog kinézni a kampányod.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {CAMPAIGN_TYPES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCampaignType(item.id)}
                      className={`rounded-2xl border p-3 text-left transition ${campaignType === item.id ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                    >
                      <div className={`mb-2 h-2 rounded-full bg-gradient-to-r ${item.accent}`} />
                      <div className="font-semibold text-slate-800">{item.label}</div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Kampány címe</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                    placeholder="Pl. Téli tudásnap a patikákban"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Fő üzenet</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                    placeholder="Írd le röviden, miért fontos ez a kampány, miért érdemes megnyitni, és mi legyen az üzenet."
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Story stílus</label>
                  <div className="flex flex-wrap gap-2">
                    {STORY_THEMES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setStoryTheme(item.id)}
                        className={`rounded-full border px-3 py-2 text-sm font-medium transition ${storyTheme === item.id ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                      >
                        {item.badge} {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Célcsoport</label>
                    <input
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                      placeholder="Pl. patikavezetők"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Büdzsé (Ft)</label>
                    <input
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      type="number"
                      min="0"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                      placeholder="250000"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Kezdés</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Zárás</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Kép URL (opcionális)</label>
                    <input
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                      placeholder="https://...jpg"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">CTA szöveg</label>
                    <input
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                      placeholder="Tudj meg többet"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Landing URL</label>
                  <input
                    value={landingUrl}
                    onChange={(e) => setLandingUrl(e.target.value)}
                    type="url"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                    placeholder="https://"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submitting ? "Mentés..." : isEditMode ? "Kampány frissítése" : "Kampány beküldése"}
                </button>
              </form>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.5)]">
                  <div className="mb-4 flex items-center justify-between text-sm text-slate-300">
                    <span>Előnézet</span>
                    <span className="rounded-full border border-white/20 px-2 py-1 text-xs">{selectedTheme.label}</span>
                  </div>

                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800">
                    {coverImageUrl ? (
                      <img src={coverImageUrl} alt="Kampány kép" className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-violet-500/30 text-center text-sm text-slate-200">
                        Kép helye — ide kerül a kampány vizuális eleme
                      </div>
                    )}

                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                          {storyTheme}
                        </span>
                        <span className="text-xs text-slate-400">{startDate || "Bármikor"}</span>
                      </div>
                      <h2 className="text-xl font-semibold text-white">{title.trim() || "Az új kampányod"}</h2>
                      <p className="text-sm leading-6 text-slate-300">{description.trim() || "Írd meg a fő üzenetet, és az előnézet automatikusan megjeleníti."}</p>
                      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                        <span className="text-slate-400">{targetAudience.trim() || "Célcsoport"}</span>
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-300">{ctaLabel.trim() || "Tudj meg többet"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Miért működik ez jól?</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>• Gyorsan látsz egy modern, “story” stílusú előnézetet.</li>
                    <li>• Képes vagy egyetlen helyen kezelni a szöveget, a CTA-t és a képet.</li>
                    <li>• A kampányod később egyszerűen kezelhető és szerkeszthető.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
