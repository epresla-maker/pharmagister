"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Captions, Check, ChevronUp, Layers, Music2, Type, X } from "lucide-react";

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

const GENERATED_BACKGROUNDS = {
  aurora: "linear-gradient(145deg,#0f766e 0%,#1d4ed8 45%,#7c3aed 100%)",
  sunrise: "linear-gradient(145deg,#f97316 0%,#ef4444 45%,#7c2d12 100%)",
  mint: "linear-gradient(145deg,#064e3b 0%,#10b981 45%,#99f6e4 100%)",
  steel: "linear-gradient(145deg,#0f172a 0%,#334155 45%,#94a3b8 100%)",
};

const FONT_STYLES = [
  { id: "classic",       label: "Classic",       css: { fontWeight: "700", textShadow: "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000" } },
  { id: "classic_light", label: "Classic Light",  css: { fontWeight: "300", textShadow: "-1px -1px 0 rgba(0,0,0,.6),1px 1px 0 rgba(0,0,0,.6)" } },
  { id: "modern",        label: "Modern",         css: { fontWeight: "400" } },
  { id: "modern_bold",   label: "Modern Bold",    css: { fontWeight: "800" } },
  { id: "signature",     label: "Signature",      css: { fontStyle: "italic", fontFamily: "Georgia,'Times New Roman',serif", fontWeight: "400" } },
  { id: "editor",        label: "Editor",         css: { fontFamily: "monospace", fontWeight: "400" } },
  { id: "poster",        label: "Poster",         css: { fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.08em" } },
  { id: "bubble",        label: "Bubble",         css: { fontWeight: "900", WebkitTextStroke: "4px #000", paintOrder: "stroke fill" } },
];

function createStoryObject(type = "sticker") {
  const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const baseObject = {
    rotation: 0,
    opacity: 1,
    scale: 1,
    color: "#ffffff",
    fontWeight: "700",
    imageUrl: "",
    stickerType: "general",
    interactionType: "none",
    startMs: 0,
    endMs: 15000,
    entryAnimation: "fade",
    loopAnimation: "none",
    exitAnimation: "none",
  };

  if (type === "text") {
    return {
      ...baseObject,
      id: `obj_${seed}`,
      type: "text",
      value: "",
      x: 7,
      y: 38,
      width: 86,
      height: 15,
      fontSize: 28,
      fontStyle: "classic",
      textAlign: "center",
    };
  }

  if (type === "gif") {
    return {
      ...baseObject,
      id: `obj_${seed}`,
      type: "gif",
      value: "GIF",
      x: 10,
      y: 58,
      width: 34,
      height: 14,
      fontSize: 20,
    };
  }

  if (type === "image") {
    return {
      ...baseObject,
      id: `obj_${seed}`,
      type: "image",
      value: "Kep objektum",
      x: 12,
      y: 58,
      width: 42,
      height: 20,
      fontSize: 14,
    };
  }

  return {
    ...baseObject,
    id: `obj_${seed}`,
    type: "sticker",
    value: "✨",
    x: 12,
    y: 68,
    width: 22,
    height: 12,
    fontSize: 34,
  };
}

function normalizeStoryObject(raw, fallbackType = "sticker") {
  const base = createStoryObject(fallbackType);
  const next = {
    ...base,
    ...raw,
  };

  next.type = ["text", "sticker", "gif", "image"].includes(next.type) ? next.type : fallbackType;
  next.id = String(next.id || base.id);
  next.value = String(next.value ?? base.value);
  next.x = clamp(Number(next.x), 0, 92);
  next.y = clamp(Number(next.y), 0, 92);
  next.width = clamp(Number(next.width), 12, 92);
  next.height = clamp(Number(next.height), 8, 70);
  next.rotation = clamp(Number(next.rotation), -180, 180);
  next.opacity = clamp(Number(next.opacity), 0.1, 1);
  next.scale = clamp(Number(next.scale), 0.4, 2.5);
  next.fontSize = clamp(Number(next.fontSize), 10, 72);
  next.color = String(next.color || base.color);
  next.fontWeight = String(next.fontWeight || base.fontWeight);
  next.fontStyle = String(next.fontStyle || "classic");
  next.textAlign = ["left","center","right"].includes(next.textAlign) ? next.textAlign : "center";
  next.imageUrl = String(next.imageUrl || "");
  next.stickerType = String(next.stickerType || "general");
  next.interactionType = String(next.interactionType || "none");
  next.startMs = clamp(Number(next.startMs), 0, 120000);
  next.endMs = clamp(Number(next.endMs), next.startMs + 300, 120000);
  next.entryAnimation = String(next.entryAnimation || "fade");
  next.loopAnimation = String(next.loopAnimation || "none");
  next.exitAnimation = String(next.exitAnimation || "none");

  return next;
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
  const [backgroundMode, setBackgroundMode] = useState("image");
  const [backgroundColor, setBackgroundColor] = useState("#0f172a");
  const [generatedBackground, setGeneratedBackground] = useState("aurora");

  const [textTransparent, setTextTransparent] = useState(false);
  const [titlePosition, setTitlePosition] = useState({ x: 7, y: 12 });
  const [messagePosition, setMessagePosition] = useState({ x: 7, y: 62 });
  const [storyObjects, setStoryObjects] = useState([]);
  const [activeObjectId, setActiveObjectId] = useState(null);
  const [musicTrack, setMusicTrack] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [musicStartSec, setMusicStartSec] = useState(0);
  const [musicDurationSec, setMusicDurationSec] = useState(15);
  const [showLyrics, setShowLyrics] = useState(false);
  const [videoTrimStartSec, setVideoTrimStartSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState(15);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [videoMuted, setVideoMuted] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [postTags, setPostTags] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postVisibility, setPostVisibility] = useState("followers");
  const [activeQuickTool, setActiveQuickTool] = useState("none");
  const [showPublishScreen, setShowPublishScreen] = useState(false);
  const [toolSheetExpanded, setToolSheetExpanded] = useState(false);

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

  const [editingTextId, setEditingTextId] = useState(null);
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [showFontGrid, setShowFontGrid] = useState(false);

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
  const objectDragRef = useRef({
    objectId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const storyObjectsRef = useRef([]);
  const objectImageInputRef = useRef(null);
  const textInputRef = useRef(null);

  const isProfessionalPartner = Boolean(userData?.partnerProfessional || userData?.accountType === "partner_professional");
  const activeObject = useMemo(
    () => storyObjects.find((item) => item.id === activeObjectId) || null,
    [storyObjects, activeObjectId]
  );

  const setObjectField = (id, field, value) => {
    setStoryObjects((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return normalizeStoryObject({ ...item, [field]: value }, item.type);
    }));
  };

  useEffect(() => {
    storyObjectsRef.current = storyObjects;
  }, [storyObjects]);

  useEffect(() => {
    if (activeQuickTool !== "none") {
      setToolSheetExpanded(true);
    }
  }, [activeQuickTool]);

  const activeBackgroundStyle = useMemo(() => {
    if (backgroundMode === "color") {
      return { background: backgroundColor || "#0f172a" };
    }
    if (backgroundMode === "generated") {
      return { background: GENERATED_BACKGROUNDS[generatedBackground] || GENERATED_BACKGROUNDS.aurora };
    }
    return { background: "linear-gradient(145deg,#0f172a 0%,#334155 100%)" };
  }, [backgroundMode, backgroundColor, generatedBackground]);

  const addObject = (type) => {
    const next = createStoryObject(type);
    setStoryObjects((prev) => [...prev, next]);
    setActiveObjectId(next.id);
  };

  const addStickerPreset = (value, stickerType = "info") => {
    const next = normalizeStoryObject({
      ...createStoryObject("sticker"),
      value,
      stickerType,
    }, "sticker");
    setStoryObjects((prev) => [...prev, next]);
    setActiveObjectId(next.id);
  };

  const deleteActiveObject = () => {
    if (!activeObjectId) return;
    setStoryObjects((prev) => prev.filter((item) => item.id !== activeObjectId));
    setActiveObjectId(null);
  };

  const duplicateActiveObject = () => {
    if (!activeObject) return;
    const copy = normalizeStoryObject({
      ...activeObject,
      id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      x: clamp(Number(activeObject.x) + 3, 0, 92),
      y: clamp(Number(activeObject.y) + 3, 0, 92),
    }, activeObject.type);
    setStoryObjects((prev) => [...prev, copy]);
    setActiveObjectId(copy.id);
  };

  const moveActiveObjectLayer = (direction) => {
    if (!activeObjectId) return;
    setStoryObjects((prev) => {
      const index = prev.findIndex((item) => item.id === activeObjectId);
      if (index === -1) return prev;
      const target = direction === "up" ? index + 1 : index - 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleStoryObjectPointerDown = (event, objectId) => {
    if (isTouchDevice) return;
    if (!previewRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    const boxRect = event.currentTarget.getBoundingClientRect();
    objectDragRef.current = {
      objectId,
      offsetX: event.clientX - boxRect.left,
      offsetY: event.clientY - boxRect.top,
    };
    setActiveObjectId(objectId);
  };

  const triggerObjectImagePick = () => {
    if (!activeObject) return;
    objectImageInputRef.current?.click();
  };

  const handleObjectImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeObject) return;

    setError("");
    try {
      const dataUrl = await compressImageFile(file);
      setStoryObjects((prev) => prev.map((item) => {
        if (item.id !== activeObject.id) return item;
        return normalizeStoryObject({
          ...item,
          type: "image",
          imageUrl: dataUrl,
          value: item.value || "Kep objektum",
        }, "image");
      }));
    } catch (e) {
      console.error("Object image error:", e);
      setError("Nem sikerult az objektumkep feldolgozasa.");
    } finally {
      event.target.value = "";
    }
  };

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

        const bgType = String(row?.storyCanvas?.background?.type || "");
        if (["image", "color", "generated"].includes(bgType)) {
          setBackgroundMode(bgType);
        }
        if (bgType === "color") {
          setBackgroundColor(String(row?.storyCanvas?.background?.value || "#0f172a"));
        }
        if (bgType === "generated") {
          const key = String(row?.storyCanvas?.background?.value || "aurora");
          setGeneratedBackground(Object.prototype.hasOwnProperty.call(GENERATED_BACKGROUNDS, key) ? key : "aurora");
        }

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

        const loadedStoryObjects = Array.isArray(row?.storyCanvas?.objects)
          ? row.storyCanvas.objects
              .filter((item) => item && ["text", "sticker", "gif", "image"].includes(String(item.type || "")))
              .map((item) => normalizeStoryObject(item, item.type))
          : [];
        setStoryObjects(loadedStoryObjects);
        setActiveObjectId(null);

        if (row.musicLayer) {
          setMusicTrack(String(row.musicLayer.track || ""));
          setMusicArtist(String(row.musicLayer.artist || ""));
          setMusicStartSec(Number.isFinite(row.musicLayer.startSec) ? row.musicLayer.startSec : 0);
          setMusicDurationSec(Number.isFinite(row.musicLayer.durationSec) ? row.musicLayer.durationSec : 15);
          setShowLyrics(Boolean(row.musicLayer.showLyrics));
        }
        if (row.videoSettings) {
          setVideoTrimStartSec(Number.isFinite(row.videoSettings.trimStartSec) ? row.videoSettings.trimStartSec : 0);
          setVideoDurationSec(Number.isFinite(row.videoSettings.durationSec) ? row.videoSettings.durationSec : 15);
          setVideoSpeed(Number.isFinite(row.videoSettings.speed) ? row.videoSettings.speed : 1);
          setVideoMuted(Boolean(row.videoSettings.muted));
        }

        setPostCaption(String(row.postCaption || ""));
        setPostTags(Array.isArray(row.postTags) ? row.postTags.join(", ") : "");
        setPostLocation(String(row.postLocation || ""));
        setPostVisibility(String(row.postVisibility || "followers"));
      } catch (e) {
        console.error("Campaign load error:", e);
      } finally {
        setLoadingDraft(false);
      }
    };

    loadExisting();
  }, [isEditMode, editId, user?.uid]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");

    if (!isProfessionalPartner) {
      setError("Ehhez szakmai partner fiok szukseges.");
      return;
    }

    const textObjects = storyObjects.filter((o) => o.type === "text" && String(o.value || "").trim());
    if (textObjects.length === 0) {
      setError("Adj hozzá legalább egy szöveges réteget a kampányhoz.");
      return;
    }

    const derivedTitle = textObjects[0]?.value?.trim() || "Kampány";
    const derivedDescription = textObjects.slice(1).map((o) => o.value).join(" ").trim() || "";

    const ownerName = userData?.partnerProfile?.companyName || userData?.displayName || userData?.email || "Szakmai partner";

    const payload = {
      ownerId: user.uid,
      ownerName,
      ownerEmail: userData?.email || user?.email || null,
      campaignType: "professional_campaign",
      title: derivedTitle,
      description: derivedDescription,
      ctaLabel: ctaLabel.trim() || "Megnyitas",
      coverImageDataUrl: coverImageDataUrl || null,
      coverImageUrl: coverImageDataUrl || null,
      storyCanvas: {
        width: 1080,
        height: 1920,
        ratio: "9:16",
        background: {
          type: backgroundMode,
          value: backgroundMode === "image"
            ? (coverImageDataUrl || null)
            : (backgroundMode === "generated" ? generatedBackground : backgroundColor),
        },
        objects: storyObjects.map((item) => normalizeStoryObject(item, item.type)),
      },
      musicLayer: {
        track: musicTrack.trim() || null,
        artist: musicArtist.trim() || null,
        startSec: clamp(Number(musicStartSec), 0, 120),
        durationSec: clamp(Number(musicDurationSec), 3, 30),
        showLyrics: Boolean(showLyrics),
      },
      videoSettings: {
        trimStartSec: clamp(Number(videoTrimStartSec), 0, 120),
        durationSec: clamp(Number(videoDurationSec), 3, 30),
        speed: clamp(Number(videoSpeed), 0.5, 2),
        muted: Boolean(videoMuted),
      },
      postCaption: postCaption.trim() || null,
      postTags: postTags
        .split(",")
        .map((item) => item.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 12),
      postLocation: postLocation.trim() || null,
      postVisibility,
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
    const target = event.target;
    if (target instanceof HTMLElement) {
      const isInteractiveTarget = target.closest("button, input, textarea, select, a, [data-editor-layer]");
      if (isInteractiveTarget) return;
    }

    openFullscreenEditor();
  };

  const openFullscreenEditor = () => {
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
    if (isTouchDevice || editingTarget === target || pinchStateRef.current.active || objectDragRef.current.objectId) {
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

  useEffect(() => {
    const handlePointerMove = (event) => {
      const dragId = objectDragRef.current.objectId;
      if (!dragId || !previewRef.current) return;

      const item = storyObjectsRef.current.find((row) => row.id === dragId);
      if (!item) return;

      const containerRect = previewRef.current.getBoundingClientRect();
      const visualWidth = clamp(item.width * item.scale, 12, 95);
      const visualHeight = clamp(item.height * item.scale, 8, 80);

      const maxLeft = Math.max(0, containerRect.width - ((visualWidth / 100) * containerRect.width));
      const maxTop = Math.max(0, containerRect.height - ((visualHeight / 100) * containerRect.height));

      const leftPx = clamp(event.clientX - containerRect.left - objectDragRef.current.offsetX, 0, maxLeft);
      const topPx = clamp(event.clientY - containerRect.top - objectDragRef.current.offsetY, 0, maxTop);

      const x = (leftPx / Math.max(1, containerRect.width)) * 100;
      const y = (topPx / Math.max(1, containerRect.height)) * 100;

      setObjectField(dragId, "x", x);
      setObjectField(dragId, "y", y);
    };

    const handlePointerUp = () => {
      objectDragRef.current = {
        objectId: null,
        offsetX: 0,
        offsetY: 0,
      };
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [setObjectField]);

  const renderStoryObject = (item) => {
    const isActive = activeObjectId === item.id;
    const isGifUrl = item.type === "gif" && /^https?:\/\//i.test(String(item.value || ""));
    const objectImageSrc = item.type === "image" ? (item.imageUrl || (String(item.value || "").startsWith("data:image") ? item.value : "")) : "";
    const fontDef = FONT_STYLES.find((f) => f.id === item.fontStyle) || FONT_STYLES[0];

    return (
      <div
        key={item.id}
        data-editor-layer="true"
        onPointerDown={(event) => handleStoryObjectPointerDown(event, item.id)}
        onClick={(event) => {
          event.stopPropagation();
          setActiveObjectId(item.id);
          if (item.type === "text") {
            setEditingTextId(item.id);
            setShowFontGrid(false);
            setTimeout(() => textInputRef.current?.focus(), 80);
          }
        }}
        className={`absolute cursor-grab rounded-xl border active:cursor-grabbing ${isActive ? "border-white/60 ring-2 ring-white/40" : "border-transparent"}`}
        style={{
          left: `${item.x}%`,
          top: `${item.y}%`,
          width: `${item.width}%`,
          minHeight: `${item.height}%`,
          opacity: item.opacity,
          transform: `rotate(${item.rotation}deg) scale(${item.scale})`,
          transformOrigin: "top left",
        }}
      >
        {objectImageSrc ? (
          <img src={objectImageSrc} alt="Objektum kep" className="h-full w-full rounded-lg object-cover" />
        ) : isGifUrl ? (
          <img src={item.value} alt="GIF" className="h-full w-full rounded-lg object-cover" />
        ) : item.type === "text" ? (
          <p
            className="whitespace-pre-wrap break-words px-2 py-1"
            style={{
              color: item.color,
              fontSize: `${item.fontSize}px`,
              lineHeight: 1.2,
              textAlign: item.textAlign || "center",
              ...fontDef.css,
            }}
          >
            {item.value || ""}
          </p>
        ) : (
          <div
            className="flex min-h-[20px] items-center justify-center whitespace-pre-wrap break-words text-center"
            style={{ color: item.color, fontSize: `${item.fontSize}px`, fontWeight: item.fontWeight, lineHeight: 1.1 }}
          >
            {item.value || (item.type === "gif" ? "GIF" : "✨")}
          </div>
        )}
      </div>
    );
  };

  const coverImageInputRef = useRef(null);

  const addTextAndEdit = () => {
    const next = createStoryObject("text");
    setStoryObjects((prev) => [...prev, next]);
    setActiveObjectId(next.id);
    setEditingTextId(next.id);
    setShowFontGrid(false);
    setTimeout(() => textInputRef.current?.focus(), 80);
  };

  const closeTextEditor = () => {
    // Remove empty text objects
    setStoryObjects((prev) => prev.filter((o) => o.type !== "text" || String(o.value || "").trim()));
    setEditingTextId(null);
    setShowFontGrid(false);
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-black">
        {loading || loadingDraft ? (
          <div className="flex min-h-screen items-center justify-center text-white">Betöltés...</div>
        ) : !isProfessionalPartner ? (
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-amber-300">Ehhez szakmai partner fiok szükséges.</p>
            <button type="button" onClick={() => router.push("/partner")} className="rounded-full bg-white/15 px-5 py-3 text-sm font-semibold text-white">Vissza</button>
          </div>
        ) : (
          /* ── MAIN EDITOR ── */
          <div className="fixed inset-0 flex flex-col bg-black text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>

            {/* Top bar */}
            <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
              <button type="button" onClick={() => router.push("/partner")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" aria-label="Vissza">
                <X className="h-5 w-5" />
              </button>
              {musicTrack ? (
                <button type="button" onClick={() => setShowMusicSheet(true)} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">
                  <Music2 className="h-3.5 w-3.5" />{musicTrack}
                </button>
              ) : <div className="w-11" />}
              <button type="button" onClick={() => setShowPublishScreen(true)} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">
                Tovább →
              </button>
            </div>

            {error && <div className="mx-4 mb-1 rounded-2xl bg-rose-900/60 px-3 py-2 text-sm text-rose-200">{error}</div>}

            {/* Canvas */}
            <div
              ref={previewRef}
              className="relative min-h-0 flex-1 overflow-hidden"
              style={activeBackgroundStyle}
              onClick={() => setActiveObjectId(null)}
            >
              {backgroundMode === "image" && coverImageDataUrl && (
                <img src={coverImageDataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {backgroundMode !== "image" && (
                <div className="absolute inset-0" style={activeBackgroundStyle} />
              )}
              {backgroundMode === "image" && !coverImageDataUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button type="button" onClick={() => coverImageInputRef.current?.click()}
                    className="flex flex-col items-center gap-3 rounded-3xl bg-white/10 px-10 py-8 text-white backdrop-blur-sm active:bg-white/20">
                    <span className="text-5xl">📷</span>
                    <span className="text-sm font-semibold">Háttérkép hozzáadása</span>
                    <span className="text-xs opacity-50">Érintsd meg</span>
                  </button>
                </div>
              )}
              {storyObjects.map((item) => renderStoryObject(item))}
            </div>

            {/* Bottom controls */}
            <div className="flex-shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              <p className="py-2 text-center text-[11px] text-white/35">∧  Módosítás felfelé pöccintéssel</p>

              {/* Icon toolbar — matches Instagram squares */}
              <div className="flex justify-center gap-2 px-3 pb-3">
                {[
                  { label: "Hang",    icon: <Music2 className="h-6 w-6" />,  action: () => setShowMusicSheet(true) },
                  { label: "Szöveg",  icon: <Type className="h-6 w-6" />,    action: addTextAndEdit },
                  { label: "Háttér",  icon: <span className="text-xl leading-none">🖼</span>, action: () => coverImageInputRef.current?.click() },
                  { label: "Matrica", icon: <span className="text-xl leading-none">✨</span>, action: () => addStickerPreset("✨", "general") },
                  { label: "Poszt",   icon: <Captions className="h-6 w-6" />, action: () => setActiveQuickTool((p) => p === "publish" ? "none" : "publish") },
                ].map(({ label, icon, action }) => (
                  <button key={label} type="button" onClick={action}
                    className="flex flex-1 max-w-[70px] flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 px-1 text-[11px] font-medium active:bg-white/20">
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Poszt mini-panel */}
              {activeQuickTool === "publish" && (
                <div className="border-t border-white/10 bg-[#111] px-4 pb-3 pt-3">
                  <label className="block text-xs text-white/50 mb-1">Képaláírás
                    <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none" placeholder="Képaláírás..." />
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input value={postTags} onChange={(e) => setPostTags(e.target.value)} className="h-10 rounded-xl bg-white/10 px-3 text-sm text-white outline-none" placeholder="#kampány #patika" />
                    <input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} className="h-10 rounded-xl bg-white/10 px-3 text-sm text-white outline-none" placeholder="Helyszín" />
                  </div>
                </div>
              )}

              {/* CTA row */}
              <div className="flex items-center justify-between gap-3 px-4 pb-2">
                <button type="button" onClick={() => setShowPublishScreen(true)}
                  className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium">
                  Videó szerkesztése
                </button>
                <button type="button" onClick={() => setShowPublishScreen(true)}
                  disabled={submitting || uploadingImage}
                  className="flex-1 max-w-[180px] rounded-full bg-blue-600 py-3 text-sm font-bold disabled:opacity-50">
                  Tovább →
                </button>
              </div>
            </div>

            {/* Hidden file inputs */}
            <input ref={coverImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
            <input ref={objectImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleObjectImagePick} />
          </div>
        )}

        {/* ── TEXT EDITOR OVERLAY ── */}
        {editingTextId && (() => {
          const editObj = storyObjects.find((o) => o.id === editingTextId);
          if (!editObj) return null;
          const fontDef = FONT_STYLES.find((f) => f.id === editObj.fontStyle) || FONT_STYLES[0];
          const liveStyle = {
            color: editObj.color,
            fontSize: `${editObj.fontSize}px`,
            lineHeight: 1.2,
            textAlign: editObj.textAlign || "center",
            ...fontDef.css,
          };
          return (
            <div className="fixed inset-0 z-[60] flex flex-col bg-black/85 text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              {/* Kész */}
              <div className="flex justify-end px-5 py-4">
                <button type="button" onClick={closeTextEditor} className="text-base font-semibold">Kész</button>
              </div>

              {/* Canvas with live text */}
              <div className="relative min-h-0 flex-1 overflow-hidden" style={activeBackgroundStyle}>
                {backgroundMode === "image" && coverImageDataUrl && (
                  <img src={coverImageDataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {backgroundMode !== "image" && <div className="absolute inset-0" style={activeBackgroundStyle} />}
                {/* Other objects */}
                {storyObjects.filter((o) => o.id !== editingTextId).map((item) => renderStoryObject(item))}
                {/* Live editing text — centered */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                  <p style={liveStyle} className="whitespace-pre-wrap break-words max-w-full">
                    {editObj.value || <span style={{ opacity: 0.35 }}>Írj szöveget...</span>}
                  </p>
                </div>
              </div>

              {/* Formatting sheet */}
              <div className="flex-shrink-0 rounded-t-3xl bg-[#1a1a1a]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                {/* Icon row */}
                <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-3">
                  {/* Toggle keyboard/font-grid */}
                  <button type="button"
                    onClick={() => {
                      if (showFontGrid) { setShowFontGrid(false); setTimeout(() => textInputRef.current?.focus(), 50); }
                      else { setShowFontGrid(true); textInputRef.current?.blur(); }
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${!showFontGrid ? "bg-white/20" : "bg-white/8"}`}
                  >⌨️</button>

                  {/* Aa — open font grid */}
                  <button type="button" onClick={() => { setShowFontGrid(true); textInputRef.current?.blur(); }}
                    className={`rounded-xl px-3 py-2 text-sm font-bold ${showFontGrid ? "bg-white text-black" : "bg-white/15"}`}>
                    Aa
                  </button>

                  {/* Color */}
                  <label className="cursor-pointer">
                    <div className="h-8 w-8 rounded-full border-2 border-white/60 overflow-hidden" style={{ background: "conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)" }} />
                    <input type="color" value={editObj.color} onChange={(e) => setObjectField(editingTextId, "color", e.target.value)} className="sr-only" />
                  </label>

                  {/* Font size */}
                  <button type="button" onClick={() => setObjectField(editingTextId, "fontSize", clamp(editObj.fontSize - 2, 12, 72))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-base font-bold">A-</button>
                  <button type="button" onClick={() => setObjectField(editingTextId, "fontSize", clamp(editObj.fontSize + 2, 12, 72))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">A+</button>

                  {/* Align */}
                  <button type="button"
                    onClick={() => {
                      const a = ["left","center","right"];
                      const cur = editObj.textAlign || "center";
                      setObjectField(editingTextId, "textAlign", a[(a.indexOf(cur) + 1) % a.length]);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-base">
                    {editObj.textAlign === "left" ? "⬅" : editObj.textAlign === "right" ? "➡" : "↔"}
                  </button>

                  {/* Delete */}
                  <button type="button" onClick={() => { deleteActiveObject(); setEditingTextId(null); }}
                    className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/25 text-rose-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Font grid OR textarea */}
                {showFontGrid ? (
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {FONT_STYLES.map((fs) => (
                      <button key={fs.id} type="button"
                        onClick={() => setObjectField(editingTextId, "fontStyle", fs.id)}
                        className={`rounded-2xl px-4 py-3.5 text-sm text-white transition-all ${editObj.fontStyle === fs.id ? "border border-white bg-white/20" : "bg-white/8"}`}
                        style={fs.css}>
                        {fs.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    ref={textInputRef}
                    autoFocus
                    value={editObj.value || ""}
                    onChange={(e) => setObjectField(editingTextId, "value", e.target.value)}
                    placeholder="Írj szöveget..."
                    rows={3}
                    className="w-full resize-none bg-transparent px-4 py-3 text-[16px] text-white placeholder:text-white/35 outline-none"
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* ── MUSIC BOTTOM SHEET ── */}
        {showMusicSheet && (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowMusicSheet(false)} />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-[#1a1a1a] text-white" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>

              {/* Handle */}
              <div className="mx-auto mt-3 mb-1 h-1 w-10 flex-shrink-0 rounded-full bg-white/25" />

              {/* Mini preview */}
              <div className="flex flex-shrink-0 justify-center px-4 py-3">
                <div className="aspect-[9/16] w-16 overflow-hidden rounded-2xl" style={activeBackgroundStyle}>
                  {backgroundMode === "image" && coverImageDataUrl && (
                    <img src={coverImageDataUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              </div>

              {/* Search + Import */}
              <div className="flex flex-shrink-0 gap-2 px-4 pb-3">
                <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/10 px-4 py-3">
                  <span className="text-white/40 text-sm">🔍</span>
                  <input
                    value={musicTrack}
                    onChange={(e) => setMusicTrack(e.target.value)}
                    placeholder="Keresés..."
                    className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none"
                  />
                  {musicTrack && (
                    <button type="button" onClick={() => setMusicTrack("")} className="text-white/40"><X className="h-4 w-4" /></button>
                  )}
                </div>
                <button type="button" className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold whitespace-nowrap">
                  <Music2 className="h-4 w-4" />Importálás
                </button>
              </div>

              {/* Category pills */}
              <div className="flex flex-shrink-0 gap-2 overflow-x-auto px-4 pb-3">
                {["Neked","Népszerű","Eredeti hang","Mentve","Jogdíjmentes"].map((cat, i) => (
                  <button key={cat} type="button"
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${i === 0 ? "bg-white text-black" : "bg-white/10"}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Artist input */}
              <div className="flex-shrink-0 px-4 pb-3">
                <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Music2 className="h-5 w-5 text-white/50" />
                  </div>
                  <input value={musicArtist} onChange={(e) => setMusicArtist(e.target.value)}
                    placeholder="Előadó neve..."
                    className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none" />
                </div>
              </div>

              {/* Song list */}
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                <p className="mb-2 text-xs font-semibold text-white/40 uppercase tracking-wider">Hangulat szerint</p>
                {[
                  { title: "Energikus pop",  artist: "Vegyes előadók",    bg: GENERATED_BACKGROUNDS.sunrise },
                  { title: "Nyugodt ambient",artist: "Relaxációs zene",   bg: GENERATED_BACKGROUNDS.mint },
                  { title: "Motiváló rock",  artist: "Workout mix",       bg: GENERATED_BACKGROUNDS.steel },
                  { title: "Magyar pop",     artist: "Hazai előadók",     bg: GENERATED_BACKGROUNDS.aurora },
                  { title: "Elektronikus",   artist: "Dance & EDM",       bg: GENERATED_BACKGROUNDS.steel },
                  { title: "Klasszikus",     artist: "Instrumentális",    bg: GENERATED_BACKGROUNDS.mint },
                ].map((song) => (
                  <button key={song.title} type="button"
                    onClick={() => { setMusicTrack(song.title); setMusicArtist(song.artist); }}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 active:bg-white/10">
                    <div className="h-12 w-12 flex-shrink-0 rounded-xl" style={{ background: song.bg }} />
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-semibold ${musicTrack === song.title ? "text-emerald-400" : "text-white"}`}>{song.title}</p>
                      <p className="text-xs text-white/50">{song.artist} · Reels-videó</p>
                    </div>
                    <span className="text-white/25 text-lg">🔖</span>
                  </button>
                ))}
              </div>

              {/* Confirm */}
              {(musicTrack || musicArtist) && (
                <div className="flex-shrink-0 border-t border-white/10 px-4 py-3">
                  <button type="button" onClick={() => setShowMusicSheet(false)}
                    className="w-full rounded-2xl bg-white py-3 text-sm font-bold text-black">
                    „{musicTrack || musicArtist}" hozzáadása
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PUBLISH SCREEN ── */}
        {showPublishScreen && (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-white">
            <div className="mx-auto max-w-xl px-4 pb-28 pt-4">
              <div className="mb-4 flex items-center justify-between">
                <button type="button" onClick={() => setShowPublishScreen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Kampány előnézet</h2>
                <div className="w-11" />
              </div>

              <div className="mb-6 rounded-[28px] bg-black p-3 text-white">
                <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[22px]" style={activeBackgroundStyle}>
                  {backgroundMode === "image" && coverImageDataUrl ? (
                    <img src={coverImageDataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={activeBackgroundStyle} />
                  )}
                  {storyObjects.map((item) => renderStoryObject(item))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm text-slate-600">Képaláírás
                  <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200" placeholder="Képaláírás..." />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">Címkék
                    <input value={postTags} onChange={(e) => setPostTags(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-blue-200" placeholder="kampany, patika" />
                  </label>
                  <label className="text-sm text-slate-600">Hely
                    <input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-blue-200" placeholder="Budapest" />
                  </label>
                </div>
                <label className="block text-sm text-slate-600">Láthatóság
                  <select value={postVisibility} onChange={(e) => setPostVisibility(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none">
                    <option value="followers">Követők</option>
                    <option value="public">Nyilvános</option>
                    <option value="private">Privát</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <div className="mx-auto flex w-full max-w-xl gap-3">
                <button type="button" onClick={() => setShowPublishScreen(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700">Piszkozat</button>
                <button type="button" onClick={handleSubmit} disabled={submitting || uploadingImage}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                  {submitting ? "Mentés..." : "Megosztás"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

