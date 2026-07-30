"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const ADMIN_EMAILS = new Set(["epresla@icloud.com", "etinatina22@gmail.com"]);

function formatDate(value) {
  if (!value) return "-";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("hu-HU");
}

function statusLabel(status) {
  if (status === "active") return "Aktív";
  if (status === "pending") return "Függő";
  if (status === "rejected") return "Elutasított";
  if (status === "closed") return "Lezárt";
  return "Tervezet";
}

function statusClass(status) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  if (status === "closed") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function ProfessionalCampaignListPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = ADMIN_EMAILS.has(String(user?.email || "").toLowerCase());
  const isProfessionalPartner = useMemo(
    () => Boolean(userData?.partnerProfessional || userData?.accountType === "partner_professional"),
    [userData]
  );

  const loadItems = async () => {
    if (!user?.uid || (!isProfessionalPartner && !isAdmin)) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);
    setError("");

    try {
      const baseRef = collection(db, "partnerProfessionalCampaigns");
      const q = isAdmin ? query(baseRef) : query(baseRef, where("ownerId", "==", user.uid));
      const snap = await getDocs(q);

      const rows = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

      setItems(rows);
    } catch (e) {
      console.error("Professional campaigns load error:", e);
      setError("Nem sikerült betölteni a kampányokat.");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [user?.uid, isProfessionalPartner, isAdmin]);

  const handleDelete = async (id) => {
    if (!confirm("Biztosan törlöd ezt a kampányt?")) return;

    try {
      await deleteDoc(doc(db, "partnerProfessionalCampaigns", id));
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Campaign delete error:", e);
      alert("Nem sikerült törölni a kampányt.");
    }
  };

  const handleApprove = async (id) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, "partnerProfessionalCampaigns", id), {
        status: "active",
        approvedAt: serverTimestamp(),
        approvedBy: user?.uid || null,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "active" } : x)));
    } catch (e) {
      console.error("Campaign activate error:", e);
      alert("Nem sikerült aktiválni a kampányt.");
    }
  };

  const handleReject = async (id) => {
    if (!isAdmin) return;
    const reason = window.prompt("Elutasítás indoka (opcionális):", "") || "";

    try {
      await updateDoc(doc(db, "partnerProfessionalCampaigns", id), {
        status: "rejected",
        rejectionReason: reason.trim() || null,
        rejectedAt: serverTimestamp(),
        rejectedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "rejected", rejectionReason: reason.trim() || null } : x)));
    } catch (e) {
      console.error("Campaign reject error:", e);
      alert("Nem sikerült elutasítani a kampányt.");
    }
  };

  const handleClose = async (id) => {
    try {
      await updateDoc(doc(db, "partnerProfessionalCampaigns", id), {
        status: "closed",
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "closed" } : x)));
    } catch (e) {
      console.error("Campaign close error:", e);
      alert("Nem sikerült lezárni a kampányt.");
    }
  };

  const handleResubmit = async (id) => {
    try {
      await updateDoc(doc(db, "partnerProfessionalCampaigns", id), {
        status: "pending",
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "pending", rejectionReason: null } : x)));
    } catch (e) {
      console.error("Campaign resubmit error:", e);
      alert("Nem sikerült újra beküldeni a kampányt.");
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-6 pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Saját szakmai kampányok</h1>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/partner")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Központ
              </button>
              <button
                type="button"
                onClick={() => router.push("/partner/szakmai-kampany-feladas")}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                + Új kampány
              </button>
            </div>
          </div>

          {loading || loadingItems ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">Betöltés...</div>
          ) : !isProfessionalPartner && !isAdmin ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              Ehhez a felülethez szakmai partner fiók szükséges.
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
              Még nincs szakmai kampányod.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{item.title || "Névtelen kampány"}</h2>
                        <p className="mt-1 text-sm text-slate-600">Szakmai kampány</p>
                        {isAdmin && (
                          <p className="mt-1 text-xs text-slate-500">Tulajdonos: {item.ownerName || item.ownerEmail || "-"}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">Létrehozva: {formatDate(item.createdAt)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm text-slate-700">{item.description || ""}</p>
                    {item.rejectionReason && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        Elutasítás indoka: {item.rejectionReason}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {isProfessionalPartner && item.ownerId === user?.uid && (
                        <button
                          type="button"
                          onClick={() => router.push(`/partner/szakmai-kampany-feladas?edit=${item.id}`)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Szerkesztés
                        </button>
                      )}

                      {isAdmin && item.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleApprove(item.id)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          Jóváhagyás
                        </button>
                      )}

                      {isAdmin && item.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleReject(item.id)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                        >
                          Elutasítás
                        </button>
                      )}

                      {isProfessionalPartner && item.ownerId === user?.uid && item.status === "active" && (
                        <button
                          type="button"
                          onClick={() => handleClose(item.id)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                        >
                          Lezárás
                        </button>
                      )}

                      {isProfessionalPartner && item.ownerId === user?.uid && ["rejected", "closed"].includes(item.status) && (
                        <button
                          type="button"
                          onClick={() => handleResubmit(item.id)}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Újraküldés jóváhagyásra
                        </button>
                      )}

                      {(isAdmin || (isProfessionalPartner && item.ownerId === user?.uid)) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                        >
                          Törlés
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
