"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RouteGuard from "../../components/RouteGuard";
import ReportModal from "../../components/ReportModal";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { db } from "../../../lib/firebase";
import { getEffectivePharmagisterRole } from "../../../lib/pharmagisterProfile";
import { isDocInMarket } from "../../../lib/market";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  ChevronsUpDown,
  ClipboardList,
  FlaskConical,
  Heart,
  Loader2,
  MapPin,
  MonitorSmartphone,
  Package,
  Search,
  ShieldAlert,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Tag,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";

type ListingStatus = "approved" | "pending" | "rejected" | "sold" | "expired" | "draft";
type SortOption = "legfrissebb" | "regebbi" | "legalacsonyabb_ar" | "legmagasabb_ar" | "legnezettebb" | "legkedveltebb";
type ConditionOption = "new" | "used" | "refurbished";
type ViewMode = "eladas" | "neked" | "helyi" | "kategoriak" | "kedvencek";
type MyListingTab = "aktiv" | "fuggoben" | "eladva" | "piszkozat" | "lejart";
type ListingFeedMode = "osszes" | "legfrissebb";

type MarketplaceListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  equipmentCategory?: string;
  price?: number | null;
  priceAmount?: number | null;
  priceType?: "fixed" | "negotiable";
  negotiable?: boolean;
  condition: ConditionOption;
  location: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  sellerId: string;
  userId?: string;
  sellerName: string;
  sellerType?: string;
  images: string[];
  imageUrl?: string | null;
  tags: string[];
  createdAt?: any;
  updatedAt?: any;
  expiresAt?: any;
  featured?: boolean;
  verified?: boolean;
  status?: ListingStatus;
  views?: number;
  favorites?: number;
  contactPhone?: string;
  chatEnabled?: boolean;
  market?: string;
  authorData?: {
    displayName?: string;
    photoURL?: string | null;
    email?: string | null;
  };
};

type ComposerDraft = {
  title: string;
  description: string;
  category: string;
  price: string;
  negotiable: boolean;
  condition: ConditionOption;
  location: string;
  contactPhone: string;
  chatEnabled: boolean;
  tags: string;
};

type ReportData = {
  reportType: string;
  reportedUserId: string;
  reportedUserName: string;
  itemId: string;
  itemContent: string;
};

type CategoryDef = {
  id: string;
  label: string;
  color: string;
  placeholder: string;
  icon: ComponentType<{ className?: string }>;
};

const PAGE_SIZE = 20;
const MAX_IMAGES = 15;
const FAVORITES_STORAGE_KEY = "pharmagister_piacter_kedvencek";
const RECENT_SEARCHES_STORAGE_KEY = "pharmagister_piacter_utolso_keresesek";
const DRAFT_STORAGE_KEY = "pharmagister_piacter_piszkozat";
const ADMIN_EMAILS = new Set(["epresla@icloud.com", "etinatina22@gmail.com"]);

const CATEGORY_DEFS: CategoryDef[] = [
  { id: "pharmacy_equipment", label: "Gyógyszertári eszközök", color: "bg-emerald-100 text-emerald-700", placeholder: "Polc, tároló, pult", icon: Package },
  { id: "refrigeration", label: "Hűtéstechnika", color: "bg-cyan-100 text-cyan-700", placeholder: "Gyógyszerhűtő, hűtőszekrény", icon: Sparkles },
  { id: "medical_devices", label: "Orvostechnikai eszközök", color: "bg-blue-100 text-blue-700", placeholder: "Mérőműszer, diagnosztika", icon: Stethoscope },
  { id: "it_equipment", label: "IT eszközök", color: "bg-indigo-100 text-indigo-700", placeholder: "PC, monitor, nyomtató", icon: MonitorSmartphone },
  { id: "office_equipment", label: "Irodai eszközök", color: "bg-amber-100 text-amber-700", placeholder: "Irodatechnika", icon: ClipboardList },
  { id: "furniture", label: "Bútor", color: "bg-orange-100 text-orange-700", placeholder: "Szék, asztal, pult", icon: Building2 },
  { id: "laboratory_equipment", label: "Laborfelszerelés", color: "bg-violet-100 text-violet-700", placeholder: "Labor és mintakezelés", icon: FlaskConical },
  { id: "books", label: "Könyvek", color: "bg-lime-100 text-lime-700", placeholder: "Szakmai könyvek", icon: Tag },
  { id: "work_clothing", label: "Munkaruházat", color: "bg-rose-100 text-rose-700", placeholder: "Köpeny, védőruha", icon: Shirt },
  { id: "services", label: "Szolgáltatások", color: "bg-teal-100 text-teal-700", placeholder: "Karbantartás, szerviz", icon: Wrench },
  { id: "pharmacy_business", label: "Gyógyszertári üzlet", color: "bg-fuchsia-100 text-fuchsia-700", placeholder: "Üzleti ajánlatok", icon: Store },
  { id: "wanted", label: "Keresem", color: "bg-yellow-100 text-yellow-700", placeholder: "Keresett eszköz", icon: Search },
  { id: "other", label: "Egyéb", color: "bg-gray-100 text-gray-700", placeholder: "Minden más", icon: ChevronsUpDown },
];

const CONDITION_OPTIONS: Array<{ id: ConditionOption; label: string }> = [
  { id: "new", label: "Új" },
  { id: "used", label: "Használt" },
  { id: "refurbished", label: "Felújított" },
];

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: "legfrissebb", label: "Legfrissebb" },
  { id: "regebbi", label: "Legrégebbi" },
  { id: "legalacsonyabb_ar", label: "Legalacsonyabb ár" },
  { id: "legmagasabb_ar", label: "Legmagasabb ár" },
  { id: "legnezettebb", label: "Legnézettebb" },
  { id: "legkedveltebb", label: "Legkedveltebb" },
];

const POPULAR_SEARCHES = ["hűtő", "mérleg", "pénztárgép", "monitor", "köpeny", "labor"];

const FORBIDDEN_KEYWORDS = [
  "receptkoteles",
  "vényköteles",
  "venykoteles",
  "gyogyszer elado",
  "gyógyszer eladó",
  "ampulla",
  "tabletta",
  "inzulin",
  "betegadat",
  "tajszam",
  "taj szám",
];

function normalizeText(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatHuDate(ts: any): string {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatHuDateTime(ts: any): string {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHuPrice(value: number | null | undefined, negotiable?: boolean): string {
  if (negotiable || value == null || Number.isNaN(Number(value))) return "Megegyezés szerint";
  return `${Number(value).toLocaleString("hu-HU")} Ft`;
}

function getCategoryLabel(categoryId?: string): string {
  return CATEGORY_DEFS.find((c) => c.id === categoryId)?.label || "Egyéb";
}

function getCategoryColor(categoryId?: string): string {
  return CATEGORY_DEFS.find((c) => c.id === categoryId)?.color || "bg-gray-100 text-gray-700";
}

function getConditionLabel(condition: string): string {
  return CONDITION_OPTIONS.find((c) => c.id === condition)?.label || "Nincs megadva";
}

function getStatusLabel(status?: ListingStatus): string {
  if (status === "approved") return "Aktív";
  if (status === "pending") return "Függőben";
  if (status === "rejected") return "Elutasítva";
  if (status === "sold") return "Eladva";
  if (status === "expired") return "Lejárt";
  return "Piszkozat";
}

function getStatusClass(status?: ListingStatus): string {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  if (status === "sold") return "bg-blue-100 text-blue-700";
  if (status === "expired") return "bg-gray-200 text-gray-700";
  return "bg-slate-100 text-slate-700";
}

async function compressImage(file: File, maxWidth = 1800, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

function mapFirestoreDoc(id: string, raw: any): MarketplaceListing {
  const priceFromLegacy = raw.priceAmount ?? raw.price ?? null;
  const category = raw.category || raw.equipmentCategory || "other";
  const sellerId = raw.sellerId || raw.userId || "";
  const sellerName =
    raw.sellerName ||
    raw.authorData?.displayName ||
    "Felhasználó";

  return {
    id,
    title: raw.title || "Névtelen hirdetés",
    description: raw.description || "",
    category,
    equipmentCategory: raw.equipmentCategory,
    price: typeof raw.price === "number" ? raw.price : priceFromLegacy,
    priceAmount: typeof raw.priceAmount === "number" ? raw.priceAmount : priceFromLegacy,
    priceType: raw.priceType || (raw.negotiable ? "negotiable" : "fixed"),
    negotiable: Boolean(raw.negotiable) || raw.priceType === "negotiable",
    condition: raw.condition || "used",
    location: raw.location || raw.city || "Nincs megadva",
    city: raw.city || raw.location,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    sellerId,
    userId: raw.userId || raw.sellerId,
    sellerName,
    sellerType: raw.sellerType || raw.pharmaRole || "szakmai",
    images: Array.isArray(raw.images)
      ? raw.images.filter(Boolean)
      : raw.imageUrl
      ? [raw.imageUrl]
      : [],
    imageUrl: raw.imageUrl || null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    expiresAt: raw.expiresAt,
    featured: Boolean(raw.featured),
    verified: Boolean(raw.verified),
    status: (raw.status || "pending") as ListingStatus,
    views: Number(raw.views || 0),
    favorites: Number(raw.favorites || 0),
    contactPhone: raw.contactPhone || "",
    chatEnabled: raw.chatEnabled !== false,
    market: raw.market,
    authorData: raw.authorData || {},
  };
}

function ListingSkeleton({ darkMode }: { darkMode: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border animate-pulse ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className={`h-44 rounded-xl ${darkMode ? "bg-gray-700" : "bg-gray-100"}`} />
      <div className="mt-3 space-y-2">
        <div className={`h-4 w-3/4 rounded ${darkMode ? "bg-gray-700" : "bg-gray-100"}`} />
        <div className={`h-4 w-1/2 rounded ${darkMode ? "bg-gray-700" : "bg-gray-100"}`} />
        <div className={`h-4 w-2/3 rounded ${darkMode ? "bg-gray-700" : "bg-gray-100"}`} />
      </div>
    </div>
  );
}

export default function EszkozPiacterPage() {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();

  const role = getEffectivePharmagisterRole(userData);
  const canUseMarketplace = Boolean(role);
  const isAdmin = ADMIN_EMAILS.has(String(user?.email || "").toLowerCase());
  const userLocation = [
    userData?.pharmacyZipCode,
    userData?.pharmacyCity,
    userData?.pharmacyStreet,
    userData?.city,
    userData?.zipCode,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("neked");
  const [myTab, setMyTab] = useState<MyListingTab>("aktiv");

  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withImagesOnly, setWithImagesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("legfrissebb");
  const [listingFeedMode, setListingFeedMode] = useState<ListingFeedMode>("osszes");
  const [showFilters, setShowFilters] = useState(false);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const [draft, setDraft] = useState<ComposerDraft>({
    title: "",
    description: "",
    category: "pharmacy_equipment",
    price: "",
    negotiable: false,
    condition: "used",
    location: "",
    contactPhone: "",
    chatEnabled: true,
    tags: "",
  });

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const lastDocRef = useRef<any>(null);
  const viewedOnceRef = useRef<Set<string>>(new Set());

  const resetComposer = useCallback(() => {
    setDraft({
      title: "",
      description: "",
      category: "pharmacy_equipment",
      price: "",
      negotiable: false,
      condition: "used",
      location: "",
      contactPhone: "",
      chatEnabled: true,
      tags: "",
    });
    setExistingImages([]);
    setNewImages([]);
    setNewImagePreviews([]);
    setEditingId(null);
    setComposerError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

  const fetchListings = useCallback(
    async (afterDoc: any = null) => {
      if (!user || !canUseMarketplace) return;

      try {
        const constraints: any[] = [orderBy("createdAt", "desc"), limit(PAGE_SIZE)];
        if (afterDoc) constraints.splice(1, 0, startAfter(afterDoc));

        const snap = await getDocs(query(collection(db, "equipmentMarketplacePosts"), ...constraints));
        const mapped = snap.docs
          .map((d) => mapFirestoreDoc(d.id, d.data()))
          .filter((entry) => {
            if (!isDocInMarket(entry as any, "hu")) return false;
            if (isAdmin) return true;
            return entry.status === "approved" || entry.sellerId === user.uid;
          });

        if (snap.docs.length > 0) {
          lastDocRef.current = snap.docs[snap.docs.length - 1];
        }

        setHasMore(snap.docs.length >= PAGE_SIZE);
        setItems((prev) => {
          const base = afterDoc ? [...prev] : [];
          const map = new Map(base.map((item) => [item.id, item]));
          mapped.forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        });
      } catch (err) {
        console.error("Piactér lekérdezési hiba:", err);
        setErrorText("Hiba történt a Piactér adatok betöltése közben.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [user, canUseMarketplace, isAdmin]
  );

  const reloadAll = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    setHasMore(true);
    lastDocRef.current = null;
    await fetchListings(null);
  }, [fetchListings]);

  useEffect(() => {
    const savedFav = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (savedFav) {
      try {
        setFavoriteIds(new Set(JSON.parse(savedFav)));
      } catch {
        setFavoriteIds(new Set());
      }
    }

    const savedRecent = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (savedRecent) {
      try {
        setRecentSearches(JSON.parse(savedRecent));
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchInput.trim());
    }, 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!showComposer) return;
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setDraft((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore parse error
      }
    }
  }, [showComposer]);

  useEffect(() => {
    if (!showComposer) return;
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft, showComposer]);

  useEffect(() => {
    const previews = newImages.map((file) => URL.createObjectURL(file));
    setNewImagePreviews(previews);

    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newImages]);

  useEffect(() => {
    if (!user || !canUseMarketplace) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setItems([]);
    setErrorText("");
    setHasMore(true);
    lastDocRef.current = null;
    fetchListings(null);
  }, [user, canUseMarketplace, fetchListings]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          setLoadingMore(true);
          fetchListings(lastDocRef.current);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchListings, hasMore, loading, loadingMore]);

  useEffect(() => {
    let startY = 0;
    let pulling = false;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 0 && window.scrollY <= 0) {
        setPullDistance(Math.min(120, diff));
      }
    };

    const onTouchEnd = () => {
      if (pullDistance > 80 && !refreshing) {
        reloadAll();
      }
      setPullDistance(0);
      pulling = false;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshing, reloadAll]);

  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    CATEGORY_DEFS.forEach((cat) => map.set(cat.id, 0));
    items.forEach((item) => {
      const key = item.category || "other";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [items]);

  const ownedListings = useMemo(
    () => items.filter((item) => item.sellerId === user?.uid),
    [items, user?.uid]
  );

  const ownedListingStats = useMemo(() => {
    const active = ownedListings.filter((item) => item.status === "approved").length;
    const pending = ownedListings.filter((item) => item.status === "pending").length;
    const sold = ownedListings.filter((item) => item.status === "sold").length;
    const drafts = ownedListings.filter((item) => item.status === "draft").length;
    return { active, pending, sold, drafts, total: ownedListings.length };
  }, [ownedListings]);

  const categoryGroups = useMemo(() => {
    return CATEGORY_DEFS.map((cat) => ({
      ...cat,
      count: categoryCountMap.get(cat.id) || 0,
    })).filter((cat) => cat.count > 0 || selectedCategory === cat.id);
  }, [categoryCountMap, selectedCategory]);

  const searchSuggestions = useMemo(() => {
    const q = normalizeText(searchInput);
    if (!q) return [];

    const pool = new Set<string>();
    items.forEach((item) => {
      const title = item.title?.trim();
      const location = item.location?.trim();
      const seller = item.sellerName?.trim();
      if (title) pool.add(title);
      if (location) pool.add(location);
      if (seller) pool.add(seller);
    });

    return Array.from(pool)
      .filter((value) => normalizeText(value).includes(q))
      .slice(0, 8);
  }, [items, searchInput]);

  const visibleListings = useMemo(() => {
    const q = normalizeText(searchDebounced);

    let filtered = items.filter((item) => {
      if (item.status === "rejected" && !isAdmin && item.sellerId !== user?.uid) return false;

      const haystack = normalizeText(
        `${item.title} ${item.description} ${item.sellerName} ${item.location} ${getCategoryLabel(item.category)}`
      );
      if (q && !haystack.includes(q)) return false;

      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (selectedCondition !== "all" && item.condition !== selectedCondition) return false;
      if (featuredOnly && !item.featured) return false;
      if (verifiedOnly && !item.verified) return false;
      if (withImagesOnly && item.images.length === 0) return false;

      const locQuery = normalizeText(filterLocation);
      if (locQuery && !normalizeText(item.location).includes(locQuery)) return false;

      const numericPrice = item.negotiable ? null : Number(item.priceAmount ?? item.price ?? 0);
      if (minPrice && numericPrice != null && numericPrice < Number(minPrice)) return false;
      if (maxPrice && numericPrice != null && numericPrice > Number(maxPrice)) return false;

      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "legfrissebb") {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return db - da;
      }
      if (sortBy === "regebbi") {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return da - db;
      }
      if (sortBy === "legalacsonyabb_ar") {
        return Number(a.priceAmount ?? a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.priceAmount ?? b.price ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortBy === "legmagasabb_ar") {
        return Number(b.priceAmount ?? b.price ?? 0) - Number(a.priceAmount ?? a.price ?? 0);
      }
      if (sortBy === "legnezettebb") {
        return Number(b.views || 0) - Number(a.views || 0);
      }
      return Number(b.favorites || 0) - Number(a.favorites || 0);
    });

    return filtered;
  }, [
    items,
    searchDebounced,
    selectedCategory,
    selectedCondition,
    featuredOnly,
    verifiedOnly,
    withImagesOnly,
    filterLocation,
    minPrice,
    maxPrice,
    sortBy,
    isAdmin,
    user?.uid,
  ]);

  const featuredListings = useMemo(
    () => visibleListings.filter((item) => item.featured).slice(0, 10),
    [visibleListings]
  );

  const localListings = useMemo(() => {
    const locationQuery = normalizeText(userLocation);
    if (!locationQuery) return visibleListings.slice(0, 16);

    const matched = visibleListings.filter((item) => {
      const haystack = normalizeText(`${item.location} ${item.city} ${item.description} ${item.title}`);
      return haystack.includes(locationQuery) || locationQuery.includes(normalizeText(item.location));
    });

    return (matched.length > 0 ? matched : visibleListings).slice(0, 16);
  }, [userLocation, visibleListings]);

  const recommendedListings = useMemo(() => {
    const favoriteCategories = new Set(
      visibleListings
        .filter((item) => favoriteIds.has(item.id))
        .map((item) => item.category || "other")
    );

    const preferred = visibleListings.filter((item) => favoriteCategories.has(item.category || "other"));
    const pool = preferred.length > 0 ? preferred : featuredListings.length > 0 ? featuredListings : visibleListings;
    return pool.slice(0, 12);
  }, [favoriteIds, featuredListings, visibleListings]);

  const latestListings = useMemo(
    () => [...visibleListings].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 8),
    [visibleListings]
  );

  const activeFeedListings = listingFeedMode === "legfrissebb" ? latestListings : visibleListings;

  const myListingsFiltered = useMemo(() => {
    if (myTab === "aktiv") return ownedListings.filter((item) => item.status === "approved");
    if (myTab === "fuggoben") return ownedListings.filter((item) => item.status === "pending");
    if (myTab === "eladva") return ownedListings.filter((item) => item.status === "sold");
    if (myTab === "lejart") return ownedListings.filter((item) => item.status === "expired");
    return [];
  }, [myTab, ownedListings]);

  const favoriteListings = useMemo(
    () => visibleListings.filter((item) => favoriteIds.has(item.id)),
    [favoriteIds, visibleListings]
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!draft.title.trim()) errors.push("A cím megadása kötelező.");
    if (!draft.description.trim()) errors.push("A leírás megadása kötelező.");
    if (!draft.location.trim()) errors.push("A hely megadása kötelező.");

    if (!draft.negotiable) {
      const price = Number(draft.price || 0);
      if (!draft.price || Number.isNaN(price) || price <= 0) {
        errors.push("Érvényes ár megadása kötelező.");
      }
    }

    const blocked = FORBIDDEN_KEYWORDS.find((word) =>
      normalizeText(`${draft.title} ${draft.description}`).includes(normalizeText(word))
    );
    if (blocked) {
      errors.push(`Tiltott kifejezést tartalmaz a szöveg: ${blocked}`);
    }

    return errors;
  }, [draft, existingImages.length, newImages.length]);

  const onChooseImages = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const available = MAX_IMAGES - (existingImages.length + newImages.length);

    if (available <= 0) {
      setComposerError(`Maximum ${MAX_IMAGES} kép tölthető fel.`);
      return;
    }

    const selected = incoming.slice(0, available);
    setComposerError("");
    setNewImages((prev) => [...prev, ...selected]);
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const reorderNewImages = (from: number, to: number) => {
    if (from === to) return;
    setNewImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const toggleFavorite = async (item: MarketplaceListing) => {
    const next = new Set(favoriteIds);
    const currentlyFav = next.has(item.id);

    if (currentlyFav) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }

    setFavoriteIds(next);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)));

    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", item.id), {
        favorites: increment(currentlyFav ? -1 : 1),
        updatedAt: serverTimestamp(),
      });
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, favorites: Math.max(0, Number(entry.favorites || 0) + (currentlyFav ? -1 : 1)) }
            : entry
        )
      );
    } catch (error) {
      console.error("Kedvenc frissítési hiba:", error);
    }
  };

  const openDetails = async (item: MarketplaceListing) => {
    setSelectedListing(item);
    setDetailImageIndex(0);

    if (!viewedOnceRef.current.has(item.id)) {
      viewedOnceRef.current.add(item.id);
      try {
        await updateDoc(doc(db, "equipmentMarketplacePosts", item.id), {
          views: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Megtekintés számláló hiba:", error);
      }
    }
  };

  const openChat = (item: MarketplaceListing) => {
    const recipientName = encodeURIComponent(item.sellerName || "Felhasználó");
    const recipientPhoto = encodeURIComponent(item.authorData?.photoURL || "");
    const listingId = encodeURIComponent(item.id);
    const listingTitle = encodeURIComponent(item.title || "");
    const listingPrice = encodeURIComponent(formatHuPrice(item.priceAmount ?? item.price ?? null, item.negotiable));

    router.push(
      `/chat/new?recipientId=${item.sellerId}&recipientName=${recipientName}&recipientPhoto=${recipientPhoto}&listingId=${listingId}&listingTitle=${listingTitle}&listingPrice=${listingPrice}`
    );
  };

  const addRecentSearch = (value: string) => {
    const clean = value.trim();
    if (!clean) return;

    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((s) => normalizeText(s) !== normalizeText(clean))].slice(0, 8);
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteListing = async (listingId: string) => {
    const ok = window.confirm("Biztosan törlöd ezt a hirdetést?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "equipmentMarketplacePosts", listingId));
      setItems((prev) => prev.filter((item) => item.id !== listingId));
      if (selectedListing?.id === listingId) setSelectedListing(null);
    } catch (error) {
      console.error("Hirdetés törlési hiba:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  const handleAdminStatus = async (listingId: string, status: ListingStatus) => {
    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", listingId), {
        status,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((item) => (item.id === listingId ? { ...item, status } : item)));
      if (selectedListing?.id === listingId) {
        setSelectedListing({ ...selectedListing, status });
      }
    } catch (error) {
      console.error("Moderációs hiba:", error);
    }
  };

  const handleFeatureToggle = async (listing: MarketplaceListing) => {
    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", listing.id), {
        featured: !listing.featured,
        updatedAt: serverTimestamp(),
      });

      setItems((prev) =>
        prev.map((item) =>
          item.id === listing.id ? { ...item, featured: !listing.featured } : item
        )
      );
    } catch (error) {
      console.error("Kiemelés frissítési hiba:", error);
    }
  };

  const openEdit = (item: MarketplaceListing) => {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      description: item.description,
      category: item.category || "other",
      price: item.negotiable ? "" : String(item.priceAmount ?? item.price ?? ""),
      negotiable: Boolean(item.negotiable || item.priceType === "negotiable"),
      condition: item.condition || "used",
      location: item.location || "",
      contactPhone: item.contactPhone || "",
      chatEnabled: item.chatEnabled !== false,
      tags: (item.tags || []).join(", "),
    });
    setExistingImages(item.images || []);
    setNewImages([]);
    setNewImagePreviews([]);
    setComposerError("");
    setShowComposer(true);
  };

  const openDuplicate = (item: MarketplaceListing) => {
    setEditingId(null);
    setDraft({
      title: `${item.title} (másolat)`,
      description: item.description,
      category: item.category || "other",
      price: item.negotiable ? "" : String(item.priceAmount ?? item.price ?? ""),
      negotiable: Boolean(item.negotiable || item.priceType === "negotiable"),
      condition: item.condition || "used",
      location: item.location || "",
      contactPhone: item.contactPhone || "",
      chatEnabled: item.chatEnabled !== false,
      tags: (item.tags || []).join(", "),
    });
    setExistingImages(item.images || []);
    setNewImages([]);
    setNewImagePreviews([]);
    setComposerError("");
    setShowComposer(true);
  };

  const handleRenew = async (item: MarketplaceListing) => {
    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", item.id), {
        status: "approved",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: "approved" } : entry)));
    } catch (error) {
      console.error("Megújítási hiba:", error);
    }
  };

  const handleMarkSold = async (item: MarketplaceListing) => {
    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", item.id), {
        status: "sold",
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: "sold" } : entry)));
    } catch (error) {
      console.error("Eladottra jelölés hiba:", error);
    }
  };

  const handleSubmitListing = async () => {
    setComposerError("");

    if (validationErrors.length > 0) {
      setComposerError(validationErrors[0]);
      return;
    }

    if (!user) {
      setComposerError("A hirdetés feladásához be kell jelentkezni.");
      return;
    }

    setSubmitting(true);

    try {
      const uploadedImageUrls: string[] = [...existingImages];

      for (const file of newImages) {
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("userId", user.uid);
        formData.append("folder", "posts");

        const idToken = await user.getIdToken();
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Feltöltési hiba");
        }

        uploadedImageUrls.push(data.url);
      }

      const tags = draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const payload: Record<string, any> = {
        postType: "equipment_marketplace",
        market: "hu",
        status: isAdmin ? "approved" : "pending",
        sellerId: user.uid,
        userId: user.uid,
        sellerName:
          userData?.displayName || userData?.pharmacyName || user.displayName || "Felhasználó",
        sellerType: role || "szakmai",
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: draft.category,
        equipmentCategory: draft.category,
        condition: draft.condition,
        negotiable: draft.negotiable,
        priceType: draft.negotiable ? "negotiable" : "fixed",
        price: draft.negotiable ? null : Number(draft.price),
        priceAmount: draft.negotiable ? null : Number(draft.price),
        location: draft.location.trim(),
        city: draft.location.trim(),
        latitude: null,
        longitude: null,
        contactPhone: draft.contactPhone.trim(),
        chatEnabled: draft.chatEnabled,
        tags,
        images: uploadedImageUrls,
        imageUrl: uploadedImageUrls[0] || null,
        featured: false,
        verified: Boolean(userData?.emailVerified || user?.emailVerified),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
        views: 0,
        favorites: 0,
        authorData: {
          displayName:
            userData?.displayName || userData?.pharmacyName || user.displayName || "Felhasználó",
          photoURL: userData?.photoURL || user.photoURL || null,
          email: user.email || null,
        },
      };

      if (editingId) {
        await updateDoc(doc(db, "equipmentMarketplacePosts", editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "equipmentMarketplacePosts"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      resetComposer();
      setShowComposer(false);
      await reloadAll();
    } catch (error: any) {
      console.error("Hirdetés mentési hiba:", error);
      setComposerError(error?.message || "Hiba történt a hirdetés mentése során.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSelectedCategory("all");
    setSelectedCondition("all");
    setMinPrice("");
    setMaxPrice("");
    setFilterLocation("");
    setFeaturedOnly(false);
    setVerifiedOnly(false);
    setWithImagesOnly(false);
    setSortBy("legfrissebb");
  };

  const adminStats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((i) => i.status === "pending").length;
    const featured = items.filter((i) => i.featured).length;
    const sold = items.filter((i) => i.status === "sold").length;
    return { total, pending, featured, sold };
  }, [items]);

  const renderCard = (item: MarketplaceListing) => {
    const isOwner = item.sellerId === user?.uid;
    const canDeleteListing = isOwner || isAdmin;
    const favorited = favoriteIds.has(item.id);
    const firstImage = item.images[0];

    return (
      <article
        key={item.id}
        className={`group overflow-hidden rounded-[1.75rem] border shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
      >
        <button
          onClick={() => openDetails(item)}
          className="w-full text-left"
        >
          <div className="relative w-full aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
            {firstImage ? (
              <Image
                src={firstImage}
                alt={item.title}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent pointer-events-none" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item);
              }}
              className={`absolute top-3 right-3 rounded-full p-2.5 backdrop-blur-lg border shadow-lg ${favorited ? "bg-rose-500 text-white border-rose-500" : "bg-white/90 text-gray-700 border-white"}`}
            >
              <Heart className={`w-4 h-4 ${favorited ? "fill-current" : ""}`} />
            </button>

            {item.featured ? (
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-500/95 backdrop-blur text-white text-xs px-2.5 py-1 font-semibold shadow-lg">
                <Star className="w-3 h-3" /> Kiemelt
              </span>
            ) : null}
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-[15px] leading-snug line-clamp-2">{item.title}</h3>
              {item.verified ? <BadgeCheck className="w-5 h-5 text-emerald-500 shrink-0" /> : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xl font-extrabold text-emerald-600 tracking-tight">{formatHuPrice(item.priceAmount ?? item.price ?? null, item.negotiable)}</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${darkMode ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-700"}`}>
                {getStatusLabel(item.status)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2 py-1 ${getCategoryColor(item.category)}`}>{getCategoryLabel(item.category)}</span>
              <span className={`rounded-full px-2 py-1 ${darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"}`}>{getConditionLabel(item.condition)}</span>
              {item.negotiable ? <span className={`rounded-full px-2 py-1 ${darkMode ? "bg-amber-900/30 text-amber-200" : "bg-amber-50 text-amber-700"}`}>Alkuképes</span> : null}
            </div>

            <div className={`mt-3 text-sm space-y-1.5 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {item.location}</div>
              <div className="flex items-center gap-1.5"><User className="w-4 h-4" /> {item.sellerName}</div>
              <div>{formatHuDateTime(item.createdAt)}</div>
            </div>
          </div>
        </button>

        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {!isOwner && item.status === "approved" ? (
            <button onClick={() => openChat(item)} className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm">
              Üzenet az eladónak
            </button>
          ) : null}

          {!isOwner ? (
            <button
              onClick={() =>
                setReportData({
                  reportType: "equipmentMarketplacePost",
                  reportedUserId: item.sellerId,
                  reportedUserName: item.sellerName || "Felhasználó",
                  itemId: item.id,
                  itemContent: item.title,
                })
              }
              className="px-3 py-2 rounded-2xl bg-amber-100 text-amber-700 text-sm font-semibold"
            >
              Jelentés
            </button>
          ) : null}

          {isOwner ? (
            <>
              <button onClick={() => openEdit(item)} className="px-3 py-2 rounded-2xl bg-indigo-100 text-indigo-700 text-sm font-semibold">Szerkesztés</button>
              <button onClick={() => openDuplicate(item)} className="px-3 py-2 rounded-2xl bg-cyan-100 text-cyan-700 text-sm font-semibold">Duplikálás</button>
              <button onClick={() => handleRenew(item)} className="px-3 py-2 rounded-2xl bg-emerald-100 text-emerald-700 text-sm font-semibold">Megújítás</button>
              {item.status !== "sold" ? (
                <button onClick={() => handleMarkSold(item)} className="px-3 py-2 rounded-2xl bg-blue-100 text-blue-700 text-sm font-semibold">Eladva</button>
              ) : null}
            </>
          ) : null}

          {canDeleteListing ? (
            <button onClick={() => handleDeleteListing(item.id)} className="px-3 py-2 rounded-2xl bg-rose-100 text-rose-700 text-sm font-semibold inline-flex items-center gap-1"><Trash2 className="w-4 h-4" />Törlés</button>
          ) : null}

          {isAdmin ? (
            <>
              <button onClick={() => handleAdminStatus(item.id, "approved")} className="px-3 py-2 rounded-2xl bg-emerald-100 text-emerald-700 text-sm font-semibold">Jóváhagyás</button>
              <button onClick={() => handleAdminStatus(item.id, "rejected")} className="px-3 py-2 rounded-2xl bg-orange-100 text-orange-700 text-sm font-semibold">Elutasítás</button>
              <button onClick={() => handleFeatureToggle(item)} className="px-3 py-2 rounded-2xl bg-purple-100 text-purple-700 text-sm font-semibold">{item.featured ? "Kiemelés levétele" : "Kiemelés"}</button>
            </>
          ) : null}
        </div>
      </article>
    );
  };

  if (authLoading) {
    return (
      <RouteGuard>
        <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </RouteGuard>
    );
  }

  if (!canUseMarketplace) {
    return (
      <RouteGuard>
        <div className={`min-h-screen flex items-center justify-center p-6 text-center ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
          <div>
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-amber-500" />
            <h2 className="text-lg font-semibold mb-2">Nincs hozzáférés</h2>
            <p className={darkMode ? "text-gray-300" : "text-gray-600"}>A Piactér csak szakmai Pharmagister profiloknak érhető el.</p>
          </div>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <div className={`min-h-screen pb-24 ${darkMode ? "bg-gray-950 text-white" : "bg-[#f4f7fb] text-gray-900"}`}>
        <div className={`sticky top-0 z-30 border-b pt-safe-small backdrop-blur-xl ${darkMode ? "bg-gray-950/88 border-gray-800" : "bg-white/88 border-gray-200"}`}>
          <div className="absolute inset-x-0 top-0 h-24 pointer-events-none bg-gradient-to-b from-blue-500/10 to-transparent" />

          <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex items-center gap-3 relative z-10">
            <button onClick={() => router.push("/kozosseg")} className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"}`}>
              <ArrowLeft className="w-4 h-4" /> Vissza
            </button>
            <div className="ml-auto text-right">
              <h1 className="text-2xl font-black tracking-tight">Piactér</h1>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Gyors böngészés, ajánlott hirdetések, saját eladáskezelő</p>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto relative z-10">
            {[
              ["eladas", "Eladás"],
              ["neked", "Neked"],
              ["helyi", "Helyi"],
              ["kategoriak", "Kategóriák"],
              ["kedvencek", "Kedvencek"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setViewMode(key as ViewMode)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-sm ${
                  viewMode === key
                    ? "bg-blue-100 text-blue-700"
                    : darkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="max-w-6xl mx-auto px-4 pb-4 transition-all relative z-10"
            style={{ transform: `translateY(${Math.min(0, pullDistance / 4)}px)` }}
          >
            <div className={`rounded-[1.75rem] border p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => setShowSearchPanel(true)}
                  onBlur={() => setTimeout(() => setShowSearchPanel(false), 120)}
                  placeholder="Keresés cím, leírás, kategória, hely vagy eladó szerint"
                  className={`w-full rounded-[1.4rem] pl-12 pr-4 py-3.5 text-sm border outline-none focus:ring-2 focus:ring-blue-200 ${darkMode ? "bg-gray-950 border-gray-800 placeholder:text-gray-500" : "bg-gray-50 border-gray-200 placeholder:text-gray-500"}`}
                />

                {showSearchPanel && (searchSuggestions.length > 0 || recentSearches.length > 0 || POPULAR_SEARCHES.length > 0) ? (
                  <div className={`absolute top-[110%] left-0 right-0 rounded-2xl border shadow-xl p-3 z-20 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                    {searchSuggestions.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold mb-2 opacity-70">Javaslatok</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {searchSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => {
                                setSearchInput(suggestion);
                                addRecentSearch(suggestion);
                              }}
                              className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {recentSearches.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold mb-2 opacity-70">Legutóbbi keresések</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {recentSearches.map((search) => (
                            <button
                              key={search}
                              onClick={() => setSearchInput(search)}
                              className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}
                            >
                              {search}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <p className="text-xs font-semibold mb-2 opacity-70">Népszerű keresések</p>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_SEARCHES.map((search) => (
                          <button
                            key={search}
                            onClick={() => setSearchInput(search)}
                            className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-emerald-900/40 text-emerald-200" : "bg-emerald-50 text-emerald-700"}`}
                          >
                            {search}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowFilters(true)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Szűrés és rendezés
                </button>

                <button
                  onClick={() => {
                    resetComposer();
                    setShowComposer(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold hover:bg-emerald-100"
                >
                  + Hirdetés feladása
                </button>

                <div className={`ml-auto hidden md:flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? "bg-gray-950 text-gray-300" : "bg-gray-50 text-gray-600"}`}>
                  <Sparkles className="w-4 h-4 text-blue-500" /> {viewMode === "eladas" ? "Eladás" : viewMode === "neked" ? "Neked" : viewMode === "helyi" ? "Helyi" : viewMode === "kategoriak" ? "Kategóriák" : "Kedvencek"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
          {viewMode === "eladas" ? (
            <>
              <section className={`rounded-[2rem] p-4 md:p-5 border shadow-[0_12px_40px_rgba(15,23,42,0.08)] ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-bold text-lg">Eladás</h2>
                    <p className={darkMode ? "text-gray-300" : "text-gray-600"}>Saját hirdetéseid kezelése és új termék feladása.</p>
                  </div>
                  <button
                    onClick={() => {
                      resetComposer();
                      setShowComposer(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white font-semibold shadow-sm w-full sm:w-auto"
                  >
                    + Apróhirdetés létrehozása
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className={`rounded-2xl p-3 ${darkMode ? "bg-gray-800" : "bg-blue-50"}`}>
                    <p className="text-xs opacity-70">Válaszra váró chatek</p>
                    <p className="text-lg font-bold">{adminStats.pending}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${darkMode ? "bg-gray-800" : "bg-emerald-50"}`}>
                    <p className="text-xs opacity-70">Aktív apróhirdetés</p>
                    <p className="text-lg font-bold">{ownedListingStats.active}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${darkMode ? "bg-gray-800" : "bg-amber-50"}`}>
                    <p className="text-xs opacity-70">Megújítható apróhirdetés</p>
                    <p className="text-lg font-bold">{ownedListingStats.drafts}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${darkMode ? "bg-gray-800" : "bg-gray-50"}`}>
                    <p className="text-xs opacity-70">Összes hirdetésed</p>
                    <p className="text-lg font-bold">{ownedListingStats.total}</p>
                  </div>
                </div>
              </section>

              <section className={`rounded-[2rem] p-4 border shadow-[0_12px_30px_rgba(15,23,42,0.05)] ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-bold text-lg">Megjelenés</h2>
                    <p className={darkMode ? "text-gray-300" : "text-gray-600"}>A hirdetéseid kezelése, szerkesztés, kiemelés, eladottként jelölés.</p>
                  </div>
                  <button onClick={() => setViewMode("kedvencek")} className="rounded-full px-3 py-2 bg-rose-100 text-rose-700 text-sm font-semibold">
                    Kedvencek
                  </button>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {([
                    ["aktiv", "Aktív"],
                    ["fuggoben", "Függőben"],
                    ["eladva", "Eladva"],
                    ["piszkozat", "Piszkozat"],
                    ["lejart", "Lejárt"],
                  ] as Array<[MyListingTab, string]>).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setMyTab(id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        myTab === id
                          ? "bg-indigo-100 text-indigo-700"
                          : darkMode
                            ? "bg-gray-800 text-gray-100"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {myListingsFiltered.length === 0 ? (
                  <div className={`rounded-2xl p-8 text-center border ${darkMode ? "bg-gray-900/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <Package className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                    <h3 className="font-semibold text-lg">Nincs még hirdetésed ebben a nézetben</h3>
                    <p className={`mt-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>Hozz létre egy új apróhirdetést a fenti gombbal.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {myListingsFiltered.map(renderCard)}
                  </div>
                )}
              </section>

              {isAdmin ? (
                <section className={`rounded-2xl p-4 border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  <h2 className="font-bold mb-3">Admin statisztikák</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={`rounded-xl p-3 ${darkMode ? "bg-gray-700" : "bg-emerald-50"}`}>
                      <p className="text-xs opacity-70">Összes hirdetés</p>
                      <p className="text-lg font-bold">{adminStats.total}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${darkMode ? "bg-gray-700" : "bg-amber-50"}`}>
                      <p className="text-xs opacity-70">Függőben</p>
                      <p className="text-lg font-bold">{adminStats.pending}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${darkMode ? "bg-gray-700" : "bg-violet-50"}`}>
                      <p className="text-xs opacity-70">Kiemelt</p>
                      <p className="text-lg font-bold">{adminStats.featured}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${darkMode ? "bg-gray-700" : "bg-blue-50"}`}>
                      <p className="text-xs opacity-70">Eladva</p>
                      <p className="text-lg font-bold">{adminStats.sold}</p>
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {viewMode === "neked" ? (
            <>
              <section className={`relative overflow-hidden rounded-[2rem] p-4 border ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-emerald-500/10 to-blue-500/10 pointer-events-none" />
                <div className="relative z-10">
                  <h2 className="font-bold text-lg mb-2">Neked</h2>
                  <p className={darkMode ? "text-gray-300" : "text-gray-600"}>Ajánlott hirdetések a kedvenceid és a legnézettebb elemek alapján.</p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" /> {recommendedListings.length} ajánlott hirdetés
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button onClick={() => setViewMode("eladas")} className="rounded-2xl p-4 text-left border bg-blue-600 text-white font-semibold shadow-sm">Eladás</button>
                  <button onClick={() => setViewMode("helyi")} className={`rounded-2xl p-4 text-left border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className="font-semibold">Helyi</p>
                    <p className="text-xs opacity-70 mt-1">A közeledben</p>
                  </button>
                  <button onClick={() => setViewMode("kategoriak")} className={`rounded-2xl p-4 text-left border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className="font-semibold">Kategóriák</p>
                    <p className="text-xs opacity-70 mt-1">Szűkebb böngészés</p>
                  </button>
                  <button onClick={() => setViewMode("kedvencek")} className={`rounded-2xl p-4 text-left border ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className="font-semibold">Kedvencek</p>
                    <p className="text-xs opacity-70 mt-1">Mentett hirdetések</p>
                  </button>
                </div>
              </section>

              {recommendedListings.length > 0 ? (
                <section>
                  <h2 className="font-bold mb-3">Ajánlott neked</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recommendedListings.map(renderCard)}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {viewMode === "helyi" ? (
            <>
              <section className={`relative overflow-hidden rounded-[2rem] p-4 border ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-orange-400/10 to-rose-400/10 pointer-events-none" />
                <div className="relative z-10">
                <h2 className="font-bold text-lg mb-2">Helyi</h2>
                <p className={darkMode ? "text-gray-300" : "text-gray-600"}>A profilodban megadott településhez közeli hirdetések.</p>
                <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm ${darkMode ? "bg-gray-950 text-gray-100" : "bg-gray-100 text-gray-800"}`}>
                  <MapPin className="w-4 h-4" /> {userLocation || "Nincs megadott hely"}
                </div>
                </div>
              </section>

              {localListings.length > 0 ? (
                <section>
                  <h2 className="font-bold mb-3">Közeli hirdetések</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {localListings.map(renderCard)}
                  </div>
                </section>
              ) : (
                <section className={`rounded-2xl p-8 text-center border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className={darkMode ? "text-gray-300" : "text-gray-600"}>Most nincs külön helyi találat, ezért a teljes piactér látható a keresésben.</p>
                </section>
              )}
            </>
          ) : null}

          {viewMode === "kategoriak" ? (
            <>
              <section>
                <h2 className="font-bold mb-3">Kategóriák</h2>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`shrink-0 rounded-2xl px-4 py-3 border text-sm font-semibold ${selectedCategory === "all" ? "bg-emerald-600 text-white border-emerald-600" : darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
                  >
                    Összes ({visibleListings.length})
                  </button>
                  {CATEGORY_DEFS.map((cat) => {
                    const Icon = cat.icon;
                    const count = categoryCountMap.get(cat.id) || 0;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`shrink-0 rounded-2xl px-4 py-3 border text-left ${selectedCategory === cat.id ? "border-emerald-500 ring-2 ring-emerald-100" : darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`rounded-lg p-1.5 ${cat.color}`}><Icon className="w-4 h-4" /></span>
                          <div>
                            <p className="text-sm font-semibold whitespace-nowrap">{cat.label}</p>
                            <p className="text-xs opacity-70">{count} hirdetés</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="font-bold mb-3">Kategória áttekintés</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categoryGroups.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`rounded-2xl p-4 text-left border ${selectedCategory === cat.id ? "ring-2 ring-blue-200 border-blue-300" : darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
                      >
                        <div className={`inline-flex rounded-xl p-2 ${cat.color}`}><Icon className="w-5 h-5" /></div>
                        <p className="mt-3 font-semibold">{cat.label}</p>
                        <p className="text-xs opacity-70 mt-1">{cat.count} hirdetés</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {featuredListings.length > 0 ? (
                <section>
                  <h2 className="font-bold mb-3">Kiemelt hirdetések</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {featuredListings.map(renderCard)}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setListingFeedMode("osszes")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${listingFeedMode === "osszes" ? "bg-emerald-100 text-emerald-700" : darkMode ? "bg-gray-800" : "bg-white border border-gray-200"}`}
                  >
                    Összes
                  </button>
                  <button
                    onClick={() => setListingFeedMode("legfrissebb")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${listingFeedMode === "legfrissebb" ? "bg-emerald-100 text-emerald-700" : darkMode ? "bg-gray-800" : "bg-white border border-gray-200"}`}
                  >
                    Legfrissebb
                  </button>
                </div>

                <h2 className="font-bold mb-3">{listingFeedMode === "legfrissebb" ? "Legfrissebb hirdetések" : "Összes találat"}</h2>

                {errorText ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 mb-3">{errorText}</div>
                ) : null}

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ListingSkeleton darkMode={darkMode} />
                    <ListingSkeleton darkMode={darkMode} />
                    <ListingSkeleton darkMode={darkMode} />
                    <ListingSkeleton darkMode={darkMode} />
                  </div>
                ) : activeFeedListings.length === 0 ? (
                  <div className={`rounded-2xl p-8 text-center border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                    <Package className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                    <h3 className="font-semibold text-lg">Nincs találat</h3>
                    <p className={`mt-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>Próbálj másik keresést vagy lazább szűrést.</p>
                    <button
                      onClick={clearFilters}
                      className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                    >
                      Szűrők törlése
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeFeedListings.map(renderCard)}
                  </div>
                )}

                <div ref={loadMoreRef} className="h-8" />
                {loadingMore ? (
                  <div className="py-3 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
                ) : null}
              </section>
            </>
          ) : null}

          {viewMode === "kedvencek" ? (
            <section>
              <h2 className="font-bold mb-3">Kedvencek</h2>
              {favoriteListings.length === 0 ? (
                <div className={`rounded-2xl p-8 text-center border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  <Heart className="w-10 h-10 mx-auto mb-3 text-rose-400" />
                  <p className={darkMode ? "text-gray-300" : "text-gray-600"}>Még nincs kedvenc hirdetésed.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {favoriteListings.map(renderCard)}
                </div>
              )}
            </section>
          ) : null}

        </main>

        {showFilters ? (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-3 pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-3">
            <div className={`w-full max-w-2xl rounded-2xl border max-h-[85vh] overflow-y-auto ${darkMode ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
              <div className="sticky top-0 px-4 py-3 border-b flex items-center justify-between bg-inherit">
                <h3 className="font-bold text-lg">Szűrés és rendezés</h3>
                <button onClick={() => setShowFilters(false)} className="p-2 rounded-lg hover:bg-gray-200/20"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold">Rendezés</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}>
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold">Kategória</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}>
                    <option value="all">Összes kategória</option>
                    {CATEGORY_DEFS.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold">Állapot</label>
                  <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}>
                    <option value="all">Összes állapot</option>
                    {CONDITION_OPTIONS.map((condition) => (
                      <option key={condition.id} value={condition.id}>{condition.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-semibold">Minimum ár</label>
                    <input value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="pl. 10000" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Maximum ár</label>
                    <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="pl. 300000" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold">Hely</label>
                  <input value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder="Város vagy térség" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                </div>

                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} /> Csak kiemelt</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Csak ellenőrzött eladók</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={withImagesOnly} onChange={(e) => setWithImagesOnly(e.target.checked)} /> Csak képes hirdetések</label>
                </div>

                <div className="flex gap-2">
                  <button onClick={clearFilters} className="flex-1 rounded-xl bg-gray-200 text-gray-800 py-2 font-semibold">Törlés</button>
                  <button onClick={() => setShowFilters(false)} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 font-semibold">Alkalmazás</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showComposer ? (
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-end md:items-center justify-center p-3 pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-3">
            <div className={`w-full max-w-3xl rounded-2xl border max-h-[88vh] overflow-y-auto ${darkMode ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
              <div className="sticky top-0 px-4 py-3 border-b flex items-center justify-between bg-inherit z-10">
                <h3 className="font-bold text-lg">{editingId ? "Hirdetés szerkesztése" : "Hirdetés feladása"}</h3>
                <button onClick={() => { setShowComposer(false); resetComposer(); }} className="p-2 rounded-lg hover:bg-gray-200/20"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold">Képek (max. 15)</label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onChooseImages(e.target.files)}
                  />
                  <button onClick={() => imageInputRef.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-purple-100 text-purple-700 text-sm font-semibold">
                    <Camera className="w-4 h-4" /> Képek kiválasztása
                  </button>

                  {existingImages.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-xs opacity-70 mb-1">Már feltöltött képek</p>
                      <div className="grid grid-cols-4 gap-2">
                        {existingImages.map((url, idx) => (
                          <div key={`${url}-${idx}`} className="relative rounded-lg overflow-hidden border">
                            <div className="relative h-20 w-full">
                              <Image src={url} alt="feltöltött kép" fill className="object-cover" sizes="120px" />
                            </div>
                            <button onClick={() => removeExistingImage(idx)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {newImages.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-xs opacity-70 mb-1">Új képek (húzd át az átrendezéshez)</p>
                      <div className="grid grid-cols-4 gap-2">
                        {newImages.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            draggable
                            onDragStart={() => setDragIndex(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex == null) return;
                              reorderNewImages(dragIndex, idx);
                              setDragIndex(null);
                            }}
                            className={`relative rounded-lg overflow-hidden border cursor-move ${dragIndex === idx ? "ring-2 ring-emerald-400" : ""}`}
                          >
                            <div className="relative h-20 w-full">
                              <img src={newImagePreviews[idx]} alt="új kép" className="w-full h-full object-cover" />
                            </div>
                            <button onClick={() => removeNewImage(idx)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold">Kategória</label>
                    <select value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}>
                      {CATEGORY_DEFS.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold">Állapot</label>
                    <select value={draft.condition} onChange={(e) => setDraft((prev) => ({ ...prev, condition: e.target.value as ConditionOption }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}>
                      {CONDITION_OPTIONS.map((condition) => (
                        <option key={condition.id} value={condition.id}>{condition.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold">Cím</label>
                  <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Pl. Gyógyszertári hűtő kiváló állapotban" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                </div>

                <div>
                  <label className="text-sm font-semibold">Leírás</label>
                  <textarea value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} rows={4} placeholder="Részletes leírás, műszaki adatok, állapot, átvételi információk" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold">Ár (Ft)</label>
                    <input value={draft.price} onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value.replace(/[^0-9]/g, "") }))} disabled={draft.negotiable} placeholder="Pl. 120000" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"} ${draft.negotiable ? "opacity-60" : ""}`} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Hely</label>
                    <input value={draft.location} onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))} placeholder="Pl. Budapest" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold">Kapcsolattartó telefonszám (opcionális)</label>
                    <input value={draft.contactPhone} onChange={(e) => setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))} placeholder="Pl. +36 30 123 4567" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Címkék</label>
                    <input value={draft.tags} onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))} placeholder="Pl. hűtő, gyógyszertár, használt" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`} />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={draft.negotiable} onChange={(e) => setDraft((prev) => ({ ...prev, negotiable: e.target.checked }))} /> Alkuképes</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={draft.chatEnabled} onChange={(e) => setDraft((prev) => ({ ...prev, chatEnabled: e.target.checked }))} /> Chat engedélyezése</label>
                </div>

                {validationErrors.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
                    <p className="font-semibold mb-1">Hiányzó vagy hibás adatok:</p>
                    <ul className="list-disc ml-4">
                      {validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {composerError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">{composerError}</div>
                ) : null}

                <div className="flex gap-2">
                  <button onClick={() => { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft)); alert("Piszkozat mentve."); }} className="flex-1 rounded-xl bg-gray-200 text-gray-800 py-2 font-semibold">Piszkozat mentése</button>
                  <button onClick={handleSubmitListing} disabled={submitting} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {submitting ? "Mentés..." : editingId ? "Módosítás mentése" : "Hirdetés feladása"}
                  </button>
                </div>

                {!isAdmin ? (
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Az új hirdetések moderáció után jelennek meg nyilvánosan.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {selectedListing ? (
          <div className="fixed inset-0 z-[75] bg-black/70 flex items-end md:items-center justify-center p-3 pb-[calc(108px+env(safe-area-inset-bottom,0px))] md:pb-3">
            <div className={`w-full max-w-4xl rounded-2xl border max-h-[90vh] overflow-y-auto ${darkMode ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
              <div className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between bg-inherit">
                <h3 className="font-bold text-lg">Hirdetés részletei</h3>
                <button onClick={() => setSelectedListing(null)} className="p-2 rounded-lg hover:bg-gray-200/20"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                <div className="relative w-full h-72 rounded-2xl overflow-hidden bg-gray-100">
                  {selectedListing.images[detailImageIndex] ? (
                    <>
                      <Image
                        src={selectedListing.images[detailImageIndex]}
                        alt={selectedListing.title}
                        fill
                        className="object-cover cursor-zoom-in"
                        sizes="(max-width: 768px) 100vw, 75vw"
                        onClick={() => setFullScreenImage(true)}
                      />
                      <button
                        onClick={() => setFullScreenImage(true)}
                        className="absolute bottom-3 right-3 rounded-full bg-black/60 text-white px-3 py-1 text-xs"
                      >
                        Teljes képernyő
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-400" /></div>
                  )}
                </div>

                {selectedListing.images.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedListing.images.map((image, idx) => (
                      <button
                        key={`${image}-${idx}`}
                        onClick={() => setDetailImageIndex(idx)}
                        className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border ${detailImageIndex === idx ? "border-emerald-500" : "border-transparent"}`}
                      >
                        <Image src={image} alt={`kép ${idx + 1}`} fill className="object-cover" sizes="80px" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xl font-bold">{selectedListing.title}</h4>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatHuPrice(selectedListing.priceAmount ?? selectedListing.price ?? null, selectedListing.negotiable)}</p>
                  </div>
                  {selectedListing.verified ? <BadgeCheck className="w-6 h-6 text-emerald-500" /> : null}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Kategória</p>
                    <p className="font-semibold">{getCategoryLabel(selectedListing.category)}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Állapot</p>
                    <p className="font-semibold">{getConditionLabel(selectedListing.condition)}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Hely</p>
                    <p className="font-semibold">{selectedListing.location}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Feladás ideje</p>
                    <p className="font-semibold">{formatHuDate(selectedListing.createdAt)}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Megtekintések</p>
                    <p className="font-semibold">{selectedListing.views || 0}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Kedvencek</p>
                    <p className="font-semibold">{selectedListing.favorites || 0}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Eladó</p>
                    <p className="font-semibold">{selectedListing.sellerName}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    <p className="text-xs opacity-70">Eladói státusz</p>
                    <p className="font-semibold">{selectedListing.verified ? "Ellenőrzött" : "Normál"}</p>
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-1">Leírás</h5>
                  <p className={`whitespace-pre-wrap ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{selectedListing.description || "Nincs leírás"}</p>
                </div>

                {selectedListing.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedListing.tags.map((tag) => (
                      <span key={tag} className={`text-xs px-2 py-1 rounded-full ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>#{tag}</span>
                    ))}
                  </div>
                ) : null}

                <div>
                  <h5 className="font-semibold mb-2">Hasonló hirdetések</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visibleListings
                      .filter((item) => item.id !== selectedListing.id && item.category === selectedListing.category)
                      .slice(0, 4)
                      .map((item) => (
                        <button key={item.id} onClick={() => openDetails(item)} className={`text-left rounded-xl p-3 border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                          <p className="font-semibold text-sm truncate">{item.title}</p>
                          <p className="text-xs opacity-70">{formatHuPrice(item.priceAmount ?? item.price ?? null, item.negotiable)} · {item.location}</p>
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-2">Az eladó további hirdetései</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visibleListings
                      .filter((item) => item.id !== selectedListing.id && item.sellerId === selectedListing.sellerId)
                      .slice(0, 4)
                      .map((item) => (
                        <button key={item.id} onClick={() => openDetails(item)} className={`text-left rounded-xl p-3 border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                          <p className="font-semibold text-sm truncate">{item.title}</p>
                          <p className="text-xs opacity-70">{formatHuPrice(item.priceAmount ?? item.price ?? null, item.negotiable)} · {item.location}</p>
                        </button>
                      ))}
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 pt-3 pb-2 bg-inherit border-t">
                  <div className="flex flex-wrap gap-2">
                    {selectedListing.sellerId !== user?.uid && selectedListing.status === "approved" && selectedListing.chatEnabled !== false ? (
                      <button onClick={() => openChat(selectedListing)} className="flex-1 min-w-[140px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-semibold">Üzenet az eladónak</button>
                    ) : null}

                    {selectedListing.contactPhone ? (
                      <a href={`tel:${selectedListing.contactPhone}`} className="flex-1 min-w-[140px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 font-semibold text-center">Hívás</a>
                    ) : null}

                    <button onClick={() => toggleFavorite(selectedListing)} className="flex-1 min-w-[140px] rounded-xl bg-rose-100 text-rose-700 py-2.5 font-semibold">Mentés</button>

                    <button
                      onClick={async () => {
                        const text = `${selectedListing.title} - ${formatHuPrice(selectedListing.priceAmount ?? selectedListing.price ?? null, selectedListing.negotiable)}`;
                        if (navigator.share) {
                          try {
                            await navigator.share({ title: "Piactér hirdetés", text });
                            return;
                          } catch {
                            // fallback below
                          }
                        }
                        await navigator.clipboard.writeText(text);
                        alert("Hirdetés adatai másolva a vágólapra.");
                      }}
                      className="rounded-xl bg-gray-200 text-gray-800 px-4 py-2.5 font-semibold"
                    >
                      Megosztás
                    </button>

                    {selectedListing.sellerId === user?.uid || isAdmin ? (
                      <button
                        onClick={() => handleDeleteListing(selectedListing.id)}
                        className="rounded-xl bg-rose-100 text-rose-700 px-4 py-2.5 font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Törlés
                      </button>
                    ) : null}

                    {selectedListing.sellerId !== user?.uid ? (
                      <button
                        onClick={() =>
                          setReportData({
                            reportType: "equipmentMarketplacePost",
                            reportedUserId: selectedListing.sellerId,
                            reportedUserName: selectedListing.sellerName || "Felhasználó",
                            itemId: selectedListing.id,
                            itemContent: selectedListing.title,
                          })
                        }
                        className="rounded-xl bg-amber-100 text-amber-700 px-4 py-2.5 font-semibold"
                      >
                        Jelentés
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {fullScreenImage && selectedListing?.images[detailImageIndex] ? (
          <div className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center p-4">
            <button onClick={() => setFullScreenImage(false)} className="absolute top-4 right-4 rounded-full bg-white/20 text-white p-2"><X className="w-5 h-5" /></button>
            <div className="relative w-full max-w-5xl h-[85vh]">
              <Image src={selectedListing.images[detailImageIndex]} alt="teljes kép" fill className="object-contain" sizes="100vw" />
            </div>
          </div>
        ) : null}

        <ReportModal
          isOpen={Boolean(reportData)}
          onClose={() => setReportData(null)}
          reportType={reportData?.reportType || "equipmentMarketplacePost"}
          reportedUserId={reportData?.reportedUserId}
          reportedUserName={reportData?.reportedUserName}
          itemId={reportData?.itemId}
          itemContent={reportData?.itemContent}
        />
      </div>
    </RouteGuard>
  );
}
