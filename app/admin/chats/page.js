"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, MessageSquare, Search } from "lucide-react";
import { getClientMarket } from "@/lib/marketI18n";

const ADMIN_EMAILS = ["epresla@icloud.com"];

function parseDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (typeof value === "string") return new Date(value);
  return null;
}

function formatDateTime(value, market) {
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(market === "de" ? "de-DE" : "hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function resolveMemberNames(memberIds) {
  const entries = await Promise.all(
    memberIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "users", id));
        if (!snap.exists()) return [id, id];
        const data = snap.data();
        const name =
          (data.pharmagisterRole === "pharmacy" && data.pharmacyName) ||
          data.displayName ||
          data.email ||
          id;
        return [id, name];
      } catch {
        return [id, id];
      }
    })
  );

  return Object.fromEntries(entries);
}

export default function AdminChatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const [loadingData, setLoadingData] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  const isAuthorized = ADMIN_EMAILS.includes(normalizedEmail);

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push("/");
    }
  }, [loading, user, isAuthorized, router]);

  useEffect(() => {
    const loadChats = async () => {
      if (!user || !isAuthorized) return;
      setLoadingData(true);
      try {
        const chatsSnap = await getDocs(query(collection(db, "chats"), orderBy("lastMessageAt", "desc")));

        const chatsData = chatsSnap.docs.map((snap) => ({
          id: snap.id,
          ...snap.data(),
        }));

        const uniqueMemberIds = Array.from(
          new Set(
            chatsData
              .flatMap((chat) => (Array.isArray(chat.members) ? chat.members : []))
              .filter(Boolean)
          )
        );

        const memberNames = await resolveMemberNames(uniqueMemberIds);

        const mappedRows = chatsData.map((chat) => {
          const memberIds = Array.isArray(chat.members) ? chat.members : [];
          const memberLabels = memberIds.map((id) => memberNames[id] || id);
          return {
            id: chat.id,
            memberIds,
            memberLabels,
            memberDisplay: memberLabels.join(" <-> "),
            lastMessage: chat.lastMessage || "",
            lastMessageAt: chat.lastMessageAt || chat.updatedAt || null,
            relatedDemandId: chat.relatedDemandId || null,
          };
        });

        setRows(mappedRows);
      } catch (error) {
        console.error("Error loading admin chats:", error);
        setRows([]);
      } finally {
        setLoadingData(false);
      }
    };

    loadChats();
  }, [user, isAuthorized]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const members = row.memberDisplay.toLowerCase();
      const message = String(row.lastMessage || "").toLowerCase();
      const demand = String(row.relatedDemandId || "").toLowerCase();
      return members.includes(q) || message.includes(q) || demand.includes(q) || row.id.toLowerCase().includes(q);
    });
  }, [rows, search]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{market === "de" ? "Wird geladen..." : "Betöltés..."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {market === "de" ? "Chat-Gespraeche" : "Chat beszélgetések"}
            </h1>
            <p className="text-gray-500 mt-1">
              {market === "de" ? "Gesamt" : "Összes"}: <strong>{rows.length}</strong>
              {" | "}
              {market === "de" ? "Treffer" : "Találat"}: <strong>{filteredRows.length}</strong>
            </p>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} /> {market === "de" ? "Zurueck" : "Vissza"}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={market === "de" ? "Suche in Gespraechen..." : "Keresés beszélgetésben..."}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {loadingData ? (
            <div className="p-8 text-center text-gray-500">
              {market === "de" ? "Gespraeche werden geladen..." : "Beszélgetések betöltése..."}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {market === "de" ? "Keine Gespraeche gefunden." : "Nincs találat."}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => router.push(`/admin/chats/${row.id}`)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-600 shrink-0" />
                        {row.memberDisplay || row.id}
                      </p>
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {row.lastMessage || (market === "de" ? "Keine letzte Nachricht" : "Nincs utolsó üzenet")}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Chat ID: {row.id}
                        {row.relatedDemandId ? ` | Demand: ${row.relatedDemandId}` : ""}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {formatDateTime(row.lastMessageAt, market)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
