"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Users, Building2, Pill, UserCog, TrendingUp, ArrowLeft, 
  AlertCircle, Calendar, FileText, CheckCircle, XCircle, Clock,
  MessageSquare, Bell, ShieldCheck, BarChart3, ChevronDown, ChevronUp,
  Activity, Send, UserCheck, UserX
} from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com', 'etinatina22@gmail.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function StatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expandedPharmacy, setExpandedPharmacy] = useState(null);

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
      const [usersSnap, demandsSnap, applicationsSnap, chatsSnap, notifsSnap, pushSnap, approvalsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'pharmaDemands')),
        getDocs(collection(db, 'pharmaApplications')),
        getDocs(collection(db, 'chats')),
        getDocs(collection(db, 'notifications')),
        getDocs(collection(db, 'pushSubscriptions')),
        getDocs(collection(db, 'pharmagisterApprovals')),
      ]);

      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const demands = demandsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const applications = applicationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const chats = chatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const notifications = notifsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pushSubs = pushSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const approvals = approvalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // ===== FELHASZNÁLÓK =====
      const activeUsers = users.filter(u => u.lastLogin || u.lastSeen);
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

      const countRoles = (list) => {
        const pharmacist = list.filter(u => u.pharmagisterRole === 'pharmacist' || u.pharmagisterRole === 'gyógyszerész').length;
        const pharmacy = list.filter(u => u.pharmagisterRole === 'pharmacy' || u.pharmagisterRole === 'gyógyszertár').length;
        const assistant = list.filter(u => u.pharmagisterRole === 'assistant' || u.pharmagisterRole === 'szakasszisztens').length;
        const noRole = list.length - pharmacist - pharmacy - assistant;
        return { pharmacist, pharmacy, assistant, noRole };
      };

      // ===== IGÉNYEK =====
      const todayStr = now.toISOString().split('T')[0];
      const activeDemands = demands.filter(d => {
        if (d.status !== 'open') return false;
        if (!d.date) return true;
        const dateStr = typeof d.date === 'string' ? d.date : (d.date.toDate ? d.date.toDate().toISOString().split('T')[0] : '');
        return dateStr >= todayStr;
      });

      // Összes valaha feladott igény (számláló - töröltek is benne vannak)
      let totalEverCreated = demands.length; // fallback
      try {
        const statsDoc = await getDoc(doc(db, 'firestoreStats', 'demands'));
        if (statsDoc.exists() && statsDoc.data().totalEverCreated) {
          totalEverCreated = statsDoc.data().totalEverCreated;
        }
      } catch (e) {
        console.error('Error loading demand stats counter:', e);
      }

      // ===== IGÉNY ÁLLAPOTOK =====
      const filledDemands = demands.filter(d => d.status === 'filled');
      // Igények ahol van jelentkezés de még nem döntöttek (status még open + van pending app)
      const demandsWaitingResponse = demands.filter(d => {
        if (d.status !== 'open') return false;
        return applications.some(a => a.demandId === d.id && a.status === 'pending');
      });
      // Igények ahol mindenkit elutasítottak (status még open + van app de mind rejected)
      const demandsAllRejected = demands.filter(d => {
        if (d.status !== 'open') return false;
        const apps = applications.filter(a => a.demandId === d.id);
        return apps.length > 0 && apps.every(a => a.status === 'rejected');
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
        demands: { total: demands.length, totalEver: totalEverCreated, active: activeDemands.length, filled: filledDemands.length, rejected: demandsAllRejected.length, waiting: demandsWaitingResponse.length },
        chat: { total: chats.length, active: activeChats.length },
        push: { subscribers: uniquePushUsers, unreadNotifs },
        approvals: { pending: pendingApprovals.length, approved: approvedApprovals.length, rejected: rejectedApprovals.length },
        // Gyógyszertár részletes bontás (csak admin)
        pharmacyDetails: (() => {
          const pharmacyMap = {};
          demands.forEach(d => {
            const pId = d.pharmacyId || d.createdBy || 'unknown';
            if (!pharmacyMap[pId]) {
              pharmacyMap[pId] = {
                pharmacyId: pId,
                pharmacyName: d.pharmacyName || 'Ismeretlen',
                pharmacyCity: d.pharmacyCity || '',
                demands: [],
              };
            }
            const demandApps = applications.filter(a => a.demandId === d.id);
            const hasApplicants = demandApps.length > 0;
            const hasAccepted = demandApps.some(a => a.status === 'accepted');
            const allRejected = hasApplicants && demandApps.every(a => a.status === 'rejected');
            const hasPending = demandApps.some(a => a.status === 'pending');
            
            let demandStatus = 'Nincs jelentkező';
            if (d.status === 'filled' || hasAccepted) demandStatus = 'Betöltve';
            else if (allRejected) demandStatus = 'Mindenkit elutasították';
            else if (hasPending) demandStatus = 'Vár válaszra';
            
            pharmacyMap[pId].demands.push({
              id: d.id,
              date: d.date || '-',
              position: d.position === 'pharmacist' ? 'Gyógyszerész' : d.position === 'assistant' ? 'Szakasszisztens' : d.position || '-',
              status: d.status,
              demandStatus,
              applicantCount: demandApps.length,
              applicants: demandApps.map(app => {
                const applicantUser = users.find(u => u.id === app.applicantId || u.id === app.userId);
                return {
                  id: app.id,
                  name: applicantUser ? (applicantUser.displayName || applicantUser.name || applicantUser.email || 'Ismeretlen') : (app.applicantName || 'Ismeretlen'),
                  role: applicantUser?.pharmagisterRole === 'pharmacist' || applicantUser?.pharmagisterRole === 'gyógyszerész' ? 'Gyógyszerész' : applicantUser?.pharmagisterRole === 'assistant' || applicantUser?.pharmagisterRole === 'szakasszisztens' ? 'Szakasszisztens' : '-',
                  status: app.status,
                  appliedAt: app.createdAt || app.appliedAt,
                  decidedAt: app.acceptedAt || app.rejectedAt || app.updatedAt,
                };
              }),
              createdAt: d.createdAt,
            });
          });
          return Object.values(pharmacyMap).sort((a, b) => b.demands.length - a.demands.length);
        })(),
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
                        <th className="py-2 px-4 text-center">Nincs szerep</th>
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
                          <td className="py-2 px-4 text-center text-gray-400 font-semibold">{row.data.noRole > 0 ? row.data.noRole : '-'}</td>
                          <td className="py-2 px-4 text-center font-bold">{row.data.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 3. IGÉNYEK */}
            <section className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar size={22} /> Helyettesítési igények
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 mb-6">
                <BigCard icon={BarChart3} label="Összes feladott igény" value={stats.demands.totalEver} sub="Valaha létrehozott (töröltekkel együtt)" color="text-purple-600" bg="bg-purple-50" />
                <BigCard icon={FileText} label="Jelenleg aktív" value={stats.demands.active} sub="Nyitott, jövőbeli dátummal" color="text-blue-600" bg="bg-blue-50" />
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Igények állapota</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={18} className="text-green-600" />
                      <p className="text-xl font-bold text-green-600">{stats.demands.filled}</p>
                    </div>
                    <p className="text-sm text-gray-600">Betöltött</p>
                    <p className="text-xs text-gray-400 mt-1">Jelentkező elfogadva, igény lezárva</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle size={18} className="text-red-600" />
                      <p className="text-xl font-bold text-red-600">{stats.demands.rejected}</p>
                    </div>
                    <p className="text-sm text-gray-600">Mindenkit elutasítottak</p>
                    <p className="text-xs text-gray-400 mt-1">Minden jelentkező elutasítva, igény még nyitott</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={18} className="text-yellow-600" />
                      <p className="text-xl font-bold text-yellow-600">{stats.demands.waiting}</p>
                    </div>
                    <p className="text-sm text-gray-600">Vár válaszra</p>
                    <p className="text-xs text-gray-400 mt-1">Van jelentkező, de még nem döntöttek</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. GYÓGYSZERTÁRAK RÉSZLETES BONTÁS - CSAK ADMIN */}
            {ADMIN_EMAILS.includes(user.email) && stats.pharmacyDetails && (
              <section className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 size={22} /> Gyógyszertárak igényei részletesen
                </h2>
                <div className="space-y-3">
                  {stats.pharmacyDetails.map((pharmacy) => (
                    <div key={pharmacy.pharmacyId} className="border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedPharmacy(expandedPharmacy === pharmacy.pharmacyId ? null : pharmacy.pharmacyId)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 size={20} className="text-green-600" />
                          <div>
                            <p className="font-semibold text-gray-800">{pharmacy.pharmacyName}</p>
                            <p className="text-xs text-gray-500">{pharmacy.pharmacyCity}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-purple-600">{pharmacy.demands.length}</p>
                            <p className="text-xs text-gray-500">igény</p>
                          </div>
                          {expandedPharmacy === pharmacy.pharmacyId 
                            ? <ChevronUp size={20} className="text-gray-400" />
                            : <ChevronDown size={20} className="text-gray-400" />}
                        </div>
                      </button>
                      {expandedPharmacy === pharmacy.pharmacyId && (
                        <div className="p-4 border-t">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-500 border-b">
                                  <th className="py-2 pr-3">Dátum</th>
                                  <th className="py-2 px-3">Pozíció</th>
                                  <th className="py-2 px-3 text-center">Jelentkezők</th>
                                  <th className="py-2 px-3">Állapot</th>
                                  <th className="py-2 pl-3">Létrehozva</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pharmacy.demands
                                  .sort((a, b) => (a.date > b.date ? -1 : 1))
                                  .map((d) => (
                                  <React.Fragment key={d.id}>
                                  <tr className="border-b last:border-0">
                                    <td className="py-2 pr-3 font-medium">{d.date}</td>
                                    <td className="py-2 px-3">{d.position}</td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`font-semibold ${d.applicantCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {d.applicantCount}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                        d.demandStatus === 'Betöltve' ? 'bg-green-100 text-green-700' :
                                        d.demandStatus === 'Mindenkit elutasították' ? 'bg-red-100 text-red-700' :
                                        d.demandStatus === 'Vár válaszra' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {d.demandStatus === 'Betöltve' && <CheckCircle size={12} />}
                                        {d.demandStatus === 'Mindenkit elutasították' && <XCircle size={12} />}
                                        {d.demandStatus === 'Vár válaszra' && <Clock size={12} />}
                                        {d.demandStatus}
                                      </span>
                                    </td>
                                    <td className="py-2 pl-3 text-xs text-gray-400">
                                      {d.createdAt 
                                        ? (typeof d.createdAt === 'string' 
                                            ? new Date(d.createdAt).toLocaleDateString('hu-HU') 
                                            : d.createdAt.seconds 
                                              ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('hu-HU')
                                              : '-')
                                        : '-'}
                                    </td>
                                  </tr>
                                  {d.applicants && d.applicants.length > 0 && (
                                    <tr>
                                      <td colSpan={5} className="pb-3 pt-0 px-2">
                                        <div className="ml-4 bg-blue-50 rounded-lg p-3">
                                          <p className="text-xs font-semibold text-blue-700 mb-2">👤 Jelentkezők:</p>
                                          <div className="space-y-1.5">
                                            {d.applicants.map(app => {
                                              const formatDate = (val) => {
                                                if (!val) return '-';
                                                if (typeof val === 'string') return new Date(val).toLocaleDateString('hu-HU');
                                                if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString('hu-HU');
                                                return '-';
                                              };
                                              return (
                                                <div key={app.id} className="flex items-center justify-between text-xs bg-white rounded-md px-3 py-1.5">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-800">{app.name}</span>
                                                    <span className="text-gray-400">({app.role})</span>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                    <span className="text-gray-400">Jelentkezett: {formatDate(app.appliedAt)}</span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                                                      app.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                                      app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                      'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                      {app.status === 'accepted' && <><CheckCircle size={10} /> Elfogadva</>}
                                                      {app.status === 'rejected' && <><XCircle size={10} /> Elutasítva</>}
                                                      {app.status === 'pending' && <><Clock size={10} /> Függőben</>}
                                                    </span>
                                                    {app.decidedAt && app.status !== 'pending' && (
                                                      <span className="text-gray-400">({formatDate(app.decidedAt)})</span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-3 flex gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                            <span>Betöltve: <strong className="text-green-600">{pharmacy.demands.filter(d => d.demandStatus === 'Betöltve').length}</strong></span>
                            <span>Elutasítva: <strong className="text-red-600">{pharmacy.demands.filter(d => d.demandStatus === 'Mindenkit elutasították').length}</strong></span>
                            <span>Függőben: <strong className="text-yellow-600">{pharmacy.demands.filter(d => d.demandStatus === 'Vár válaszra').length}</strong></span>
                            <span>Nincs jelentkező: <strong className="text-gray-500">{pharmacy.demands.filter(d => d.demandStatus === 'Nincs jelentkező').length}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. PLATFORM EGÉSZSÉG */}
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
