"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Users, Building2, Pill, UserCog, TrendingUp, ArrowLeft, 
  AlertCircle,
  MessageSquare, Bell, ShieldCheck,
  Activity, Send, UserCheck, UserX
} from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function StatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user || (!ADMIN_EMAILS.includes(user.email) && !ADMINKA_EMAILS.includes(user.email))) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && (ADMIN_EMAILS.includes(user.email) || ADMINKA_EMAILS.includes(user.email))) {
      loadStats();
    }
  }, [user]);

  const parseDate = (val) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    if (typeof val === 'string') return new Date(val);
    return null;
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const [usersSnap, chatsSnap, notifsSnap, pushSnap, approvalsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'chats')),
        getDocs(collection(db, 'notifications')),
        getDocs(collection(db, 'pushSubscriptions')),
        getDocs(collection(db, 'pharmagisterApprovals')),
      ]);

      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const chats = chatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const notifications = notifsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pushSubs = pushSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const approvals = approvalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // ===== FELHASZNÁLÓK =====
      const activeUsers = users.filter(u => u.emailVerified && u.passwordActivated);
      const pharmacists = activeUsers.filter(u => u.pharmagisterRole === 'pharmacist' || u.pharmagisterRole === 'gyógyszerész');
      const pharmaciesArr = activeUsers.filter(u => u.pharmagisterRole === 'pharmacy' || u.pharmagisterRole === 'gyógyszertár');
      const assistants = activeUsers.filter(u => u.pharmagisterRole === 'assistant' || u.pharmagisterRole === 'szakasszisztens');
      const profileComplete = activeUsers.filter(u => u.pharmaProfileComplete);
      const profileIncomplete = activeUsers.filter(u => !u.pharmaProfileComplete);
      const noRole = activeUsers.filter(u => !u.pharmagisterRole);

      // ===== AKTIVITÁS =====
      const getActiveInPeriod = (since) => activeUsers.filter(u => {
        const ll = parseDate(u.lastLogin);
        return ll && ll > since;
      });
      const dau = getActiveInPeriod(last24h);
      const wau = getActiveInPeriod(last7d);
      const mau = getActiveInPeriod(last30d);

      const countRoles = (list) => ({
        pharmacist: list.filter(u => u.pharmagisterRole === 'pharmacist' || u.pharmagisterRole === 'gyógyszerész').length,
        pharmacy: list.filter(u => u.pharmagisterRole === 'pharmacy' || u.pharmagisterRole === 'gyógyszertár').length,
        assistant: list.filter(u => u.pharmagisterRole === 'assistant' || u.pharmagisterRole === 'szakasszisztens').length,
      });

      // ===== CHAT & PUSH =====
      const activeChats = chats.filter(c => c.lastMessage);
      const uniquePushUsers = new Set(pushSubs.map(s => s.userId)).size;
      const unreadNotifs = notifications.filter(n => !n.read).length;

      // ===== NNK =====
      const pendingApprovals = approvals.filter(a => a.status === 'pending');
      const approvedApprovals = approvals.filter(a => a.status === 'approved');
      const rejectedApprovals = approvals.filter(a => a.status === 'rejected');

      setStats({
        users: { totalAll: users.length, active: activeUsers.length, pharmacists: pharmacists.length, pharmacies: pharmaciesArr.length, assistants: assistants.length, profileComplete: profileComplete.length, profileIncomplete: profileIncomplete.length, noRole: noRole.length },
        activity: { dau: { total: dau.length, ...countRoles(dau) }, wau: { total: wau.length, ...countRoles(wau) }, mau: { total: mau.length, ...countRoles(mau) } },
        chat: { total: chats.length, active: activeChats.length },
        push: { subscribers: uniquePushUsers, unreadNotifs },
        approvals: { pending: pendingApprovals.length, approved: approvedApprovals.length, rejected: rejectedApprovals.length },
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading || !user || (!ADMIN_EMAILS.includes(user.email) && !ADMINKA_EMAILS.includes(user.email))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Betöltés...</div>
      </div>
    );
  }

  const backUrl = ADMINKA_EMAILS.includes(user.email) ? '/adminka' : '/admin';

  const MiniCard = ({ icon: Icon, label, value, color = 'text-gray-700', bg = 'bg-gray-50' }) => (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <Icon className={`mx-auto mb-2 ${color}`} size={24} />
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );

  const BigCard = ({ icon: Icon, label, value, sub, color, bg }) => (
    <div className={`${bg} rounded-xl p-6 text-center border-2 ${color.replace('text-', 'border-')}`}>
      <Icon className={`mx-auto mb-3 ${color}`} size={36} />
      <p className={`text-4xl font-bold ${color} mb-1`}>{value}</p>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">📊 Admin Statisztikák</h1>
            <p className="text-gray-500 mt-1">Teljes platform áttekintés</p>
          </div>
          <button onClick={() => router.push(backUrl)} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
            <ArrowLeft size={18} /> Vissza
          </button>
        </div>

        {loadingStats || !stats ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Statisztikák betöltése...</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* 1. FELHASZNÁLÓK */}
            <section className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users size={22} /> Felhasználók
              </h2>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600">
                  Összes regisztráció: <span className="font-bold">{stats.users.totalAll}</span> &nbsp;|&nbsp;
                  Aktív: <span className="font-bold text-green-600">{stats.users.active}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniCard icon={Pill} label="Gyógyszerész" value={stats.users.pharmacists} color="text-blue-600" bg="bg-blue-50" />
                <MiniCard icon={Building2} label="Gyógyszertár" value={stats.users.pharmacies} color="text-green-600" bg="bg-green-50" />
                <MiniCard icon={UserCog} label="Szakasszisztens" value={stats.users.assistants} color="text-orange-600" bg="bg-orange-50" />
                <MiniCard icon={UserCheck} label="Profil kész" value={stats.users.profileComplete} color="text-emerald-600" bg="bg-emerald-50" />
                <MiniCard icon={UserX} label="Profil hiányos" value={stats.users.profileIncomplete} color="text-red-500" bg="bg-red-50" />
                <MiniCard icon={AlertCircle} label="Nincs szerepkör" value={stats.users.noRole} color="text-gray-500" bg="bg-gray-100" />
              </div>
            </section>

            {/* 2. AKTIVITÁS */}
            <section className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity size={22} /> Aktivitás (DAU / WAU / MAU)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <BigCard icon={TrendingUp} label="DAU" value={stats.activity.dau.total} sub="Elmúlt 24 óra" color="text-blue-600" bg="bg-blue-50" />
                <BigCard icon={TrendingUp} label="WAU" value={stats.activity.wau.total} sub="Elmúlt 7 nap" color="text-green-600" bg="bg-green-50" />
                <BigCard icon={TrendingUp} label="MAU" value={stats.activity.mau.total} sub="Elmúlt 30 nap" color="text-purple-600" bg="bg-purple-50" />
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Bontás szerepkörönként</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-4">Időszak</th>
                        <th className="py-2 px-4 text-center">Gyógyszerész</th>
                        <th className="py-2 px-4 text-center">Gyógyszertár</th>
                        <th className="py-2 px-4 text-center">Szakasszisztens</th>
                        <th className="py-2 px-4 text-center font-bold">Összesen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: '24 óra (DAU)', data: stats.activity.dau },
                        { label: '7 nap (WAU)', data: stats.activity.wau },
                        { label: '30 nap (MAU)', data: stats.activity.mau },
                      ].map((row, i) => (
                        <tr key={i} className={i < 2 ? 'border-b' : ''}>
                          <td className="py-2 pr-4 font-medium">{row.label}</td>
                          <td className="py-2 px-4 text-center text-blue-600 font-semibold">{row.data.pharmacist}</td>
                          <td className="py-2 px-4 text-center text-green-600 font-semibold">{row.data.pharmacy}</td>
                          <td className="py-2 px-4 text-center text-orange-600 font-semibold">{row.data.assistant}</td>
                          <td className="py-2 px-4 text-center font-bold">{row.data.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 3. PLATFORM EGÉSZSÉG */}
            <section className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ShieldCheck size={22} /> Platform egészség
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <MiniCard icon={MessageSquare} label="Chat beszélgetés" value={stats.chat.total} color="text-indigo-600" bg="bg-indigo-50" />
                <MiniCard icon={Send} label="Aktív chat" value={stats.chat.active} color="text-indigo-500" bg="bg-indigo-50" />
                <MiniCard icon={Bell} label="Push feliratkozó" value={stats.push.subscribers} color="text-pink-600" bg="bg-pink-50" />
                <MiniCard icon={AlertCircle} label="Olvasatlan értesítés" value={stats.push.unreadNotifs} color="text-orange-500" bg="bg-orange-50" />
                <MiniCard icon={ShieldCheck} label="NNK várakozó" value={stats.approvals.pending} color="text-amber-600" bg="bg-amber-50" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mt-4 text-sm text-gray-600">
                NNK státusz: <span className="text-green-600 font-semibold">{stats.approvals.approved} jóváhagyva</span> &nbsp;|&nbsp;
                <span className="text-red-500 font-semibold">{stats.approvals.rejected} elutasítva</span> &nbsp;|&nbsp;
                <span className="text-amber-600 font-semibold">{stats.approvals.pending} függőben</span>
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
