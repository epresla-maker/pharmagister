"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Users, ArrowLeft, Search, Bell, BellOff, Mail,
  Pill, Building2, UserCog, AlertCircle, Clock, UserCheck
} from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [pushSubs, setPushSubs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user || !ADMIN_EMAILS.includes(user.email)) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
      loadData();
    }
  }, [user]);

  const parseDate = (val) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    if (typeof val === 'string') return new Date(val);
    return null;
  };

  const formatDate = (val) => {
    const d = parseDate(val);
    if (!d || isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) + 
      ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [usersSnap, pushSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'pushSubscriptions')),
      ]);

      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pushData = pushSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setUsers(usersData);
      setPushSubs(pushData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const pushUserIds = useMemo(() => {
    return new Set(pushSubs.map(s => s.userId));
  }, [pushSubs]);

  const getRoleLabel = (role) => {
    if (role === 'pharmacist' || role === 'gyógyszerész') return 'Gyógyszerész';
    if (role === 'pharmacy' || role === 'gyógyszertár') return 'Gyógyszertár';
    if (role === 'assistant' || role === 'szakasszisztens') return 'Szakasszisztens';
    return 'Nincs';
  };

  const getRoleIcon = (role) => {
    if (role === 'pharmacist' || role === 'gyógyszerész') return Pill;
    if (role === 'pharmacy' || role === 'gyógyszertár') return Building2;
    if (role === 'assistant' || role === 'szakasszisztens') return UserCog;
    return AlertCircle;
  };

  const getRoleColor = (role) => {
    if (role === 'pharmacist' || role === 'gyógyszerész') return 'text-blue-600 bg-blue-50';
    if (role === 'pharmacy' || role === 'gyógyszertár') return 'text-green-600 bg-green-50';
    if (role === 'assistant' || role === 'szakasszisztens') return 'text-orange-600 bg-orange-50';
    return 'text-gray-500 bg-gray-100';
  };

  // Filter out pharmacies - they have their own page
  const nonPharmacyUsers = useMemo(() => {
    return users.filter(u => {
      const role = u.pharmagisterRole;
      return role !== 'pharmacy' && role !== 'gyógyszertár';
    });
  }, [users]);

  const activeNonPharmacyUsers = useMemo(() => {
    return nonPharmacyUsers.filter(u => u.emailVerified && u.passwordActivated);
  }, [nonPharmacyUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return nonPharmacyUsers;
    return nonPharmacyUsers.filter(u => {
      const name = (u.displayName || u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [nonPharmacyUsers, searchQuery]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const dateA = parseDate(a.lastLogin) || parseDate(a.lastSeen);
      const dateB = parseDate(b.lastLogin) || parseDate(b.lastSeen);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA;
    });
  }, [filteredUsers]);

  if (loading || !user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">👥 Felhasználók</h1>
            <p className="text-gray-500 mt-1">
              Összes regisztráció: <strong>{nonPharmacyUsers.length}</strong> | 
              Aktív: <strong className="text-green-600">{activeNonPharmacyUsers.length}</strong> |
              Találat: <strong>{sortedUsers.length}</strong>
            </p>
          </div>
          <button 
            onClick={() => router.push('/admin')} 
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} /> Vissza
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Keresés név vagy email alapján..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Active users breakdown by role */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-center">
            <Pill className="mx-auto text-blue-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-blue-600">
              {activeNonPharmacyUsers.filter(u => u.pharmagisterRole === 'pharmacist' || u.pharmagisterRole === 'gyógyszerész').length}
            </p>
            <p className="text-xs text-gray-600 font-medium">Gyógyszerész</p>
          </div>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-3 text-center">
            <UserCog className="mx-auto text-orange-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-orange-600">
              {activeNonPharmacyUsers.filter(u => u.pharmagisterRole === 'assistant' || u.pharmagisterRole === 'szakasszisztens').length}
            </p>
            <p className="text-xs text-gray-600 font-medium">Szakasszisztens</p>
          </div>
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 text-center">
            <AlertCircle className="mx-auto text-gray-500 mb-2" size={24} />
            <p className="text-2xl font-bold text-gray-600">
              {activeNonPharmacyUsers.filter(u => !u.pharmagisterRole).length}
            </p>
            <p className="text-xs text-gray-600 font-medium">Nincs szerepkör</p>
          </div>
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 text-center">
            <UserCheck className="mx-auto text-green-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-green-600">{activeNonPharmacyUsers.length}</p>
            <p className="text-xs text-gray-600 font-medium">Összes aktív</p>
          </div>
        </div>

        {loadingData ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Felhasználók betöltése...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 border-b">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Név</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Szerepkör</th>
                    <th className="py-3 px-4">Utolsó belépés</th>
                    <th className="py-3 px-4 text-center">Push</th>
                    <th className="py-3 px-4 text-center">Státusz</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u, index) => {
                    const RoleIcon = getRoleIcon(u.pharmagisterRole);
                    const roleColor = getRoleColor(u.pharmagisterRole);
                    const hasPush = pushUserIds.has(u.id);
                    const hasLoggedIn = !!(u.lastLogin || u.lastSeen);
                    const isActivated = u.emailVerified && u.passwordActivated;
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-center text-gray-400 text-xs font-mono">{index + 1}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-800">
                            {u.displayName || u.name || u.pharmacyName || 'Nincs név'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Mail size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs">{u.email || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${roleColor}`}>
                            <RoleIcon size={12} />
                            {getRoleLabel(u.pharmagisterRole)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock size={12} className="text-gray-400" />
                            {u.lastLogin ? (
                              <span className="text-gray-500">{formatDate(u.lastLogin)}</span>
                            ) : u.lastSeen ? (
                              <span className="text-gray-400" title="Utoljára aktív (nem lépett be újra)">{formatDate(u.lastSeen)} <span className="text-orange-400">(aktív)</span></span>
                            ) : (
                              <span className="text-red-400">Soha nem lépett be</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasPush ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <Bell size={16} />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-300">
                              <BellOff size={16} />
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasLoggedIn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <UserCheck size={12} /> Aktív
                            </span>
                          ) : isActivated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              Aktivált
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Inaktív
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {sortedUsers.map((u, index) => {
                const RoleIcon = getRoleIcon(u.pharmagisterRole);
                const roleColor = getRoleColor(u.pharmagisterRole);
                const hasPush = pushUserIds.has(u.id);
                const hasLoggedIn = !!(u.lastLogin || u.lastSeen);
                const isActivated = u.emailVerified && u.passwordActivated;
                return (
                  <div key={u.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 font-mono mt-0.5">{index + 1}.</span>
                        <div>
                        <p className="font-semibold text-gray-800">
                          {u.displayName || u.name || u.pharmacyName || 'Nincs név'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{u.email || '-'}</p>
                      </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasPush ? (
                          <Bell size={16} className="text-green-600" />
                        ) : (
                          <BellOff size={16} className="text-gray-300" />
                        )}
                        {hasLoggedIn ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Aktív</span>
                        ) : isActivated ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Aktivált</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inaktív</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${roleColor}`}>
                        <RoleIcon size={12} />
                        {getRoleLabel(u.pharmagisterRole)}
                      </span>
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock size={12} />
                        {u.lastLogin ? (
                          formatDate(u.lastLogin)
                        ) : u.lastSeen ? (
                          <span>{formatDate(u.lastSeen)} <span className="text-orange-400">(aktív)</span></span>
                        ) : (
                          <span className="text-red-400">Soha</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {sortedUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users size={48} className="mx-auto mb-3 text-gray-300" />
                <p>Nincs találat a keresésre.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
