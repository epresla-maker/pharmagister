"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const GENERATED_BACKGROUNDS = {
  aurora: "linear-gradient(145deg,#0f766e 0%,#1d4ed8 45%,#7c3aed 100%)",
  sunrise: "linear-gradient(145deg,#f97316 0%,#ef4444 45%,#7c2d12 100%)",
  mint: "linear-gradient(145deg,#064e3b 0%,#10b981 45%,#99f6e4 100%)",
  steel: "linear-gradient(145deg,#0f172a 0%,#334155 45%,#94a3b8 100%)",
};

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
      value: "Uj szoveg",
      x: 8,
      y: 45,
      width: 70,
      height: 12,
      fontSize: 22,
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
  const objectDragRef = useRef({
    objectId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const storyObjectsRef = useRef([]);
  const objectImageInputRef = useRef(null);

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
              .filter((item) => item && ["text", "sticker", "gif", "image"].includes(String(item.type || "")) && !["title", "message"].includes(String(item.role || "")))
              .map((item) => normalizeStoryObject(item, item.type))
          : [];
        setStoryObjects(loadedStoryObjects);
        setActiveObjectId(loadedStoryObjects[loadedStoryObjects.length - 1]?.id || null);

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
        objects: [
          {
            id: "core_title",
            type: "text",
            role: "title",
            value: title.trim(),
            x: titlePosition.x,
            y: titlePosition.y,
            width: 86,
            height: 18,
            rotation: 0,
            opacity: 1,
            scale: 1,
            fontSize: titleFontSize,
            color: titleColor,
            fontWeight: titleFontWeight,
            backgroundMode: textTransparent ? "transparent" : "box",
          },
          {
            id: "core_message",
            type: "text",
            role: "message",
            value: description.trim(),
            x: messagePosition.x,
            y: messagePosition.y,
            width: 86,
            height: 24,
            rotation: 0,
            opacity: 1,
            scale: 1,
            fontSize: messageFontSize,
            color: messageColor,
            fontWeight: messageFontWeight,
            backgroundMode: textTransparent ? "transparent" : "box",
          },
          ...storyObjects.map((item) => normalizeStoryObject(item, item.type)),
        ],
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

    return (
      <div
        key={item.id}
        data-editor-layer="true"
        onPointerDown={(event) => handleStoryObjectPointerDown(event, item.id)}
        onClick={(event) => {
          event.stopPropagation();
          setActiveObjectId(item.id);
        }}
        className={`absolute cursor-grab rounded-xl border p-2 text-left active:cursor-grabbing ${isActive ? "border-emerald-300 ring-2 ring-emerald-300/50" : "border-white/20"} ${textTransparent ? "bg-transparent" : "bg-black/40 backdrop-blur-[1px]"}`}
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
            className="whitespace-pre-wrap break-words"
            style={{ color: item.color, fontSize: `${item.fontSize}px`, fontWeight: item.fontWeight, lineHeight: 1.2 }}
          >
            {item.value || "Uj szoveg"}
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

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="text-xs text-emerald-900">
                      Háttér mód
                      <select
                        value={backgroundMode}
                        onChange={(e) => setBackgroundMode(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-emerald-200 bg-white px-2 text-sm"
                      >
                        <option value="image">Kép háttér</option>
                        <option value="color">Egyszínű háttér</option>
                        <option value="generated">Generált háttér</option>
                      </select>
                    </label>

                    {backgroundMode === "color" && (
                      <label className="text-xs text-emerald-900">
                        Háttérszín
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-emerald-200 bg-white"
                        />
                      </label>
                    )}

                    {backgroundMode === "generated" && (
                      <label className="text-xs text-emerald-900">
                        Generált stílus
                        <select
                          value={generatedBackground}
                          onChange={(e) => setGeneratedBackground(e.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-emerald-200 bg-white px-2 text-sm"
                        >
                          <option value="aurora">Aurora</option>
                          <option value="sunrise">Sunrise</option>
                          <option value="mint">Mint</option>
                          <option value="steel">Steel</option>
                        </select>
                      </label>
                    )}
                  </div>
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mr-2 text-sm font-semibold text-slate-700">2. Story objektumok</p>
                    <button type="button" onClick={() => addObject("text")} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">+ Szoveg</button>
                    <button type="button" onClick={() => addObject("sticker")} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">+ Matrica</button>
                    <button type="button" onClick={() => addObject("gif")} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">+ GIF</button>
                    <button type="button" onClick={() => addObject("image")} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">+ Kép</button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => addStickerPreset("#hashtag", "info_hashtag")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">#hashtag</button>
                    <button type="button" onClick={() => addStickerPreset("@emlites", "info_mention")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">@emlites</button>
                    <button type="button" onClick={() => addStickerPreset("📍 Helyszin", "info_location")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">📍 Helyszín</button>
                    <button type="button" onClick={() => addStickerPreset("❓ Kerdes", "interactive_question")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">❓ Kérdés</button>
                    <button type="button" onClick={() => addStickerPreset("📊 Szavazas", "interactive_poll")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">📊 Szavazás</button>
                    <button type="button" onClick={() => addStickerPreset("🔗 Link", "interactive_link")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">🔗 Link</button>
                  </div>

                  {storyObjects.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500">Még nincs extra objektum. Adj hozzá szöveget, matricát vagy GIF elemet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {storyObjects.map((item, index) => {
                        const isActive = item.id === activeObjectId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveObjectId(item.id)}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${isActive ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
                          >
                            <span className="font-semibold text-slate-700">{index + 1}. {item.type.toUpperCase()}</span>
                            <span className="max-w-[170px] truncate text-slate-500">{item.value || "(ures)"}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeObject && (
                    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => moveActiveObjectLayer("down")} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Réteg le</button>
                        <button type="button" onClick={() => moveActiveObjectLayer("up")} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Réteg fel</button>
                        <button type="button" onClick={duplicateActiveObject} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Duplikálás</button>
                        <button type="button" onClick={deleteActiveObject} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600">Törlés</button>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Tartalom</label>
                        <input
                          value={activeObject.value}
                          onChange={(e) => setObjectField(activeObject.id, "value", e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          placeholder={activeObject.type === "gif" ? "GIF URL vagy cimke" : "Objektum tartalom"}
                        />
                      </div>

                      {activeObject.type === "image" && (
                        <div>
                          <button type="button" onClick={triggerObjectImagePick} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                            Kép feltöltése objektumhoz
                          </button>
                          <input ref={objectImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleObjectImagePick} />
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-slate-600">X: {Math.round(activeObject.x)}%
                          <input type="range" min="0" max="92" value={activeObject.x} onChange={(e) => setObjectField(activeObject.id, "x", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Y: {Math.round(activeObject.y)}%
                          <input type="range" min="0" max="92" value={activeObject.y} onChange={(e) => setObjectField(activeObject.id, "y", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Szélesség: {Math.round(activeObject.width)}%
                          <input type="range" min="12" max="92" value={activeObject.width} onChange={(e) => setObjectField(activeObject.id, "width", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Magasság: {Math.round(activeObject.height)}%
                          <input type="range" min="8" max="70" value={activeObject.height} onChange={(e) => setObjectField(activeObject.id, "height", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Forgatás: {Math.round(activeObject.rotation)}°
                          <input type="range" min="-180" max="180" value={activeObject.rotation} onChange={(e) => setObjectField(activeObject.id, "rotation", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Átlátszóság: {Math.round(activeObject.opacity * 100)}%
                          <input type="range" min="0.1" max="1" step="0.05" value={activeObject.opacity} onChange={(e) => setObjectField(activeObject.id, "opacity", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Skála: {activeObject.scale.toFixed(2)}
                          <input type="range" min="0.4" max="2.5" step="0.05" value={activeObject.scale} onChange={(e) => setObjectField(activeObject.id, "scale", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                        <label className="text-xs text-slate-600">Betűméret: {Math.round(activeObject.fontSize)}px
                          <input type="range" min="10" max="72" value={activeObject.fontSize} onChange={(e) => setObjectField(activeObject.id, "fontSize", Number(e.target.value))} className="mt-1 w-full" />
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-slate-600">Szín
                          <input type="color" value={activeObject.color} onChange={(e) => setObjectField(activeObject.id, "color", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200" />
                        </label>
                        <label className="text-xs text-slate-600">Vastagság
                          <select value={activeObject.fontWeight} onChange={(e) => setObjectField(activeObject.id, "fontWeight", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
                            <option value="400">Normal</option>
                            <option value="500">Felemelt</option>
                            <option value="600">Felkover</option>
                            <option value="700">Extra felkover</option>
                            <option value="800">Eros</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Interakció
                          <select value={activeObject.interactionType || "none"} onChange={(e) => setObjectField(activeObject.id, "interactionType", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
                            <option value="none">Nincs</option>
                            <option value="question">Kérdés</option>
                            <option value="poll">Szavazás</option>
                            <option value="quiz">Kvíz</option>
                            <option value="emoji_slider">Emoji csúszka</option>
                            <option value="link">Link</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Belépési animáció
                          <select value={activeObject.entryAnimation || "fade"} onChange={(e) => setObjectField(activeObject.id, "entryAnimation", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
                            <option value="fade">Megjelenés</option>
                            <option value="float_up">Felúszás</option>
                            <option value="zoom_in">Nagyítás</option>
                            <option value="slide_in">Oldalról érkezés</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Folyamatos animáció
                          <select value={activeObject.loopAnimation || "none"} onChange={(e) => setObjectField(activeObject.id, "loopAnimation", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
                            <option value="none">Nincs</option>
                            <option value="move">Mozgás</option>
                            <option value="pulse">Pulzálás</option>
                            <option value="blink">Villogás</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Kilépési animáció
                          <select value={activeObject.exitAnimation || "none"} onChange={(e) => setObjectField(activeObject.id, "exitAnimation", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
                            <option value="none">Nincs</option>
                            <option value="fade_out">Eltűnés</option>
                            <option value="shrink">Zsugorodás</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Kezdés (mp)
                          <input type="number" min="0" max="120" step="0.1" value={Math.round((activeObject.startMs || 0) / 100) / 10} onChange={(e) => setObjectField(activeObject.id, "startMs", Number(e.target.value) * 1000)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" />
                        </label>
                        <label className="text-xs text-slate-600">Vége (mp)
                          <input type="number" min="0.3" max="120" step="0.1" value={Math.round((activeObject.endMs || 15000) / 100) / 10} onChange={(e) => setObjectField(activeObject.id, "endMs", Number(e.target.value) * 1000)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">3. Zene és videó időzítés</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-slate-600">Zene címe
                      <input value={musicTrack} onChange={(e) => setMusicTrack(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" placeholder="Pl. Motivacios intro" />
                    </label>
                    <label className="text-xs text-slate-600">Előadó
                      <input value={musicArtist} onChange={(e) => setMusicArtist(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" placeholder="Pl. Pharmagister Audio" />
                    </label>
                    <label className="text-xs text-slate-600">Zene kezdés (mp)
                      <input type="number" min="0" max="120" step="0.5" value={musicStartSec} onChange={(e) => setMusicStartSec(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs text-slate-600">Zene hossz (mp)
                      <input type="number" min="3" max="30" step="0.5" value={musicDurationSec} onChange={(e) => setMusicDurationSec(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs text-slate-600">Videó kezdés (mp)
                      <input type="number" min="0" max="120" step="0.5" value={videoTrimStartSec} onChange={(e) => setVideoTrimStartSec(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs text-slate-600">Videó hossz (mp)
                      <input type="number" min="3" max="30" step="0.5" value={videoDurationSec} onChange={(e) => setVideoDurationSec(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs text-slate-600">Sebesség
                      <select value={videoSpeed} onChange={(e) => setVideoSpeed(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                        <option value={0.5}>0.5x</option>
                        <option value={0.75}>0.75x</option>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={showLyrics} onChange={(e) => setShowLyrics(e.target.checked)} /> Dalszöveg megjelenítés
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={videoMuted} onChange={(e) => setVideoMuted(e.target.checked)} /> Videó hang kikapcsolás
                    </label>
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
                    style={activeBackgroundStyle}
                  >
                    {backgroundMode === "image" && coverImageDataUrl ? (
                      <img src={coverImageDataUrl} alt="Kampany kep" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-slate-200" style={activeBackgroundStyle}>
                        Kep helye - ide kerul a kampany vizualis eleme
                      </div>
                    )}

                    {!showTextEditor && (
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

                    {storyObjects.map((item) => renderStoryObject(item))}
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
        {showFullscreenEditor && (
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
                  {backgroundMode === "image" && coverImageDataUrl ? (
                    <img src={coverImageDataUrl} alt="Kampany kep" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={activeBackgroundStyle} />
                  )}
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

                    {storyObjects.map((item) => renderStoryObject(item))}
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
