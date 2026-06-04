"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

export default function PasswordActivationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const [activatedUsers, setActivatedUsers] = useState([]);
  const [notActivatedUsers, setNotActivatedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState('activated');

  useEffect(() => {
    if (!loading) {
      if (!user || !ALL_ADMIN_EMAILS.includes(user.email)) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && ALL_ADMIN_EMAILS.includes(user.email)) {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Separate activated and not activated users
      const activated = usersData
        .filter(u => u.passwordActivated)
        .sort((a, b) => {
          const dateA = a.passwordActivatedAt?.toDate?.() || new Date(0);
          const dateB = b.passwordActivatedAt?.toDate?.() || new Date(0);
          return dateB - dateA; // Newest first
        });
      
      const notActivated = usersData
        .filter(u => !u.passwordActivated)
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
      
      setActivatedUsers(activated);
      setNotActivatedUsers(notActivated);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleString(market === 'de' ? 'de-DE' : 'hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !user || !ALL_ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-full sm:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-3 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">{market === 'de' ? '🔐 Passwortaktivierungen' : '🔐 Jelszó aktiválások'}</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {market === 'de' ? 'Benutzer, die ihr Passwort geaendert haben' : 'Felhasználók, akik megváltoztatták a jelszavukat'}
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-xs sm:text-sm"
            >
              {market === 'de' ? '← Zurueck' : '← Vissza'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{activatedUsers.length}</div>
              <div className="text-xs text-green-700">{market === 'de' ? 'Aktiviert' : 'Aktiválva'}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600">{notActivatedUsers.length}</div>
              <div className="text-xs text-orange-700">{market === 'de' ? 'Nicht aktiviert' : 'Nem aktivált'}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">
                {activatedUsers.length + notActivatedUsers.length}
              </div>
              <div className="text-xs text-blue-700">{market === 'de' ? 'Alle Benutzer' : 'Összes user'}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">
                {((activatedUsers.length / (activatedUsers.length + notActivatedUsers.length)) * 100 || 0).toFixed(0)}%
              </div>
              <div className="text-xs text-purple-700">{market === 'de' ? 'Aktivierungsquote' : 'Aktiválási arány'}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('activated')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'activated'
                  ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {market === 'de' ? `✅ Aktiviert (${activatedUsers.length})` : `✅ Aktiválva (${activatedUsers.length})`}
            </button>
            <button
              onClick={() => setActiveTab('notActivated')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'notActivated'
                  ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {market === 'de' ? `⏳ Nicht aktiviert (${notActivatedUsers.length})` : `⏳ Nem aktivált (${notActivatedUsers.length})`}
            </button>
          </div>

          <div className="p-3 sm:p-6">
            {loadingUsers ? (
              <div className="text-center py-8">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
            ) : (
              <>
                {/* Activated Users */}
                {activeTab === 'activated' && (
                  <>
                    {activatedUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {market === 'de' ? 'Noch niemand hat sein Passwort aktiviert' : 'Még senki nem aktiválta a jelszavát'}
                      </div>
                    ) : (
                      <>
                        {/* Mobile View - Cards */}
                        <div className="sm:hidden space-y-3">
                          {activatedUsers.map(user => (
                            <div key={user.id} className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <div className="font-medium text-sm mb-1">{user.displayName || user.email}</div>
                              <div className="text-xs text-gray-600 mb-2">{user.email}</div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-green-700">
                                  ✅ {formatDate(user.passwordActivatedAt)}
                                </span>
                                {user.pharmagisterRole && (
                                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                                    {user.pharmagisterRole}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop View - Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Benutzer' : 'Felhasználó'}</th>
                                <th className="text-left py-3 px-4 text-sm">Email</th>
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Rolle' : 'Szerep'}</th>
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Aktivierungszeit' : 'Aktiválás ideje'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activatedUsers.map(user => (
                                <tr key={user.id} className="border-b hover:bg-green-50">
                                  <td className="py-3 px-4 text-sm font-medium">
                                    {user.displayName || '-'}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">
                                    {user.email}
                                  </td>
                                  <td className="py-3 px-4">
                                    {user.pharmagisterRole ? (
                                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                                        {user.pharmagisterRole}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-green-600">
                                    ✅ {formatDate(user.passwordActivatedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Not Activated Users */}
                {activeTab === 'notActivated' && (
                  <>
                    {notActivatedUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {market === 'de' ? 'Alle Benutzer haben ihr Passwort aktiviert! 🎉' : 'Minden felhasználó aktiválta a jelszavát! 🎉'}
                      </div>
                    ) : (
                      <>
                        {/* Mobile View - Cards */}
                        <div className="sm:hidden space-y-3">
                          {notActivatedUsers.map(user => (
                            <div key={user.id} className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                              <div className="font-medium text-sm mb-1">{user.displayName || user.email}</div>
                              <div className="text-xs text-gray-600 mb-2">{user.email}</div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-orange-700">
                                  {market === 'de' ? '⏳ Registrierung: ' : '⏳ Regisztráció: '}{user.createdAt ? new Date(user.createdAt).toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU') : '-'}
                                </span>
                                {user.pharmagisterRole && (
                                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                                    {user.pharmagisterRole}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop View - Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Benutzer' : 'Felhasználó'}</th>
                                <th className="text-left py-3 px-4 text-sm">Email</th>
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Rolle' : 'Szerep'}</th>
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Registrierung' : 'Regisztráció'}</th>
                                <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Status' : 'Státusz'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {notActivatedUsers.map(user => (
                                <tr key={user.id} className="border-b hover:bg-orange-50">
                                  <td className="py-3 px-4 text-sm font-medium">
                                    {user.displayName || '-'}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">
                                    {user.email}
                                  </td>
                                  <td className="py-3 px-4">
                                    {user.pharmagisterRole ? (
                                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                                        {user.pharmagisterRole}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU') : '-'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                                      {market === 'de' ? '⏳ Wartet' : '⏳ Várakozik'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
