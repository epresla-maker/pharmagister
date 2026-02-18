"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft,
  MessageSquare,
  Search,
  User,
  Clock,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";

const ADMIN_EMAILS = ["epresla@icloud.com"];

function formatDate(val) {
  if (!val) return "";
  const d = val.toDate ? val.toDate() : new Date(val.seconds ? val.seconds * 1000 : val);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(val) {
  if (!val) return "";
  const d = val.toDate ? val.toDate() : new Date(val.seconds ? val.seconds * 1000 : val);
  if (!d || isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now - d;
  if (diff < 24 * 60 * 60 * 1000) {
    return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString("hu-HU", { weekday: "short" });
  }
  return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let lastDate = null;
  for (const msg of messages) {
    const d = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
    const dateStr = d
      ? d.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
      : null;
    if (dateStr !== lastDate) {
      groups.push({ type: "date", label: dateStr });
      lastDate = dateStr;
    }
    groups.push({ type: "message", ...msg });
  }
  return groups;
}

export default function AdminMessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [chats, setChats] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!loading && (!user || !ADMIN_EMAILS.includes(user.email))) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load all chats
  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) return;

    const load = async () => {
      setLoadingChats(true);
      try {
        const snap = await getDocs(collection(db, "chats"));
        const chatsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Collect all unique user IDs
        const allIds = new Set();
        chatsData.forEach((c) => (c.members || []).forEach((id) => allIds.add(id)));

        // Fetch user data
        const map = {};
        await Promise.all(
          [...allIds].map(async (uid) => {
            try {
              const uSnap = await getDoc(doc(db, "users", uid));
              if (uSnap.exists()) {
                const data = uSnap.data();
                const name =
                  data.pharmagisterRole === "pharmacy" && data.pharmacyName
                    ? data.pharmacyName
                    : data.displayName || data.name || "Ismeretlen";
                map[uid] = { name, email: data.email || "", role: data.pharmagisterRole || "" };
              } else {
                map[uid] = { name: "Törölt felhasználó", email: "", role: "" };
              }
            } catch {
              map[uid] = { name: "Ismeretlen", email: "", role: "" };
            }
          })
        );

        setUserMap(map);

        // Sort by last message
        chatsData.sort((a, b) => {
          const ta = a.lastMessageAt?.seconds || a.updatedAt?.seconds || 0;
          const tb = b.lastMessageAt?.seconds || b.updatedAt?.seconds || 0;
          return tb - ta;
        });

        setChats(chatsData);
      } catch (e) {
        console.error("Hiba a chetek betöltésekor:", e);
      } finally {
        setLoadingChats(false);
      }
    };

    load();
  }, [user]);

  // Load messages for selected chat
  const openChat = useCallback(
    async (chat) => {
      setSelectedChat(chat);
      setMessages([]);
      setLoadingMessages(true);
      try {
        const messagesRef = collection(db, "chats", chat.id, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
      } catch (e) {
        console.error("Hiba az üzenetek betöltésekor:", e);
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  const getChatTitle = (chat) => {
    if (chat.name) return chat.name;
    const members = chat.members || [];
    return members.map((id) => userMap[id]?.name || id).join(" ↔ ");
  };

  const getRoleLabel = (role) => {
    if (role === "pharmacist" || role === "gyógyszerész") return "Gyógyszerész";
    if (role === "pharmacy" || role === "gyógyszertár") return "Gyógyszertár";
    if (role === "assistant" || role === "szakasszisztens") return "Szakasszisztens";
    return role || "";
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = getChatTitle(chat).toLowerCase();
    if (title.includes(q)) return true;
    // search by member email
    return (chat.members || []).some(
      (id) =>
        (userMap[id]?.email || "").toLowerCase().includes(q) ||
        (userMap[id]?.name || "").toLowerCase().includes(q)
    );
  });

  const grouped = selectedChat ? groupMessagesByDate(messages) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.push("/admin")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <MessageSquare size={22} className="text-violet-600" />
        <h1 className="text-lg font-bold text-gray-900">Üzenetváltások</h1>
        {!loadingChats && (
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {chats.length} beszélgetés
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Chat list ── */}
        <div
          className={`flex flex-col bg-white border-r border-gray-200 ${
            selectedChat ? "hidden sm:flex w-72 xl:w-80 flex-shrink-0" : "flex-1 sm:w-72 xl:w-80 sm:flex-none"
          }`}
        >
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Keresés név, email alapján…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-gray-50"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={28} />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Nincs találat
              </div>
            ) : (
              filteredChats.map((chat) => {
                const title = getChatTitle(chat);
                const lastTs = chat.lastMessageAt || chat.updatedAt;
                const isActive = selectedChat?.id === chat.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => openChat(chat)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-violet-50 transition-colors flex items-start gap-3 ${
                      isActive ? "bg-violet-50 border-l-4 border-l-violet-500" : ""
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare size={16} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-gray-800 truncate">{title}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatShortDate(lastTs)}</span>
                      </div>
                      {chat.lastMessage && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{chat.lastMessage}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(chat.members || []).length} résztvevő
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 mt-1 flex-shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Message viewer ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <MessageSquare size={48} className="text-gray-200" />
              <p className="text-sm">Válassz ki egy beszélgetést a listából</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
                <button
                  className="sm:hidden p-1.5 rounded-lg hover:bg-gray-100"
                  onClick={() => setSelectedChat(null)}
                >
                  <X size={18} className="text-gray-500" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">{getChatTitle(selectedChat)}</h2>
                  <p className="text-xs text-gray-500">
                    {messages.length} üzenet · Csak olvasható nézet
                  </p>
                </div>

                {/* Participants */}
                <div className="ml-auto flex flex-wrap gap-1.5 justify-end">
                  {(selectedChat.members || []).map((uid) => {
                    const u = userMap[uid];
                    if (!u) return null;
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                      >
                        <User size={11} />
                        <span className="max-w-[120px] truncate">{u.name}</span>
                        {u.role && (
                          <span className="text-gray-400">({getRoleLabel(u.role)})</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Messages area — read-only PDF-like view */}
              <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin text-gray-400" size={28} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">
                    Nincsenek üzenetek ebben a beszélgetésben
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-1">
                    {grouped.map((item, idx) => {
                      if (item.type === "date") {
                        return (
                          <div key={`date-${idx}`} className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200 whitespace-nowrap">
                              {item.label}
                            </span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        );
                      }

                      const msg = item;
                      const sender = userMap[msg.senderId];
                      const senderName = sender?.name || "Ismeretlen";

                      return (
                        <div key={msg.id} className="flex flex-col gap-0.5 mb-3">
                          {/* Sender label */}
                          <div className="flex items-center gap-2 px-1">
                            <div className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center flex-shrink-0">
                              <User size={12} className="text-violet-700" />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{senderName}</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock size={10} />
                              {formatDate(msg.createdAt)}
                            </span>
                            {msg.edited && (
                              <span className="text-xs text-gray-400 italic">(szerkesztve)</span>
                            )}
                          </div>

                          {/* Message bubble */}
                          <div className="ml-8">
                            {msg.text && (
                              <div className="inline-block max-w-prose bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </div>
                            )}

                            {/* Image */}
                            {msg.imageUrl && (
                              <div className="mt-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.imageUrl}
                                  alt="Kép"
                                  className="max-w-xs rounded-xl border border-gray-200 shadow-sm"
                                />
                              </div>
                            )}

                            {/* Reactions */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(msg.reactions).map(([emoji, uids]) => (
                                  <span
                                    key={emoji}
                                    className="inline-flex items-center gap-1 bg-gray-100 text-xs px-2 py-0.5 rounded-full border border-gray-200"
                                  >
                                    {emoji}
                                    <span className="text-gray-500">{Array.isArray(uids) ? uids.length : uids}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Deleted message */}
                            {msg.deleted && (
                              <div className="inline-block bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-400 italic">
                                ⚠️ Üzenet törölve
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* End of conversation marker */}
                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
                      <span className="text-xs text-gray-400 mx-auto">
                        — Beszélgetés vége · {messages.length} üzenet összesen —
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Read-only footer indicator */}
              <div className="bg-gray-100 border-t border-gray-200 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <p className="text-xs text-gray-500 select-none">
                  Csak olvasható admin nézet — üzenet küldés nem lehetséges
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
