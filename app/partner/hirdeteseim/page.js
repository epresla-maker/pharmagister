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

function formatDate(value) {
  if (!value) return "-";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("hu-HU");
}

function statusLabel(status) {
  if (status === "approved") return "Aktív";
  if (status === "pending") return "Függőben";
  if (status === "sold") return "Eladva";
  if (status === "rejected") return "Elutasítva";
  if (status === "expired") return "Lejárt";
  return "Piszkozat";
}

function statusClass(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "sold") return "bg-blue-100 text-blue-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  if (status === "expired") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function PartnerListingsPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");

  const isMarketplacePartner = useMemo(
    () =>
      Boolean(
        userData?.partnerAdvertiser ||
          userData?.accountType === "partner_advertiser" ||
          userData?.accountType === "partner_marketplace"
      ),
    [userData]
  );

  const loadItems = async () => {
    if (!user?.uid || !isMarketplacePartner) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);
    setError("");

    try {
      const snap = await getDocs(
        query(
          collection(db, "equipmentMarketplacePosts"),
          where("sellerId", "==", user.uid)
        )
      );

      const rows = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .filter((x) => ["partner_advertiser", "partner_marketplace"].includes(String(x.sellerType || "")))
        .sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

      setItems(rows);
    } catch (e) {
      console.error("Partner listings load error:", e);
      setError("Nem sikerült betölteni a hirdetéseket.");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [user?.uid, isMarketplacePartner]);

  const handleDelete = async (id) => {
    if (!confirm("Biztosan törlöd ezt a hirdetést?")) return;

    try {
      await deleteDoc(doc(db, "equipmentMarketplacePosts", id));
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Partner listing delete error:", e);
      alert("Nem sikerült törölni a hirdetést.");
    }
  };

  const handleMarkSold = async (id) => {
    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", id), {
        status: "sold",
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "sold" } : x)));
    } catch (e) {
      console.error("Partner listing sold error:", e);
      alert("Nem sikerült frissíteni a státuszt.");
    }
  };

  const handleReopen = async (id) => {
    try {
      await updateDoc(doc(db, "equipmentMarketplacePosts", id), {
        status: "pending",
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "pending" } : x)));
    } catch (e) {
      console.error("Partner listing reopen error:", e);
      alert("Nem sikerült újra beküldeni jóváhagyásra.");
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Saját partner hirdetések</h1>
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
                onClick={() => router.push("/partner/hirdetes-feladas")}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                + Új hirdetés
              </button>
            </div>
          </div>

          {loading || loadingItems ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">Betöltés...</div>
          ) : !isMarketplacePartner ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              Ehhez a felülethez partner hirdetői fiók szükséges.
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
              Még nincs partner hirdetésed.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isSold = item.status === "sold";

                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{item.title || "Névtelen hirdetés"}</h2>
                        <p className="mt-1 text-sm text-slate-600">{item.postalCode ? `${item.postalCode} ` : ""}{item.location || "Nincs helyszín"}</p>
                        <p className="mt-1 text-xs text-slate-500">Létrehozva: {formatDate(item.createdAt)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm text-slate-700">{item.description || ""}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/partner/hirdetes-feladas?edit=${item.id}`)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Szerkesztés
                      </button>

                      {!isSold ? (
                        <button
                          type="button"
                          onClick={() => handleMarkSold(item.id)}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Eladottnak jelölöm
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReopen(item.id)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                        >
                          Újra beküldés jóváhagyásra
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Törlés
                      </button>
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
