"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Building2, ArrowLeft, Search, Bell, BellOff, Mail,
  MapPin, Clock, UserCheck, User, Phone
} from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

export default function AdminPharmaciesPage() {
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

      // Filter only pharmacies
      const pharmacies = usersData.filter(u => {
        const role = u.pharmagisterRole;
        return role === 'pharmacy' || role === 'gyógyszertár';
      });

      setUsers(pharmacies);
      setPushSubs(pushData);
    } catch (error) {
      console.error('Error loading pharmacies:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const pushUserIds = useMemo(() => {
    return new Set(pushSubs.map(s => s.userId));
  }, [pushSubs]);

  const getAddress = (u) => {
    const parts = [
      u.pharmacyZipCode,
      u.pharmacyCity,
      u.pharmacyStreet ? `${u.pharmacyStreet} ${u.pharmacyHouseNumber || ''}`.trim() : null
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => {
      const name = (u.pharmacyName || u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const city = (u.pharmacyCity || '').toLowerCase();
      const contact = (u.contactName || u.displayName || '').toLowerCase();
      return name.includes(q) || email.includes(q) || city.includes(q) || contact.includes(q);
    });
  }, [users, searchQuery]);

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">🏥 Gyógyszertárak</h1>
            <p className="text-gray-500 mt-1">
              Összes: <strong>{users.length}</strong> | Találat: <strong>{sortedUsers.length}</strong>
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
              placeholder="Keresés név, város, kapcsolattartó vagy email alapján..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {loadingData ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Gyógyszertárak betöltése...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 border-b">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Gyógyszertár neve</th>
                    <th className="py-3 px-4">Kapcsolattartó</th>
                    <th className="py-3 px-4">Cím</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Utolsó belépés</th>
                    <th className="py-3 px-4 text-center">Push</th>
                    <th className="py-3 px-4 text-center">Státusz</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u, index) => {
                    const hasPush = pushUserIds.has(u.id);
                    const hasLoggedIn = !!(u.lastLogin || u.lastSeen);
                    const isActivated = u.emailVerified && u.passwordActivated;
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-center text-gray-400 text-xs font-mono">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-green-600 flex-shrink-0" />
                            <p className="font-medium text-gray-800">
                              {u.pharmacyName || u.displayName || 'Nincs név'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <User size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs">{u.contactName || u.displayName || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs">{getAddress(u)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Mail size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs">{u.email || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock size={12} className="text-gray-400" />
                            {u.lastLogin ? (
                              <span className="text-gray-500">{formatDate(u.lastLogin)}</span>
                            ) : u.lastSeen ? (
                              <span className="text-gray-400" title="Utoljára aktív">{formatDate(u.lastSeen)} <span className="text-orange-400">(aktív)</span></span>
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
                const hasPush = pushUserIds.has(u.id);
                const hasLoggedIn = !!(u.lastLogin || u.lastSeen);
                const isActivated = u.emailVerified && u.passwordActivated;
                return (
                  <div key={u.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 font-mono mt-0.5">{index + 1}.</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-green-600" />
                            <p className="font-semibold text-gray-800">
                              {u.pharmacyName || u.displayName || 'Nincs név'}
                            </p>
                          </div>
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
                    <div className="space-y-1 text-xs text-gray-500 ml-6 mb-2">
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-gray-400" />
                        <span>{u.contactName || u.displayName || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-gray-400" />
                        <span>{getAddress(u)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end text-xs">
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
                <Building2 size={48} className="mx-auto mb-3 text-gray-300" />
                <p>Nincs találat a keresésre.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
