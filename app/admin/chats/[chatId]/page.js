"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { getClientMarket } from "@/lib/marketI18n";

const ADMIN_EMAILS = ["epresla@icloud.com"];

function parseDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (typeof value === "string") return new Date(value);
  return null;
}

function formatMessageTime(value, market) {
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(market === "de" ? "de-DE" : "hu-HU", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadUserNames(ids) {
  const entries = await Promise.all(
    ids.map(async (id) => {
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

export default function AdminChatDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { chatId } = params;
  const market = getClientMarket();

  const [chatData, setChatData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [loadingChat, setLoadingChat] = useState(true);

  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  const isAuthorized = ADMIN_EMAILS.includes(normalizedEmail);

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push("/");
    }
  }, [loading, user, isAuthorized, router]);

  useEffect(() => {
    const loadChatMeta = async () => {
      if (!user || !isAuthorized || !chatId) return;
      setLoadingChat(true);
      try {
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (!chatSnap.exists()) {
          setChatData(null);
          setMessages([]);
          setMemberNames({});
          setLoadingChat(false);
          return;
        }

        const data = chatSnap.data();
        setChatData(data);

        const memberIds = Array.isArray(data.members) ? data.members : [];
        const names = await loadUserNames(memberIds);
        setMemberNames(names);
      } catch (error) {
        console.error("Error loading chat metadata:", error);
      } finally {
        setLoadingChat(false);
      }
    };

    loadChatMeta();
  }, [user, isAuthorized, chatId]);

  useEffect(() => {
    if (!user || !isAuthorized || !chatId) return;

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rows = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }));
        setMessages(rows);

        const senderIds = Array.from(new Set(rows.map((m) => m.senderId).filter(Boolean)));
        if (senderIds.length > 0) {
          const extraNames = await loadUserNames(senderIds);
          setMemberNames((prev) => ({ ...prev, ...extraNames }));
        }
      },
      (error) => {
        console.error("Error loading chat messages:", error);
        setMessages([]);
      }
    );

    return () => unsubscribe();
  }, [user, isAuthorized, chatId]);

  const title = useMemo(() => {
    if (!chatData) return chatId;
    const memberIds = Array.isArray(chatData.members) ? chatData.members : [];
    const labels = memberIds.map((id) => memberNames[id] || id);
    return labels.join(" <-> ") || chatId;
  }, [chatData, chatId, memberNames]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{market === "de" ? "Wird geladen..." : "Betöltés..."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {market === "de" ? "Chat-Details" : "Chat részletek"}
            </h1>
            <p className="text-sm text-gray-500 mt-1 break-all">{title}</p>
          </div>
          <button
            onClick={() => router.push("/admin/chats")}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} /> {market === "de" ? "Zurueck" : "Vissza"}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 break-all">Chat ID: {chatId}</p>
            {chatData?.relatedDemandId ? (
              <p className="text-xs text-gray-500 break-all">Demand ID: {chatData.relatedDemandId}</p>
            ) : null}
          </div>

          {loadingChat ? (
            <div className="p-8 text-center text-gray-500">
              {market === "de" ? "Chat wird geladen..." : "Chat betöltése..."}
            </div>
          ) : !chatData ? (
            <div className="p-8 text-center text-gray-500">
              {market === "de" ? "Chat nicht gefunden." : "A chat nem található."}
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {market === "de" ? "Keine Nachrichten." : "Nincs üzenet."}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {messages.map((msg) => {
                const senderName = memberNames[msg.senderId] || msg.senderName || msg.senderId || "?";
                const isSystem = msg.system === true;
                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl border px-3 py-2 ${isSystem ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-600" />
                        {senderName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatMessageTime(msg.createdAt || msg.timestamp, market)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {msg.text || msg.message || "-"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
