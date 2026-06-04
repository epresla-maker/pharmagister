"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft,
  Search,
  Calendar,
  MapPin,
  User,
  Clock,
  Briefcase,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  Loader2,
  Pill,
  UserCog,
  Building2,
  FileText,
  Users,
} from "lucide-react";
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

function parseDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (typeof val === "string") return new Date(val);
  return null;
}

function formatDate(val) {
  const market = getClientMarket();
  const d = parseDate(val);
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU', {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayOnly(dateStr) {
  const market = getClientMarket();
  if (!dateStr) return "-";
  // Handle Firestore Timestamp
  if (dateStr.toDate) {
    dateStr = dateStr.toDate();
  } else if (dateStr.seconds) {
    dateStr = new Date(dateStr.seconds * 1000);
  }
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU', {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function getPositionLabel(pos) {
  const market = getClientMarket();
  if (pos === "pharmacist") return market === 'de' ? 'Apotheker/in' : 'Gyógyszerész';
  if (pos === "assistant") return market === 'de' ? 'Assistent/in' : 'Szakasszisztens';
  return pos || "-";
}

function getPositionIcon(pos) {
  if (pos === "pharmacist") return Pill;
  if (pos === "assistant") return UserCog;
  return Briefcase;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

// Demand állapot meghatározása
function getDemandState(demand) {
  const market = getClientMarket();
  const today = getTodayStr();

  if (demand.deletedAt) {
    return {
      key: "deleted",
      label: market === 'de' ? 'Geloescht' : 'Törölve',
      reason: demand.deletionReason || (market === 'de' ? 'Manuelle Loeschung (ohne Grund)' : 'Kézi törlés (ok nélkül)'),
      color: "text-red-600 bg-red-50 border-red-200",
      icon: XCircle,
    };
  }
  if (demand.status === "filled") {
    return {
      key: "filled",
      label: market === 'de' ? 'Besetzt' : 'Betöltve',
      reason: market === 'de' ? 'Bewerber/in angenommen' : 'Jelentkező elfogadva',
      color: "text-green-600 bg-green-50 border-green-200",
      icon: CheckCircle2,
    };
  }
  // Handle Timestamp for date comparison
  let demandDateStr = demand.date;
  if (demand.date?.toDate) {
    demandDateStr = demand.date.toDate().toISOString().split("T")[0];
  } else if (demand.date?.seconds) {
    demandDateStr = new Date(demand.date.seconds * 1000).toISOString().split("T")[0];
  }
  if (demandDateStr && demandDateStr < today) {
    return {
      key: "expired",
      label: market === 'de' ? 'Abgelaufen' : 'Lejárt',
      reason: market === 'de' ? `Datum abgelaufen (${formatDayOnly(demand.date)})` : `A dátum lejárt (${formatDayOnly(demand.date)})`,
      color: "text-orange-600 bg-orange-50 border-orange-200",
      icon: Timer,
    };
  }
  return {
    key: "open",
    label: market === 'de' ? 'Aktiv' : 'Aktív',
    reason: null,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    icon: CheckCircle2,
  };
}

// ─── Delete Confirm Modal ───
function DeleteConfirmModal({ isOpen, onClose, onConfirm, demandName }) {
  const market = getClientMarket();
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{market === 'de' ? 'Anfrage loeschen' : 'Igény törlése'}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {market === 'de' ? 'Moechtest du diese Anfrage wirklich loeschen?' : 'Biztosan törölni szeretnéd ezt az igényt?'}
            </p>
            <p className="text-sm font-semibold text-gray-800 mb-4">{demandName}</p>
            <p className="text-xs text-red-500 mb-4">
              {market === 'de' ? '⚠️ Dieser Vorgang ist unwiderruflich! Die Anfrage und alle zugehoerigen Bewerbungen werden dauerhaft geloescht.' : '⚠️ Ez a művelet visszavonhatatlan! Az igény és az összes hozzá tartozó jelentkezés véglegesen törlődik.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
              >
                {market === 'de' ? 'Abbrechen' : 'Mégse'}
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
              >
                {market === 'de' ? 'Weiter zum Loeschen' : 'Tovább a törléshez'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-red-700">{market === 'de' ? 'Letzte Bestaetigung' : 'Végső megerősítés'}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {market === 'de' ? <>Dies ist die <strong>zweite und letzte</strong> Warnung. Die Anfrage und alle verbundenen Daten werden dauerhaft geloescht.</> : <>Ez a <strong>második és utolsó</strong> figyelmeztetés. Az igény és minden kapcsolódó adat véglegesen törlődik.</>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
              >
                {market === 'de' ? 'Abbrechen' : 'Mégse'}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-red-700 text-white text-sm hover:bg-red-800 font-bold"
              >
                {market === 'de' ? '🗑️ Endgueltig loeschen' : '🗑️ Végleges törlés'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Demand Detail Card ───
function DemandCard({ demand, applications, creatorData, onDelete }) {
  const market = getClientMarket();
  const [expanded, setExpanded] = useState(false);
  const state = getDemandState(demand);
  const StateIcon = state.icon;
  const PosIcon = getPositionIcon(demand.position);

  const demandApps = applications.filter((a) => a.demandId === demand.id);

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${expanded ? "ring-2 ring-violet-200" : ""}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${state.color}`}>
          <StateIcon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 truncate">
              {demand.pharmacyName || "Ismeretlen gyógyszertár"}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${state.color}`}>
              <StateIcon size={11} />
              {state.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {formatDayOnly(demand.date)}
            </span>
            <span className="flex items-center gap-1">
              <PosIcon size={11} />
              {getPositionLabel(demand.position)}
            </span>
            {demand.pharmacyCity && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {demand.pharmacyCity}
              </span>
            )}
          </div>

          {state.reason && state.key !== "open" && (
            <p className="text-xs text-gray-400 mt-1 italic">
              {state.key === "deleted" ? "🗑️" : state.key === "expired" ? "⏰" : "✅"} {state.reason}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {demandApps.length > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              {demandApps.length} jelentkező
            </span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50">
          {/* ── Igény részletei ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <InfoRow icon={Building2} label="Gyógyszertár" value={demand.pharmacyName || "-"} />
            <InfoRow icon={MapPin} label="Cím" value={demand.pharmacyFullAddress || `${demand.pharmacyZipCode || ""} ${demand.pharmacyCity || ""} ${demand.pharmacyStreet || ""} ${demand.pharmacyHouseNumber || ""}`.trim() || "-"} />
            <InfoRow icon={Calendar} label="Igényelt dátum" value={formatDayOnly(demand.date)} />
            <InfoRow icon={PosIcon} label="Pozíció" value={getPositionLabel(demand.position)} />
            <InfoRow icon={Clock} label="Munkaidő" value={demand.workHours || "-"} />
            <InfoRow icon={Briefcase} label="Min. tapasztalat" value={demand.minExperience || "-"} />
            {demand.maxHourlyRate && (
              <InfoRow icon={FileText} label="Max. órabér" value={`${demand.maxHourlyRate} Ft/óra`} />
            )}
            <InfoRow icon={User} label="Létrehozta" value={creatorData?.displayName || creatorData?.pharmacyName || demand.pharmacyId || "-"} />
            <InfoRow icon={Clock} label="Létrehozva" value={formatDate(demand.createdAt)} />
            {demand.updatedAt && demand.updatedAt !== demand.createdAt && (
              <InfoRow icon={Clock} label="Módosítva" value={formatDate(demand.updatedAt)} />
            )}
          </div>

          {/* Szükséges szoftverek */}
          {demand.requiredSoftware && demand.requiredSoftware.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Szükséges szoftverek:</p>
              <div className="flex flex-wrap gap-1">
                {demand.requiredSoftware.map((sw, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    {sw}
                  </span>
                ))}
                {demand.otherSoftware && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">
                    {demand.otherSoftware}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Egyéb elvárások */}
          {demand.additionalRequirements && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Egyéb elvárások:</p>
              <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">
                {demand.additionalRequirements}
              </p>
            </div>
          )}

          {/* Állapot info */}
          {state.key !== "open" && (
            <div className={`rounded-lg p-3 border mb-3 ${state.color}`}>
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <StateIcon size={13} />
                {state.label}: {state.reason}
              </p>
              {demand.deletedAt && (
                <p className="text-xs mt-1 opacity-70">
                  Törölve: {formatDate(demand.deletedAt)}
                  {demand.deletedBy && ` · Admin: ${demand.deletedBy}`}
                </p>
              )}
              {demand.filledAt && (
                <p className="text-xs mt-1 opacity-70">
                  Betöltve: {formatDate(demand.filledAt)}
                </p>
              )}
            </div>
          )}

          {/* ── Jelentkezők ── */}
          {demandApps.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <Users size={12} /> Jelentkezők ({demandApps.length}):
              </p>
              <div className="space-y-2">
                {demandApps.map((app) => {
                  const statusColors = {
                    accepted: "bg-green-50 border-green-200 text-green-700",
                    rejected: "bg-red-50 border-red-200 text-red-700",
                    pending: "bg-yellow-50 border-yellow-200 text-yellow-700",
                  };
                  const statusLabels = {
                    accepted: "✅ Elfogadva",
                    rejected: "❌ Elutasítva",
                    pending: "⏳ Várakozik",
                  };
                  return (
                    <div
                      key={app.id}
                      className={`rounded-lg p-3 border text-sm ${statusColors[app.status] || "bg-gray-50 border-gray-200"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{app.applicantName || app.displayName || "Ismeretlen"}</span>
                        <span className="text-xs">{statusLabels[app.status] || app.status}</span>
                      </div>
                      {app.message && (
                        <p className="text-xs mt-1 opacity-80">„{app.message}"</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs opacity-60">
                        <span>Jelentkezett: {formatDate(app.createdAt)}</span>
                        {app.acceptedAt && <span>Elfogadva: {formatDate(app.acceptedAt)}</span>}
                      </div>
                      {app.rejectionReason && (
                        <p className="text-xs mt-1 italic opacity-70">
                          Elutasítás oka: {app.rejectionReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Migráció info */}
          {demand.migratedFrom && (
            <div className="text-xs text-gray-400 border-t border-gray-200 pt-2 mb-3">
              📥 WordPress-ből migrálva {demand.wpTitle && `· Eredeti cím: "${demand.wpTitle}"`}
            </div>
          )}

          {/* Törlés gomb */}
          {!demand.deletedAt && onDelete && (
            <div className="border-t border-gray-200 pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(demand);
                }}
                className="flex items-center gap-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={13} />
                {market === 'de' ? 'Anfrage loeschen (Admin)' : 'Igény törlése (Admin)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────
export default function AdminDemandsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  const [demands, setDemands] = useState([]);
  const [applications, setApplications] = useState([]);
  const [creatorMap, setCreatorMap] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Auth guard
  useEffect(() => {
    if (!loading && (!user || !ALL_ADMIN_EMAILS.includes(user.email))) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load data
  useEffect(() => {
    if (!user || !ALL_ADMIN_EMAILS.includes(user.email)) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [demandsSnap, appsSnap] = await Promise.all([
        getDocs(collection(db, "pharmaDemands")),
        getDocs(collection(db, "pharmaApplications")),
      ]);

      const demandsData = demandsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const appsData = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Fetch creator data
      const creatorIds = new Set(demandsData.map((d) => d.pharmacyId || d.createdBy).filter(Boolean));
      const map = {};
      await Promise.all(
        [...creatorIds].map(async (uid) => {
          try {
            const uSnap = await getDoc(doc(db, "users", uid));
            if (uSnap.exists()) {
              map[uid] = uSnap.data();
            }
          } catch {}
        })
      );

      // Sort by date descending
      demandsData.sort((a, b) => {
        const da = a.date || "";
        const db2 = b.date || "";
        return db2.localeCompare(da);
      });

      setDemands(demandsData);
      setApplications(appsData);
      setCreatorMap(map);
    } catch (e) {
      console.error("Hiba az igények betöltésekor:", e);
    } finally {
      setLoadingData(false);
    }
  };

  // Delete demand
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Delete associated applications
      const relatedApps = applications.filter((a) => a.demandId === deleteTarget.id);
      for (const app of relatedApps) {
        await deleteDoc(doc(db, "pharmaApplications", app.id));
      }

      // Delete associated feed posts
      const feedSnap = await getDocs(collection(db, "serviceFeedPosts"));
      for (const feedDoc of feedSnap.docs) {
        if (feedDoc.data().pharmaDemandId === deleteTarget.id) {
          await deleteDoc(doc(db, "serviceFeedPosts", feedDoc.id));
        }
      }

      // Soft delete: mark as deleted instead of removing
      await updateDoc(doc(db, "pharmaDemands", deleteTarget.id), {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: 'admin'
      });

      // Refresh
      setDemands((prev) => prev.map((d) => d.id === deleteTarget.id ? { ...d, status: 'deleted', deletedAt: new Date() } : d));
      setApplications((prev) => prev.filter((a) => a.demandId !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error("Törlési hiba:", e);
      alert((market === 'de' ? 'Fehler beim Loeschen: ' : 'Hiba történt a törlés közben: ') + e.message);
    }
  };

  // Categorize demands
  const categorized = useMemo(() => {
    const today = getTodayStr();
    const all = [];
    const open = [];
    const filled = [];
    const expired = [];
    const deleted = [];

    demands.forEach((d) => {
      const state = getDemandState(d);
      all.push(d);
      switch (state.key) {
        case "open":
          open.push(d);
          break;
        case "filled":
          filled.push(d);
          break;
        case "expired":
          expired.push(d);
          break;
        case "deleted":
          deleted.push(d);
          break;
      }
    });

    return { all, open, filled, expired, deleted };
  }, [demands]);

  // Filter by search
  const filtered = useMemo(() => {
    const list = categorized[activeTab] || categorized.all;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((d) => {
      const name = (d.pharmacyName || "").toLowerCase();
      const city = (d.pharmacyCity || "").toLowerCase();
      const date = (d.date || "").toLowerCase();
      const pos = getPositionLabel(d.position).toLowerCase();
      return name.includes(q) || city.includes(q) || date.includes(q) || pos.includes(q);
    });
  }, [categorized, activeTab, searchQuery]);

  const tabs = [
    { key: "all", label: market === 'de' ? 'Alle' : 'Összes', count: categorized.all.length, color: "bg-gray-600" },
    { key: "open", label: market === 'de' ? 'Aktiv' : 'Aktív', count: categorized.open.length, color: "bg-blue-600" },
    { key: "filled", label: market === 'de' ? 'Besetzt' : 'Betöltve', count: categorized.filled.length, color: "bg-green-600" },
    { key: "expired", label: market === 'de' ? 'Abgelaufen' : 'Lejárt', count: categorized.expired.length, color: "bg-orange-600" },
    { key: "deleted", label: market === 'de' ? 'Geloescht' : 'Törölve', count: categorized.deleted.length, color: "bg-red-600" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => router.push("/admin")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <Briefcase size={22} className="text-violet-600" />
        <h1 className="text-lg font-bold text-gray-900">{market === 'de' ? 'Anfragen verwalten' : 'Igények kezelése'}</h1>
        {!loadingData && (
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {market === 'de' ? `${demands.length} Anfragen gesamt` : `${demands.length} igény összesen`}
          </span>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={market === 'de' ? 'Suche nach Apotheke, Stadt, Datum, Position…' : 'Keresés gyógyszertár, város, dátum, pozíció…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? `${tab.color} text-white shadow-sm`
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs rounded-full px-1 ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase size={48} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              {searchQuery
                ? (market === 'de' ? 'Keine Treffer fuer die Suche' : 'Nincs találat a keresésre')
                : (market === 'de' ? 'Keine Anfragen in dieser Kategorie' : 'Nincsenek igények ebben a kategóriában')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((demand) => (
              <DemandCard
                key={demand.id}
                demand={demand}
                applications={applications}
                creatorData={creatorMap[demand.pharmacyId || demand.createdBy]}
                onDelete={isAdmin ? setDeleteTarget : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        demandName={`${deleteTarget?.pharmacyName || "?"} — ${formatDayOnly(deleteTarget?.date)}`}
      />
    </div>
  );
}
