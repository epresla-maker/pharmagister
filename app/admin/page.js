"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, Building2, Pill, UserCog } from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

export default function AdminPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [roleStats, setRoleStats] = useState({ gyogyszeresz: 0, gyogyszertar: 0, szakasszisztens: 0 });

  useEffect(() => {
    if (!loading) {
      if (!user || !ADMIN_EMAILS.includes(user.email)) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
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
      setUsers(usersData);
      
      // Calculate role stats - only count ACTIVE users (email + password verified)
      let gyogyszeresz = 0, gyogyszertar = 0, szakasszisztens = 0;
      usersData.forEach(u => {
        // Aktív felhasználó: email megerősítve ÉS jelszó aktiválva
        const isActive = u.emailVerified && u.passwordActivated;
        if (!isActive) return;
        
        const role = u.pharmagisterRole;
        if (role === 'pharmacist' || role === 'gyógyszerész') gyogyszeresz++;
        else if (role === 'pharmacy' || role === 'gyógyszertár') gyogyszertar++;
        else if (role === 'assistant' || role === 'szakasszisztens') szakasszisztens++;
      });
      setRoleStats({ gyogyszeresz, gyogyszertar, szakasszisztens });
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a felhasználót? Ez VÉGLEGESEN törli a felhasználót a Firebase Authentication-ből és minden adatát!')) return;
    
    try {
      // Backend API hívás a teljes törléshez
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details 
          ? `${result.error}\nRészletek: ${result.details}\nKód: ${result.code || 'nincs'}` 
          : result.error || 'Törlési hiba';
        throw new Error(errorMsg);
      }

      setUsers(users.filter(u => u.id !== userId));
      alert(`✅ Felhasználó teljesen törölve!\n- Firebase Auth: törölve\n- Firestore: törölve\n- Posztok: ${result.deletedPosts} db törölve`);
    } catch (error) {
      alert('❌ Hiba történt a törlés során: ' + error.message);
      console.error('Delete error:', error);
    }
  };

  if (loading || !user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-full sm:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-3 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-xs sm:text-sm lg:text-base text-gray-600 mb-3">Üdvözöl a Pharmagister admin felület</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/pharmagister')}
              className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-xs sm:text-sm w-full"
            >
              ← Vissza a Pharmagister-hez
            </button>
            <button
              onClick={() => router.push('/admin/approvals')}
              className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-xs sm:text-sm w-full"
            >
              📋 NNK Jóváhagyások
            </button>
            <button
              onClick={() => router.push('/admin/posts')}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-xs sm:text-sm w-full"
            >
              📝 Posztok kezelése
            </button>
            <button
              onClick={() => router.push('/admin/password-activations')}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-xs sm:text-sm w-full"
            >
              🔐 Jelszó aktiválások
            </button>
            <button
              onClick={() => router.push('/admin/stats')}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-xs sm:text-sm w-full"
            >
              📊 Statisztikák
            </button>
            <button
              onClick={() => router.push('/admin/rss-test')}
              className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-xs sm:text-sm w-full"
            >
              🧪 RSS Feed Teszt
            </button>
            <button
              onClick={() => router.push('/admin/apps')}
              className="bg-cyan-600 text-white px-3 py-2 rounded-lg hover:bg-cyan-700 text-xs sm:text-sm w-full"
            >
              📱 Mobil alkalmazások
            </button>
            <button
              onClick={() => router.push('/admin/users')}
              className="bg-pink-600 text-white px-3 py-2 rounded-lg hover:bg-pink-700 text-xs sm:text-sm w-full"
            >
              👥 Felhasználók kezelése
            </button>
            <button
              onClick={() => router.push('/admin/pharmacies')}
              className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 text-xs sm:text-sm w-full"
            >
              🏥 Gyógyszertárak kezelése
            </button>
            <button
              onClick={() => router.push('/admin/email')}
              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-xs sm:text-sm w-full"
            >
              ✉️ Email küldés
            </button>
          </div>
          
          {/* Role Statistics Cards - Active users only */}
          <p className="text-xs text-gray-500 mt-4 mb-2">✅ Aktív felhasználók (email + jelszó megerősítve):</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <Pill className="mx-auto text-blue-500 mb-1" size={24} />
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{roleStats.gyogyszeresz}</p>
              <p className="text-xs text-gray-600">Gyógyszerész</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <Building2 className="mx-auto text-green-500 mb-1" size={24} />
              <p className="text-xl sm:text-2xl font-bold text-green-600">{roleStats.gyogyszertar}</p>
              <p className="text-xs text-gray-600">Gyógyszertár</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
              <UserCog className="mx-auto text-orange-500 mb-1" size={24} />
              <p className="text-xl sm:text-2xl font-bold text-orange-600">{roleStats.szakasszisztens}</p>
              <p className="text-xs text-gray-600">Szakasszisztens</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4">Regisztrált felhasználók ({users.length})</h2>
          
          {loadingUsers ? (
            <div className="text-center py-8">Betöltés...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Még nincsenek felhasználók</div>
          ) : (
            <>
              {/* Mobil nézet - Kártyák */}
              <div className="sm:hidden space-y-3">
                {[...users].sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'hu')).map(u => (
                  <div key={u.id} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="pr-2">
                        <button
                          onClick={() => router.push(`/profil/${u.id}`)}
                          className="text-sm font-semibold text-purple-700 hover:text-purple-900 hover:underline text-left break-all"
                        >
                          {u.displayName || 'Névtelen'}
                        </button>
                        <div className="text-xs text-gray-500 break-all mt-0.5">{u.email}</div>
                      </div>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="text-red-600 hover:text-red-800 text-lg flex-shrink-0"
                      >
                        🗑
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {u.pharmagisterRole && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                          {u.pharmagisterRole}
                        </span>
                      )}
                      <span className={u.pharmaProfileComplete ? "text-green-600 text-xs" : "text-orange-600 text-xs"}>
                        {u.pharmaProfileComplete ? "✓ Kész" : "⚠ Hiányos"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop nézet - Táblázat */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm">Név</th>
                      <th className="text-left py-3 px-4 text-sm">Email</th>
                      <th className="text-left py-3 px-4 text-sm">Szerep</th>
                      <th className="text-left py-3 px-4 text-sm">Profil</th>
                      <th className="text-left py-3 px-4 text-sm">Regisztráció</th>
                      <th className="text-left py-3 px-4 text-sm">Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...users].sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'hu')).map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          <button
                            onClick={() => router.push(`/profil/${u.id}`)}
                            className="text-purple-700 hover:text-purple-900 hover:underline font-medium text-left"
                          >
                            {u.displayName || 'Névtelen'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{u.email}</td>
                        <td className="py-3 px-4">
                          {u.pharmagisterRole ? (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                              {u.pharmagisterRole}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {u.pharmaProfileComplete ? (
                            <span className="text-green-600">✓ Kész</span>
                          ) : (
                            <span className="text-orange-600">⚠ Hiányos</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('hu-HU') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Törlés
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
