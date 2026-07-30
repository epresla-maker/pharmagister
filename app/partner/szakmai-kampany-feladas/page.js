"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(touchA, touchB) {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.hypot(dx, dy);
}

export default function ProfessionalCampaignComposerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading } = useAuth();

  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [titleColor, setTitleColor] = useState("#ffffff");
  const [titleFontSize, setTitleFontSize] = useState(28);
  const [titleFontWeight, setTitleFontWeight] = useState("700");

  const [messageColor, setMessageColor] = useState("#e2e8f0");
  const [messageFontSize, setMessageFontSize] = useState(15);
  const [messageFontWeight, setMessageFontWeight] = useState("400");

  const [landingUrl, setLandingUrl] = useState("");
  const [coverImageDataUrl, setCoverImageDataUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Megnyitas");

  const [textTransparent, setTextTransparent] = useState(false);
  const [titlePosition, setTitlePosition] = useState({ x: 7, y: 12 });
  const [messagePosition, setMessagePosition] = useState({ x: 7, y: 62 });

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState("");
  const [dragTarget, setDragTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showFullscreenEditor, setShowFullscreenEditor] = useState(false);
  const [activeTextTool, setActiveTextTool] = useState("title");
  const [pinchEnabled, setPinchEnabled] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const previewRef = useRef(null);
  const titleBoxRef = useRef(null);
  const messageBoxRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const titleInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const pinchStateRef = useRef({
    active: false,
    target: null,
    startDistance: 0,
    startFontSize: 0,
  });

  const isProfessionalPartner = Boolean(userData?.partnerProfessional || userData?.accountType === "partner_professional");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const coarsePointer = typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : window.navigator.maxTouchPoints > 0;
    setIsTouchDevice(coarsePointer);
    setPinchEnabled(!coarsePointer);
  }, []);

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

        setTitleColor(row?.titleStyle?.color || "#ffffff");
        setTitleFontSize(Number.isFinite(row?.titleStyle?.fontSize) ? row.titleStyle.fontSize : 28);
        setTitleFontWeight(String(row?.titleStyle?.fontWeight || "700"));

        setMessageColor(row?.messageStyle?.color || "#e2e8f0");
        setMessageFontSize(Number.isFinite(row?.messageStyle?.fontSize) ? row.messageStyle.fontSize : 15);
        setMessageFontWeight(String(row?.messageStyle?.fontWeight || "400"));

        setLandingUrl(row.landingUrl || "");
        setCoverImageDataUrl(row.coverImageDataUrl || row.coverImageUrl || "");
        setCtaLabel(row.ctaLabel || "Megnyitas");

        setTextTransparent(Boolean(row.textTransparent));
        setTitlePosition({
          x: Number.isFinite(row?.titlePosition?.x) ? row.titlePosition.x : 7,
          y: Number.isFinite(row?.titlePosition?.y) ? row.titlePosition.y : 12,
        });
        setMessagePosition({
          x: Number.isFinite(row?.messagePosition?.x)
            ? row.messagePosition.x
            : (Number.isFinite(row?.textPosition?.x) ? row.textPosition.x : 7),
          y: Number.isFinite(row?.messagePosition?.y)
            ? row.messagePosition.y
            : (Number.isFinite(row?.textPosition?.y) ? row.textPosition.y : 62),
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
      setError("Ehhez szakmai partner fiok szukseges.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("A cim es a fo uzenet kotelezo.");
      return;
    }

    const ownerName = userData?.partnerProfile?.companyName || userData?.displayName || userData?.email || "Szakmai partner";

    const payload = {
      ownerId: user.uid,
      ownerName,
      ownerEmail: userData?.email || user?.email || null,
      campaignType: "professional_campaign",
      title: title.trim(),
      description: description.trim(),
      titleStyle: {
        color: titleColor,
        fontSize: titleFontSize,
        fontWeight: titleFontWeight,
      },
      messageStyle: {
        color: messageColor,
        fontSize: messageFontSize,
        fontWeight: messageFontWeight,
      },
      ctaLabel: ctaLabel.trim() || "Megnyitas",
      coverImageDataUrl: coverImageDataUrl || null,
      coverImageUrl: coverImageDataUrl || null,
      textTransparent,
      titlePosition,
      messagePosition,
      textPosition: messagePosition,
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
      setError("Nem sikerult menteni a kampanyt.");
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

  const handlePreviewTap = (event) => {
    if (!coverImageDataUrl) return;

    const target = event.target;
    if (target instanceof HTMLElement) {
      const isInteractiveTarget = target.closest("button, input, textarea, select, a, [data-editor-layer]");
      if (isInteractiveTarget) return;
    }

    openFullscreenEditor();
  };

  const openFullscreenEditor = () => {
    if (!coverImageDataUrl) return;
    setShowTextEditor(true);
    setShowFullscreenEditor(true);
    setActiveTextTool("title");
    if (!editingTarget) {
      setEditingTarget("title");
    }
  };

  const closeFullscreenEditor = () => {
    setShowFullscreenEditor(false);
    setShowTextEditor(false);
    setEditingTarget(null);
  };

  const handleTextPointerDown = (event, target) => {
    if (isTouchDevice || editingTarget === target || pinchStateRef.current.active) {
      return;
    }

    const boxRef = target === "title" ? titleBoxRef : messageBoxRef;
    if (!previewRef.current || !boxRef.current) return;

    const boxRect = boxRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - boxRect.left,
      y: event.clientY - boxRect.top,
    };
    setDragTarget(target);
    event.preventDefault();
  };

  const handlePinchStart = (event, target) => {
    if (isTouchDevice || !pinchEnabled || editingTarget || dragTarget || event.touches.length !== 2) {
      return;
    }

    const distance = getTouchDistance(event.touches[0], event.touches[1]);
    pinchStateRef.current = {
      active: true,
      target,
      startDistance: distance,
      startFontSize: target === "title" ? titleFontSize : messageFontSize,
    };
    setDragTarget(null);
  };

  const handlePinchMove = (event, target) => {
    if (isTouchDevice || !pinchEnabled || !pinchStateRef.current.active || pinchStateRef.current.target !== target) {
      return;
    }
    if (event.touches.length !== 2) {
      return;
    }

    event.preventDefault();
    const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
    const ratio = currentDistance / Math.max(1, pinchStateRef.current.startDistance);
    const nextSize = pinchStateRef.current.startFontSize * ratio;

    if (target === "title") {
      setTitleFontSize(Math.round(clamp(nextSize, 18, 44)));
    } else {
      setMessageFontSize(Math.round(clamp(nextSize, 12, 28)));
    }
  };

  const handlePinchEnd = () => {
    if (isTouchDevice || !pinchEnabled || !pinchStateRef.current.active) {
      return;
    }
    pinchStateRef.current = {
      active: false,
      target: null,
      startDistance: 0,
      startFontSize: 0,
    };
  };

  useEffect(() => {
    if (!dragTarget) return;

    const handlePointerMove = (event) => {
      const boxRef = dragTarget === "title" ? titleBoxRef : messageBoxRef;
      if (!previewRef.current || !boxRef.current) return;

      const containerRect = previewRef.current.getBoundingClientRect();
      const boxRect = boxRef.current.getBoundingClientRect();

      const maxLeft = Math.max(0, containerRect.width - boxRect.width);
      const maxTop = Math.max(0, containerRect.height - boxRect.height);

      const leftPx = clamp(event.clientX - containerRect.left - dragOffsetRef.current.x, 0, maxLeft);
      const topPx = clamp(event.clientY - containerRect.top - dragOffsetRef.current.y, 0, maxTop);

      const nextPosition = {
        x: (leftPx / Math.max(1, containerRect.width)) * 100,
        y: (topPx / Math.max(1, containerRect.height)) * 100,
      };

      if (dragTarget === "title") {
        setTitlePosition(nextPosition);
      } else {
        setMessagePosition(nextPosition);
      }
    };

    const handlePointerUp = () => setDragTarget(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragTarget]);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(135deg,#f8fafc_0%,#eefbf5_100%)] px-4 py-6 pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditMode ? "Szakmai kampany szerkesztese" : "Uj szakmai kampany varazslo"}
            </h1>
            <button
              type="button"
              onClick={() => router.push("/partner")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Vissza a kozpontba
            </button>
          </div>

          {loading || loadingDraft ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-slate-600 shadow-sm">Betoltes...</div>
          ) : !isProfessionalPartner ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
              Ehhez szakmai partner fiok szukseges.
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

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-800">1. Kép hozzáadása</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Először válassz képet a galériából. Utána a szöveget közvetlenül a képre rakhatod, mint egy Instagram story-ban.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                    {uploadingImage ? "Feldolgozas..." : coverImageDataUrl ? "Új kép választása" : "Kép választása galériából"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                  </label>
                  {coverImageDataUrl && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={openFullscreenEditor} className="rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                        {showFullscreenEditor ? "Szerkeszto bezarasa" : "Kép szerkesztése"}
                      </button>
                      <button type="button" onClick={() => setCoverImageDataUrl("")} className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                        Kép törlése
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Gomb felirata</label>
                      <input
                        value={ctaLabel}
                        onChange={(e) => setCtaLabel(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500"
                        placeholder="Megnyitas"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Weboldal címe (opcionális)</label>
                      <input
                        value={landingUrl}
                        onChange={(e) => setLandingUrl(e.target.value)}
                        type="url"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500"
                        placeholder="https://"
                      />
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.5)]">
                  <div className="mb-1 text-sm text-slate-300">Elonezet</div>
                    <div className="mb-4 text-xs text-slate-400">Koppints a kepre, es teljes kepernyon nyilik a szerkeszto.</div>

                  <div
                    ref={previewRef}
                    onClick={handlePreviewTap}
                    className="relative mx-auto aspect-[9/16] w-full max-w-[320px] cursor-pointer overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800"
                  >
                    {coverImageDataUrl ? (
                      <img src={coverImageDataUrl} alt="Kampany kep" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-violet-500/30 text-center text-sm text-slate-200">
                        Kep helye - ide kerul a kampany vizualis eleme
                      </div>
                    )}

                    {coverImageDataUrl && !showTextEditor && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 py-4 text-center text-sm font-medium text-slate-100">
                        Koppints a szöveg szerkesztéséhez
                      </div>
                    )}

                    <div
                      ref={titleBoxRef}
                      data-editor-layer="true"
                      data-editor-layer="true"
                      onPointerDown={(event) => handleTextPointerDown(event, "title")}
                      onTouchStart={isTouchDevice ? undefined : (event) => handlePinchStart(event, "title")}
                      onTouchMove={isTouchDevice ? undefined : (event) => handlePinchMove(event, "title")}
                      onTouchEnd={isTouchDevice ? undefined : handlePinchEnd}
                      onTouchCancel={isTouchDevice ? undefined : handlePinchEnd}
                      className={`absolute w-[86%] cursor-grab select-none rounded-2xl border border-white/20 p-4 active:cursor-grabbing ${textTransparent ? "bg-transparent" : "bg-black/55 backdrop-blur-[1px]"} ${
                        dragTarget === "title" ? "scale-[1.01]" : ""
                      }`}
                      style={{
                        left: `${titlePosition.x}%`,
                        top: `${titlePosition.y}%`,
                        touchAction: isTouchDevice ? "manipulation" : "none",
                      }}
                    >
                      {editingTarget === "title" ? (
                        <input
                          ref={titleInputRef}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          onBlur={() => setEditingTarget(null)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              setEditingTarget(null);
                            }
                          }}
                          className="w-full rounded-lg border border-white/30 bg-black/35 px-2 py-1 outline-none"
                          style={{ color: titleColor, fontSize: `${titleFontSize}px`, fontWeight: titleFontWeight, lineHeight: 1.15 }}
                          placeholder="Az uj kampanyod"
                        />
                      ) : (
                        <h2
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            setEditingTarget("title");
                            setActiveTextTool("title");
                          }}
                          className="cursor-text"
                          style={{ color: titleColor, fontSize: `${titleFontSize}px`, fontWeight: titleFontWeight, lineHeight: 1.15 }}
                        >
                          {title.trim() || "Az uj kampanyod"}
                        </h2>
                      )}
                    </div>

                    <div
                      ref={messageBoxRef}
                      onPointerDown={(event) => handleTextPointerDown(event, "message")}
                      onTouchStart={isTouchDevice ? undefined : (event) => handlePinchStart(event, "message")}
                      onTouchMove={isTouchDevice ? undefined : (event) => handlePinchMove(event, "message")}
                      onTouchEnd={isTouchDevice ? undefined : handlePinchEnd}
                      onTouchCancel={isTouchDevice ? undefined : handlePinchEnd}
                      className={`absolute w-[86%] cursor-grab select-none rounded-2xl border border-white/20 p-4 active:cursor-grabbing ${textTransparent ? "bg-transparent" : "bg-black/55 backdrop-blur-[1px]"} ${
                        dragTarget === "message" ? "scale-[1.01]" : ""
                      }`}
                      style={{
                        left: `${messagePosition.x}%`,
                        top: `${messagePosition.y}%`,
                        touchAction: isTouchDevice ? "manipulation" : "none",
                      }}
                    >
                      {editingTarget === "message" ? (
                        <textarea
                          ref={messageInputRef}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          onBlur={() => setEditingTarget(null)}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-white/30 bg-black/35 px-2 py-1 outline-none"
                          style={{ color: messageColor, fontSize: `${messageFontSize}px`, fontWeight: messageFontWeight, lineHeight: 1.4 }}
                          placeholder="Ird meg a fo uzenetet..."
                        />
                      ) : (
                        <p
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            setEditingTarget("message");
                            setActiveTextTool("message");
                          }}
                          className="cursor-text"
                          style={{ color: messageColor, fontSize: `${messageFontSize}px`, fontWeight: messageFontWeight, lineHeight: 1.4 }}
                        >
                          {description.trim() || "Ird meg a fo uzenetet, es huzd a szoveget oda, ahol a legjobb."}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-end border-t border-white/15 pt-3 text-sm">
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
                  {submitting ? "Mentes..." : isEditMode ? "Kampany frissitese" : "Kampany bekuldese"}
                </button>
              </div>
            </div>
          )}
        </div>
        {showFullscreenEditor && coverImageDataUrl && (
        <div className="fixed inset-0 z-[70] bg-slate-950/95 px-3 py-3 sm:px-6 sm:py-6">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
              <div className="mb-3 flex items-center justify-between rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur">
                <button type="button" onClick={closeFullscreenEditor} className="rounded-full bg-white/15 px-3 py-2 font-medium text-white hover:bg-white/25">
                  Bezárás
                </button>
                <div className="text-center">
                  <p className="font-semibold">Story szerkeszto</p>
                  <p className="text-xs text-slate-300">Koppints a szovegre, huzd, es ket ujjal meretezz.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTitlePosition({ x: 7, y: 12 });
                    setMessagePosition({ x: 7, y: 62 });
                  }}
                  className="rounded-full bg-white/15 px-3 py-2 font-medium text-white hover:bg-white/25"
                >
                  Alaphelyzet
                </button>
            </div>

            <div className="flex-1 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900 p-2 sm:p-3">
                <div className="relative h-full overflow-hidden rounded-[24px] bg-slate-950">
                  <img src={coverImageDataUrl} alt="Kampany kep" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-slate-900/10" />

                  <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTextTool("title");
                        setEditingTarget("title");
                      }}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${activeTextTool === "title" ? "bg-white text-slate-900" : "bg-black/45 text-white"}`}
                    >
                      Cím
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTextTool("message");
                        setEditingTarget("message");
                      }}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${activeTextTool === "message" ? "bg-white text-slate-900" : "bg-black/45 text-white"}`}
                    >
                      Üzenet
                    </button>
                    <button
                      type="button"
                      onClick={() => setTextTransparent((prev) => !prev)}
                      className="rounded-full bg-black/45 px-3 py-2 text-xs font-semibold text-white"
                    >
                      {textTransparent ? "Háttér ON" : "Háttér OFF"}
                    </button>
                  </div>

                  <div ref={previewRef} className="absolute inset-0">
                    <div
                      ref={titleBoxRef}
                      data-editor-layer="true"
                      onPointerDown={(event) => handleTextPointerDown(event, "title")}
                      onTouchStart={isTouchDevice ? undefined : (event) => handlePinchStart(event, "title")}
                      onTouchMove={isTouchDevice ? undefined : (event) => handlePinchMove(event, "title")}
                      onTouchEnd={isTouchDevice ? undefined : handlePinchEnd}
                      onTouchCancel={isTouchDevice ? undefined : handlePinchEnd}
                      className={`absolute w-[86%] cursor-grab select-none rounded-2xl border border-white/20 p-4 active:cursor-grabbing ${textTransparent ? "bg-transparent" : "bg-black/55 backdrop-blur-[1px]"} ${dragTarget === "title" ? "scale-[1.01]" : ""}`}
                      style={{ left: `${titlePosition.x}%`, top: `${titlePosition.y}%`, touchAction: isTouchDevice ? "manipulation" : "none" }}
                    >
                      {editingTarget === "title" ? (
                        <input
                          ref={titleInputRef}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          onBlur={() => setEditingTarget(null)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              setEditingTarget(null);
                            }
                          }}
                          className="w-full rounded-lg border border-white/30 bg-black/35 px-2 py-1 outline-none"
                          style={{ color: titleColor, fontSize: `${titleFontSize}px`, fontWeight: titleFontWeight, lineHeight: 1.15 }}
                          placeholder="Az uj kampanyod"
                        />
                      ) : (
                        <h2
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            setEditingTarget("title");
                            setActiveTextTool("title");
                          }}
                          className="cursor-text"
                          style={{ color: titleColor, fontSize: `${titleFontSize}px`, fontWeight: titleFontWeight, lineHeight: 1.15 }}
                        >
                          {title.trim() || "Az uj kampanyod"}
                        </h2>
                      )}
                    </div>

                    <div
                      ref={messageBoxRef}
                      onPointerDown={(event) => handleTextPointerDown(event, "message")}
                      onTouchStart={isTouchDevice ? undefined : (event) => handlePinchStart(event, "message")}
                      onTouchMove={isTouchDevice ? undefined : (event) => handlePinchMove(event, "message")}
                      onTouchEnd={isTouchDevice ? undefined : handlePinchEnd}
                      onTouchCancel={isTouchDevice ? undefined : handlePinchEnd}
                      className={`absolute w-[86%] cursor-grab select-none rounded-2xl border border-white/20 p-4 active:cursor-grabbing ${textTransparent ? "bg-transparent" : "bg-black/55 backdrop-blur-[1px]"} ${dragTarget === "message" ? "scale-[1.01]" : ""}`}
                      style={{ left: `${messagePosition.x}%`, top: `${messagePosition.y}%`, touchAction: isTouchDevice ? "manipulation" : "none" }}
                    >
                      {editingTarget === "message" ? (
                        <textarea
                          ref={messageInputRef}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          onBlur={() => setEditingTarget(null)}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-white/30 bg-black/35 px-2 py-1 outline-none"
                          style={{ color: messageColor, fontSize: `${messageFontSize}px`, fontWeight: messageFontWeight, lineHeight: 1.4 }}
                          placeholder="Ird meg a fo uzenetet..."
                        />
                      ) : (
                        <p
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            setEditingTarget("message");
                            setActiveTextTool("message");
                          }}
                          className="cursor-text"
                          style={{ color: messageColor, fontSize: `${messageFontSize}px`, fontWeight: messageFontWeight, lineHeight: 1.4 }}
                        >
                          {description.trim() || "Ird meg a fo uzenetet, es huzd a szoveget oda, ahol a legjobb."}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-end border-t border-white/15 pt-3 text-sm">
                        <span className="rounded-full bg-emerald-500/30 px-3 py-1 font-semibold text-emerald-100">{ctaLabel.trim() || "Megnyitas"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent px-3 pb-3 pt-10">
                    <div className="mx-auto max-w-[680px] rounded-2xl border border-white/15 bg-black/45 p-3 backdrop-blur">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-200">
                        <span className="font-semibold">{activeTextTool === "title" ? "Cím szerkesztése" : "Üzenet szerkesztése"}</span>
                        <span>Story eszkozok</span>
                      </div>
                      <div className="space-y-3">
                        {activeTextTool === "title" ? (
                          <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
                            placeholder="Pl. Teli tudasnap a patikakban"
                          />
                        ) : (
                          <textarea
                            rows={2}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            className="w-full resize-none rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
                            placeholder="Ird ide a fo uzenetet..."
                          />
                        )}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-300">Szin</label>
                            <input
                              type="color"
                              value={activeTextTool === "title" ? titleColor : messageColor}
                              onChange={(event) => {
                                if (activeTextTool === "title") {
                                  setTitleColor(event.target.value);
                                } else {
                                  setMessageColor(event.target.value);
                                }
                              }}
                              className="h-10 w-full rounded-lg border border-white/10 bg-white"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-300">Meret</label>
                            <input
                              type="range"
                              min={activeTextTool === "title" ? "18" : "12"}
                              max={activeTextTool === "title" ? "44" : "28"}
                              value={activeTextTool === "title" ? titleFontSize : messageFontSize}
                              onChange={(event) => {
                                if (activeTextTool === "title") {
                                  setTitleFontSize(Number(event.target.value));
                                } else {
                                  setMessageFontSize(Number(event.target.value));
                                }
                              }}
                              className="w-full"
                            />
                            <p className="text-[11px] text-slate-300">{activeTextTool === "title" ? titleFontSize : messageFontSize}px</p>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-300">Vastagsag</label>
                            <select
                              value={activeTextTool === "title" ? titleFontWeight : messageFontWeight}
                              onChange={(event) => {
                                if (activeTextTool === "title") {
                                  setTitleFontWeight(event.target.value);
                                } else {
                                  setMessageFontWeight(event.target.value);
                                }
                              }}
                              className="h-10 w-full rounded-lg border border-white/15 bg-slate-950/70 px-2 text-sm text-white"
                            >
                              {activeTextTool === "title" ? (
                                <>
                                  <option value="500">Normal</option>
                                  <option value="600">Felemelt</option>
                                  <option value="700">Felkover</option>
                                  <option value="800">Extra felkover</option>
                                </>
                              ) : (
                                <>
                                  <option value="400">Normal</option>
                                  <option value="500">Felemelt</option>
                                  <option value="600">Felkover</option>
                                  <option value="700">Extra felkover</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </RouteGuard>
  );
}
