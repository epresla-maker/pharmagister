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

  const coverImageInputRef = useRef(null);

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
            /* full-screen editor — egyetlen nézet, minden panel belül */
            <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">

              {/* Top bar */}
              <div className="flex flex-shrink-0 items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
                <button type="button" onClick={() => router.push("/partner")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" aria-label="Vissza">
                  <X className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold opacity-60">{isEditMode ? "Szerkesztés" : "Új kampány"}</span>
                <button type="button" onClick={() => setShowPublishScreen(true)} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">
                  <Check className="mr-1 inline h-4 w-4" />Tovább
                </button>
              </div>

              {error && <div className="mx-4 mb-2 rounded-2xl bg-rose-900/60 px-3 py-2 text-sm text-rose-200">{error}</div>}

              {/* Preview canvas — fills remaining space */}
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div
                  ref={previewRef}
                  className="relative mx-auto h-full max-w-[440px] overflow-hidden"
                  style={activeBackgroundStyle}
                  onClick={(e) => {
                    if (e.target === previewRef.current) setActiveQuickTool("none");
                  }}
                >
                  {backgroundMode === "image" && coverImageDataUrl ? (
                    <img src={coverImageDataUrl} alt="Kampany kep" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={activeBackgroundStyle} />
                  )}

                  {/* No image placeholder */}
                  {backgroundMode === "image" && !coverImageDataUrl && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => coverImageInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 rounded-3xl bg-white/10 px-8 py-6 text-white backdrop-blur-sm"
                      >
                        <span className="text-4xl">📷</span>
                        <span className="text-sm font-semibold">Háttérkép hozzáadása</span>
                        <span className="text-xs opacity-60">Érintsd meg a feltöltéshez</span>
                      </button>
                    </div>
                  )}

                  {/* Title box */}
                  <div
                    ref={titleBoxRef}
                    data-editor-layer="true"
                    onPointerDown={(e) => handleTextPointerDown(e, "title")}
                    onClick={(e) => { e.stopPropagation(); setActiveQuickTool("text"); setActiveTextTool("title"); titleInputRef.current?.focus(); }}
                    className={`absolute w-[86%] cursor-pointer rounded-2xl border border-white/20 p-3 ${textTransparent ? "bg-transparent" : "bg-black/45 backdrop-blur-[1px]"} ${activeQuickTool === "text" && activeTextTool === "title" ? "ring-2 ring-white/60" : ""}`}
                    style={{ left: `${titlePosition.x}%`, top: `${titlePosition.y}%` }}
                  >
                    <p style={{ color: titleColor, fontSize: `${titleFontSize}px`, fontWeight: titleFontWeight, lineHeight: 1.15 }}>
                      {title.trim() || <span className="opacity-40">Cím — érintsd meg</span>}
                    </p>
                  </div>

                  {/* Message box */}
                  <div
                    ref={messageBoxRef}
                    data-editor-layer="true"
                    onPointerDown={(e) => handleTextPointerDown(e, "message")}
                    onClick={(e) => { e.stopPropagation(); setActiveQuickTool("text"); setActiveTextTool("message"); messageInputRef.current?.focus(); }}
                    className={`absolute w-[86%] cursor-pointer rounded-2xl border border-white/20 p-3 ${textTransparent ? "bg-transparent" : "bg-black/45 backdrop-blur-[1px]"} ${activeQuickTool === "text" && activeTextTool === "message" ? "ring-2 ring-white/60" : ""}`}
                    style={{ left: `${messagePosition.x}%`, top: `${messagePosition.y}%` }}
                  >
                    <p style={{ color: messageColor, fontSize: `${messageFontSize}px`, fontWeight: messageFontWeight, lineHeight: 1.3 }}>
                      {description.trim() || <span className="opacity-40">Üzenet — érintsd meg</span>}
                    </p>
                    <div className="mt-2 flex items-center justify-end border-t border-white/15 pt-2">
                      <span className="rounded-full bg-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-100">{ctaLabel.trim() || "Megnyitás"}</span>
                    </div>
                  </div>

                  {storyObjects.map((item) => renderStoryObject(item))}
                </div>
              </div>

              {/* Bottom panel — tool content + toolbar, all inside the black screen */}
              <div className="flex-shrink-0">

                {/* Tool content panel */}
                <div className={`overflow-hidden transition-all duration-300 ${activeQuickTool !== "none" ? "max-h-[55vh]" : "max-h-0"}`}>
                  <div className="overflow-y-auto border-t border-white/10 bg-[#111] px-4 pb-3 pt-4" style={{ maxHeight: "55vh" }}>

                    {activeQuickTool === "text" && (
                      <div className="space-y-3">
                        <div className="flex gap-2 pb-1">
                          <button type="button" onClick={() => { setActiveTextTool("title"); titleInputRef.current?.focus(); }} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${activeTextTool === "title" ? "bg-white text-black" : "bg-white/15"}`}>Cím</button>
                          <button type="button" onClick={() => { setActiveTextTool("message"); messageInputRef.current?.focus(); }} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${activeTextTool === "message" ? "bg-white text-black" : "bg-white/15"}`}>Üzenet</button>
                        </div>
                        {activeTextTool === "title" ? (
                          <input
                            ref={titleInputRef}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Kampány címe..."
                            className="h-12 w-full rounded-2xl bg-white/10 px-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                          />
                        ) : (
                          <textarea
                            ref={messageInputRef}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Fő üzenet..."
                            rows={3}
                            className="w-full rounded-2xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                          />
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs text-white/50">CTA felirat
                            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none" placeholder="Megnyitás" />
                          </label>
                          <label className="text-xs text-white/50">Háttér mód
                            <select value={backgroundMode} onChange={(e) => setBackgroundMode(e.target.value)} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-2 text-sm text-white focus:outline-none">
                              <option value="image">Kép</option>
                              <option value="color">Szín</option>
                              <option value="generated">Gradiens</option>
                            </select>
                          </label>
                        </div>
                        {backgroundMode === "generated" && (
                          <div className="flex gap-2">
                            {Object.keys(GENERATED_BACKGROUNDS).map((key) => (
                              <button key={key} type="button" onClick={() => setGeneratedBackground(key)} className={`h-9 flex-1 rounded-xl text-xs font-semibold capitalize ${generatedBackground === key ? "ring-2 ring-white" : ""}`} style={{ background: GENERATED_BACKGROUNDS[key] }}>{key}</button>
                            ))}
                          </div>
                        )}
                        {backgroundMode === "color" && (
                          <label className="flex items-center gap-3 text-xs text-white/50">Háttérszín
                            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded-lg border-0 bg-transparent" />
                          </label>
                        )}
                        <label className="flex items-center gap-2 text-xs text-white/50">
                          <input type="checkbox" checked={textTransparent} onChange={(e) => setTextTransparent(e.target.checked)} className="h-4 w-4 rounded" />
                          Átlátszó szövegdoboz
                        </label>
                      </div>
                    )}

                    {activeQuickTool === "audio" && (
                      <div className="grid grid-cols-2 gap-3">
                        <label className="col-span-2 text-xs text-white/50">Zene neve
                          <input value={musicTrack} onChange={(e) => setMusicTrack(e.target.value)} placeholder="pl. Imagine - John Lennon" className="mt-1 h-11 w-full rounded-xl bg-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30" />
                        </label>
                        <label className="text-xs text-white/50">Előadó
                          <input value={musicArtist} onChange={(e) => setMusicArtist(e.target.value)} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none" />
                        </label>
                        <label className="text-xs text-white/50">Kezdés (mp)
                          <input type="number" min="0" max="120" step="0.5" value={musicStartSec} onChange={(e) => setMusicStartSec(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none" />
                        </label>
                        <label className="text-xs text-white/50">Hossz (mp)
                          <input type="number" min="3" max="30" step="0.5" value={musicDurationSec} onChange={(e) => setMusicDurationSec(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none" />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-white/50">
                          <input type="checkbox" checked={showLyrics} onChange={(e) => setShowLyrics(e.target.checked)} className="h-4 w-4 rounded" />
                          Szöveg mutatása
                        </label>
                      </div>
                    )}

                    {activeQuickTool === "layers" && (
                      <div className="space-y-4">
                        {/* Background image upload — prominent */}
                        <div>
                          <p className="mb-2 text-xs font-semibold text-white/50">HÁTTÉRKÉP</p>
                          <button
                            type="button"
                            onClick={() => coverImageInputRef.current?.click()}
                            className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white active:bg-white/20"
                          >
                            <span className="text-2xl">📷</span>
                            {coverImageDataUrl ? "Csere — új kép választása" : "Háttérkép feltöltése"}
                          </button>
                          {uploadingImage && <p className="mt-1 text-xs text-white/50">Feltöltés...</p>}
                        </div>
                        {/* Extra objects */}
                        <div>
                          <p className="mb-2 text-xs font-semibold text-white/50">RÉTEGEK HOZZÁADÁSA</p>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => addObject("text")} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold active:bg-white/20">＋ Szöveg</button>
                            <button type="button" onClick={() => addObject("sticker")} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold active:bg-white/20">＋ Matrica</button>
                            <button type="button" onClick={() => { addObject("image"); objectImageInputRef.current?.click(); }} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold active:bg-white/20">＋ Kép</button>
                          </div>
                        </div>
                        {/* Active object controls */}
                        {activeObjectId && (() => {
                          const obj = storyObjects.find(o => o.id === activeObjectId);
                          if (!obj) return null;
                          return (
                            <div className="space-y-2 rounded-2xl bg-white/5 p-3">
                              <p className="text-xs font-semibold text-white/50">KIVÁLASZTOTT RÉTEG</p>
                              {obj.type === "text" && (
                                <input value={obj.content ?? ""} onChange={(e) => setObjectField(activeObjectId, "content", e.target.value)} className="h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none" placeholder="Szöveg..." />
                              )}
                              <div className="flex gap-2">
                                <button type="button" onClick={duplicateActiveObject} className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-semibold active:bg-white/20">Másolat</button>
                                <button type="button" onClick={deleteActiveObject} className="flex-1 rounded-xl bg-rose-500/30 py-2 text-xs font-semibold text-rose-300 active:bg-rose-500/50">Törlés</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeQuickTool === "publish" && (
                      <div className="space-y-3">
                        <label className="block text-xs text-white/50">Képaláírás
                          <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)} rows={3} className="mt-1 w-full rounded-2xl bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none" placeholder="Képaláírás..." />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs text-white/50">Címkék
                            <input value={postTags} onChange={(e) => setPostTags(e.target.value)} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none" placeholder="kampany, nyitas" />
                          </label>
                          <label className="text-xs text-white/50">Hely
                            <input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none" placeholder="Budapest" />
                          </label>
                        </div>
                        <label className="block text-xs text-white/50">Láthatóság
                          <select value={postVisibility} onChange={(e) => setPostVisibility(e.target.value)} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white focus:outline-none">
                            <option value="followers">Követők</option>
                            <option value="public">Nyilvános</option>
                            <option value="private">Privát</option>
                          </select>
                        </label>
                        <button type="button" onClick={() => setShowPublishScreen(true)} className="mt-2 w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold">Előnézet és közzétevés</button>
                      </div>
                    )}

                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex gap-2 overflow-x-auto px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  <button type="button" onClick={() => setActiveQuickTool((p) => p === "audio" ? "none" : "audio")} className={`flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-semibold transition-all ${activeQuickTool === "audio" ? "bg-white text-black" : "bg-white/15 text-white"}`}>
                    <Music2 className="h-4 w-4" />Hang
                  </button>
                  <button type="button" onClick={() => setActiveQuickTool((p) => p === "text" ? "none" : "text")} className={`flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-semibold transition-all ${activeQuickTool === "text" ? "bg-white text-black" : "bg-white/15 text-white"}`}>
                    <Type className="h-4 w-4" />Szöveg
                  </button>
                  <button type="button" onClick={() => setActiveQuickTool((p) => p === "layers" ? "none" : "layers")} className={`flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-semibold transition-all ${activeQuickTool === "layers" ? "bg-white text-black" : "bg-white/15 text-white"}`}>
                    <Layers className="h-4 w-4" />Rétegek
                  </button>
                  <button type="button" onClick={() => setActiveQuickTool((p) => p === "publish" ? "none" : "publish")} className={`flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-semibold transition-all ${activeQuickTool === "publish" ? "bg-white text-black" : "bg-white/15 text-white"}`}>
                    <Captions className="h-4 w-4" />Poszt
                  </button>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input ref={coverImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              <input ref={objectImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleObjectImagePick} />
            </div>
          )}

        {showPublishScreen && (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-white">
            <div className="mx-auto max-w-xl px-4 pb-28 pt-4">
              <div className="mb-4 flex items-center justify-between">
                <button type="button" onClick={() => setShowPublishScreen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Új videó előnézet</h2>
                <div className="w-11" />
              </div>

              <div className="mb-6 rounded-[28px] bg-black p-3 text-white">
                <div className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[22px]" style={activeBackgroundStyle}>
                  {backgroundMode === "image" && coverImageDataUrl ? (
                    <img src={coverImageDataUrl} alt="Kampany kep" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" style={activeBackgroundStyle} />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm text-slate-600">Képaláírás
                  <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Képaláírás..." />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">Címkék
                    <input value={postTags} onChange={(e) => setPostTags(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3" placeholder="kampany, patika" />
                  </label>
                  <label className="text-sm text-slate-600">Hely
                    <input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3" placeholder="Budapest" />
                  </label>
                </div>

                <label className="block text-sm text-slate-600">Láthatóság
                  <select value={postVisibility} onChange={(e) => setPostVisibility(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3">
                    <option value="followers">Követők</option>
                    <option value="public">Nyilvános</option>
                    <option value="private">Privát</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
              <div className="mx-auto flex w-full max-w-xl gap-3">
                <button type="button" onClick={() => setShowPublishScreen(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700">Piszkozat</button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || uploadingImage}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                >
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
