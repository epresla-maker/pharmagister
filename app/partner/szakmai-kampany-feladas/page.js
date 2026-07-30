"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

const STORY_THEMES = [
  { id: "energetikus", label: "Energetikus", badge: "⚡" },
  { id: "elegans", label: "Elegans", badge: "✨" },
  { id: "oktato", label: "Oktato", badge: "🎓" },
  { id: "exkluziv", label: "Exkluziv", badge: "💎" },
];

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nem sikerult a kep beolvasasa."));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file, maxWidth = 1280, quality = 0.82) {
  const source = await readImageAsDataUrl(file);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Nem sikerult a kep betoltese."));
    img.src = source;
  });

  const ratio = Math.min(1, maxWidth / Math.max(1, img.width));
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("A kepfeldolgozas nem elerheto.");
  }

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function ProfessionalCampaignComposerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading } = useAuth();

  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [storyTheme, setStoryTheme] = useState("energetikus");
  const [landingUrl, setLandingUrl] = useState("");
  const [coverImageDataUrl, setCoverImageDataUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Megnyitas");
  const [textTransparent, setTextTransparent] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 7, y: 70 });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState("");
  const [isDraggingText, setIsDraggingText] = useState(false);

  const previewRef = useRef(null);
  const textBoxRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isProfessionalPartner = useMemo(
    () => Boolean(userData?.partnerProfessional || userData?.accountType === "partner_professional"),
    [userData]
  );
  const selectedStoryTheme = useMemo(
    () => STORY_THEMES.find((item) => item.id === storyTheme) || STORY_THEMES[0],
    [storyTheme]
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
        setStoryTheme(row.storyTheme || "energetikus");
        setLandingUrl(row.landingUrl || "");
        setCoverImageDataUrl(row.coverImageDataUrl || row.coverImageUrl || "");
        setCtaLabel(row.ctaLabel || "Megnyitas");
        setTextTransparent(Boolean(row.textTransparent));
        setTextPosition({
          x: Number.isFinite(row?.textPosition?.x) ? row.textPosition.x : 7,
          y: Number.isFinite(row?.textPosition?.y) ? row.textPosition.y : 70,
        });
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

    const ownerName =
      userData?.partnerProfile?.companyName || userData?.displayName || userData?.email || "Szakmai partner";

    const payload = {
      ownerId: user.uid,
      ownerName,
      ownerEmail: userData?.email || user?.email || null,
      campaignType: "professional_campaign",
      storyTheme,
      title: title.trim(),
      description: description.trim(),
      ctaLabel: ctaLabel.trim() || "Megnyitas",
      coverImageDataUrl: coverImageDataUrl || null,
      coverImageUrl: coverImageDataUrl || null,
      textTransparent,
      textPosition,
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

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadingImage(true);
    try {
      const dataUrl = await compressImageFile(file);
      setCoverImageDataUrl(dataUrl);
    } catch (e) {
      console.error("Image upload error:", e);
      setError("Nem sikerult a kepet feldolgozni.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const handleTextPointerDown = (event) => {
    if (!previewRef.current || !textBoxRef.current) return;

    const boxRect = textBoxRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - boxRect.left,
      y: event.clientY - boxRect.top,
    };
    setIsDraggingText(true);
    event.preventDefault();
  };

  useEffect(() => {
    if (!isDraggingText) return;

    const handlePointerMove = (event) => {
      if (!previewRef.current || !textBoxRef.current) return;

      const containerRect = previewRef.current.getBoundingClientRect();
      const boxRect = textBoxRef.current.getBoundingClientRect();

      const maxLeft = Math.max(0, containerRect.width - boxRect.width);
      const maxTop = Math.max(0, containerRect.height - boxRect.height);

      const leftPx = clamp(event.clientX - containerRect.left - dragOffsetRef.current.x, 0, maxLeft);
      const topPx = clamp(event.clientY - containerRect.top - dragOffsetRef.current.y, 0, maxTop);

      setTextPosition({
        x: (leftPx / Math.max(1, containerRect.width)) * 100,
        y: (topPx / Math.max(1, containerRect.height)) * 100,
      });
    };

    const handlePointerUp = () => setIsDraggingText(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingText]);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(135deg,#f8fafc_0%,#eefbf5_100%)] px-4 py-6 pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
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
              <form id="professional-campaign-form" onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.28)] backdrop-blur">
                {error && <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Keszits gyorsan egy modern, konnyen kezelheto kampanyt</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    A mezoket kitoltve azonnal latod az elonezetben, hogyan fog kinezni a kampanyod mobilon.
                  </p>
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
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={textTransparent}
                      onChange={(e) => setTextTransparent(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Szoveg hattere atlatszo
                  </label>
                  <button
                    type="button"
                    onClick={() => setTextPosition({ x: 7, y: 70 })}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Szoveg pozicio visszaallitasa
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Kep feltoltese (opcionalis)</label>
                    <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
                      {uploadingImage ? "Feldolgozas..." : "Kep kivalasztasa galeriabol"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImagePick}
                      />
                    </label>
                    {coverImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => setCoverImageDataUrl("")}
                        className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Kep torlese
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Gomb felirata</label>
                    <input
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                      placeholder="Megnyitas"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Weboldal cime (opcionalis)</label>
                  <input
                    value={landingUrl}
                    onChange={(e) => setLandingUrl(e.target.value)}
                    type="url"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                    placeholder="https://"
                  />
                </div>

              </form>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.5)]">
                  <div className="mb-4 text-sm text-slate-300">Előnézet</div>

                  <div
                    ref={previewRef}
                    className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800"
                  >
                    {coverImageDataUrl ? (
                      <img src={coverImageDataUrl} alt="Kampany kep" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-violet-500/30 text-center text-sm text-slate-200">
                        Kep helye - ide kerul a kampany vizualis eleme
                      </div>
                    )}

                    <div
                      ref={textBoxRef}
                      onPointerDown={handleTextPointerDown}
                      className={`absolute w-[86%] cursor-grab select-none rounded-2xl border border-white/20 p-4 active:cursor-grabbing ${
                        textTransparent ? 'bg-transparent' : 'bg-black/55 backdrop-blur-[1px]'
                      } ${isDraggingText ? 'scale-[1.01]' : ''}`}
                      style={{
                        left: `${textPosition.x}%`,
                        top: `${textPosition.y}%`,
                        touchAction: 'none',
                      }}
                    >
                      <h2 className="text-lg font-semibold text-white">{title.trim() || "Az uj kampanyod"}</h2>
                      <p className="mt-2 text-sm leading-5 text-slate-100">{description.trim() || "Ird meg a fo uzenetet, es huzd a szoveget oda, ahol a legjobb."}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3 text-sm">
                        <span className="text-slate-200">Szakmai kampany</span>
                        <span className="rounded-full bg-emerald-500/30 px-3 py-1 font-semibold text-emerald-100">{ctaLabel.trim() || "Megnyitas"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  form="professional-campaign-form"
                  disabled={submitting || uploadingImage}
                  className="w-full rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submitting ? "Mentés..." : isEditMode ? "Kampány frissítése" : "Kampány beküldése"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
