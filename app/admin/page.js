"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, Building2, Pill, UserCog } from "lucide-react";
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

export default function AdminPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [roleStats, setRoleStats] = useState({ gyogyszeresz: 0, gyogyszertar: 0, szakasszisztens: 0 });
  const [scheduleManagerStats, setScheduleManagerStats] = useState({
    pharmaciesWithEmployees: 0,
    pharmaciesWithPublishedMonths: 0,
    publishedMonthCount: 0,
    usingPharmacies: [],
  });

  const normalizedEmail = String(user?.email || '').trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.some((email) => email.toLowerCase() === normalizedEmail);
  const isAdminka = ADMINKA_EMAILS.some((email) => email.toLowerCase() === normalizedEmail);
  const isAuthorized = isAdmin || isAdminka;

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push('/login');
    }
  }, [user, loading, isAuthorized, router]);

  useEffect(() => {
    if (user && isAuthorized) {
      loadUsers();
    }
  }, [user, isAuthorized]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const [usersSnapshot, employeesSnapshot, schedulesSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'pharmacyEmployees')),
        getDocs(collection(db, 'pharmacySchedules')),
      ]);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      const employeeRows = employeesSnapshot.docs.map(doc => doc.data());
      const scheduleRows = schedulesSnapshot.docs.map(doc => doc.data());

      const pharmaciesWithEmployees = new Set();
      employeeRows.forEach((row) => {
        const pharmacyId = row.pharmacyId;
        if (!pharmacyId) return;
        if (row.status === 'deleted') return;
        pharmaciesWithEmployees.add(pharmacyId);
      });

      const pharmaciesWithPublishedMonths = new Set();
      const publishedMonthKeys = new Set();
      const employeeCountByPharmacy = new Map();
      const publishedMonthSetByPharmacy = new Map();

      scheduleRows.forEach((row) => {
        if (!row?.pharmacyId) return;
        if (row.status === 'deleted') return;
        if (!row.publishedAt) return;
        const monthKey = `${row.pharmacyId}-${row.year}-${row.month}`;
        pharmaciesWithPublishedMonths.add(row.pharmacyId);
        publishedMonthKeys.add(monthKey);

        if (!publishedMonthSetByPharmacy.has(row.pharmacyId)) {
          publishedMonthSetByPharmacy.set(row.pharmacyId, new Set());
        }
        publishedMonthSetByPharmacy.get(row.pharmacyId).add(`${row.year}-${row.month}`);
      });

      employeeRows.forEach((row) => {
        const pharmacyId = row?.pharmacyId;
        if (!pharmacyId) return;
        if (row.status === 'deleted') return;
        employeeCountByPharmacy.set(pharmacyId, (employeeCountByPharmacy.get(pharmacyId) || 0) + 1);
      });

      const userMap = new Map(usersData.map((u) => [u.id, u]));
      const usingPharmacyIds = new Set([
        ...pharmaciesWithEmployees,
        ...pharmaciesWithPublishedMonths,
      ]);

      const usingPharmacies = Array.from(usingPharmacyIds).map((pharmacyId) => {
        const u = userMap.get(pharmacyId);
        return {
          id: pharmacyId,
          name: u?.pharmacyName || u?.displayName || u?.email || (market === 'de' ? 'Unbekannte Apotheke' : 'Ismeretlen gyógyszertár'),
          city: u?.pharmacyCity || '',
          employeeCount: employeeCountByPharmacy.get(pharmacyId) || 0,
          publishedMonthCount: publishedMonthSetByPharmacy.get(pharmacyId)?.size || 0,
        };
      }).sort((a, b) => {
        if (b.publishedMonthCount !== a.publishedMonthCount) {
          return b.publishedMonthCount - a.publishedMonthCount;
        }
        if (b.employeeCount !== a.employeeCount) {
          return b.employeeCount - a.employeeCount;
        }
        return a.name.localeCompare(b.name, 'hu');
      });

      setScheduleManagerStats({
        pharmaciesWithEmployees: pharmaciesWithEmployees.size,
        pharmaciesWithPublishedMonths: pharmaciesWithPublishedMonths.size,
        publishedMonthCount: publishedMonthKeys.size,
        usingPharmacies,
      });
      
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
    if (!confirm(market === 'de' ? 'Moechtest du diesen Benutzer wirklich loeschen? Dadurch werden der Firebase-Authentication-Account und alle Daten ENDGUELTIG geloescht!' : 'Biztosan törölni szeretnéd ezt a felhasználót? Ez VÉGLEGESEN törli a felhasználót a Firebase Authentication-ből és minden adatát!')) return;
    
    try {
      // Backend API hívás a teljes törléshez
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details 
          ? `${result.error}\n${market === 'de' ? 'Details' : 'Részletek'}: ${result.details}\n${market === 'de' ? 'Code' : 'Kód'}: ${result.code || (market === 'de' ? 'keiner' : 'nincs')}` 
          : result.error || (market === 'de' ? 'Loeschfehler' : 'Törlési hiba');
        throw new Error(errorMsg);
      }

      setUsers(users.filter(u => u.id !== userId));
      alert(market === 'de'
        ? `✅ Benutzer vollstaendig geloescht!\n- Firebase Auth: geloescht\n- Firestore: geloescht\n- Beitraege: ${result.deletedPosts} geloescht`
        : `✅ Felhasználó teljesen törölve!\n- Firebase Auth: törölve\n- Firestore: törölve\n- Posztok: ${result.deletedPosts} db törölve`);
    } catch (error) {
      alert((market === 'de' ? '❌ Fehler beim Loeschen: ' : '❌ Hiba történt a törlés során: ') + error.message);
      console.error('Delete error:', error);
    }
  };

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-full sm:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-3 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-xs sm:text-sm lg:text-base text-gray-600 mb-3">{market === 'de' ? 'Willkommen im Pharmagister-Adminbereich' : 'Üdvözöl a Pharmagister admin felület'}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/pharmagister')}
              className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '← Zurueck zu Pharmagister' : '← Vissza a Pharmagister-hez'}
            </button>
            <button
              onClick={() => router.push('/admin/approvals')}
              className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '📋 NNK-Freigaben' : '📋 NNK Jóváhagyások'}
            </button>
            <button
              onClick={() => router.push('/admin/posts')}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '📝 Beitraege verwalten' : '📝 Posztok kezelése'}
            </button>
            <button
              onClick={() => router.push('/admin/reports')}
              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '🚩 Meldungen' : '🚩 Jelentések'}
            </button>
            <button
              onClick={() => router.push('/admin/password-activations')}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '🔐 Passwortaktivierungen' : '🔐 Jelszó aktiválások'}
            </button>
            <button
              onClick={() => router.push('/admin/stats')}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '📊 Statistiken' : '📊 Statisztikák'}
            </button>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/de-registrations')}
                className="bg-blue-700 text-white px-3 py-2 rounded-lg hover:bg-blue-800 text-xs sm:text-sm w-full"
              >
                🇩🇪 Német regisztrációk
              </button>
            )}
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
              {market === 'de' ? '📱 Mobile Apps' : '📱 Mobil alkalmazások'}
            </button>
            <button
              onClick={() => router.push('/admin/users')}
              className="bg-pink-600 text-white px-3 py-2 rounded-lg hover:bg-pink-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '👥 Benutzer verwalten' : '👥 Felhasználók kezelése'}
            </button>
            <button
              onClick={() => router.push('/admin/pharmacies')}
              className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '🏥 Apotheken verwalten' : '🏥 Gyógyszertárak kezelése'}
            </button>
            <button
              onClick={() => router.push('/admin/email')}
              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '✉️ E-Mail senden' : '✉️ Email küldés'}
            </button>
            <button
              onClick={() => router.push('/admin/campaign-email')}
              className="bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '📨 Kampagnen-E-Mail Text' : '📨 Kampány levél szöveg'}
            </button>
            <button
              onClick={() => router.push('/admin/demands')}
              className="bg-violet-600 text-white px-3 py-2 rounded-lg hover:bg-violet-700 text-xs sm:text-sm w-full"
            >
              {market === 'de' ? '📋 Anfragen verwalten' : '📋 Igények kezelése'}
            </button>
          </div>
          
          {/* Role Statistics Cards - Active users only */}
          <p className="text-xs text-gray-500 mt-4 mb-2">{market === 'de' ? '✅ Aktive Nutzer (E-Mail + Passwort bestaetigt):' : '✅ Aktív felhasználók (email + jelszó megerősítve):'}</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <Pill className="mx-auto text-blue-500 mb-1" size={24} />
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{roleStats.gyogyszeresz}</p>
              <p className="text-xs text-gray-600">{market === 'de' ? 'Apotheker/in' : 'Gyógyszerész'}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <Building2 className="mx-auto text-green-500 mb-1" size={24} />
              <p className="text-xl sm:text-2xl font-bold text-green-600">{roleStats.gyogyszertar}</p>
              <p className="text-xs text-gray-600">{market === 'de' ? 'Apotheke' : 'Gyógyszertár'}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
              <UserCog className="mx-auto text-orange-500 mb-1" size={24} />
              <p className="text-xl sm:text-2xl font-bold text-orange-600">{roleStats.szakasszisztens}</p>
              <p className="text-xs text-gray-600">{market === 'de' ? 'Assistent/in' : 'Szakasszisztens'}</p>
            </div>
          </div>

          {isAdmin && (
            <>
              <p className="text-xs text-gray-500 mt-4 mb-2">{market === 'de' ? '📅 Nutzung der Dienstplanverwaltung:' : '📅 Beosztáskezelő használat:'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-200">
                  <Building2 className="mx-auto text-indigo-500 mb-1" size={24} />
                  <p className="text-xl sm:text-2xl font-bold text-indigo-600">{scheduleManagerStats.pharmaciesWithEmployees}</p>
                  <p className="text-xs text-gray-600">{market === 'de' ? 'Apotheken mit hinzugefuegten Mitarbeitenden' : 'Gyógyszertár hozzáadott alkalmazottal'}</p>
                </div>
                <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-200">
                  <Building2 className="mx-auto text-cyan-500 mb-1" size={24} />
                  <p className="text-xl sm:text-2xl font-bold text-cyan-600">{scheduleManagerStats.pharmaciesWithPublishedMonths}</p>
                  <p className="text-xs text-gray-600">{market === 'de' ? 'Apotheken mit veroeffentlichtem Monat' : 'Gyógyszertár publikált hónappal'}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                  <Users className="mx-auto text-emerald-500 mb-1" size={24} />
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">{scheduleManagerStats.publishedMonthCount}</p>
                  <p className="text-xs text-gray-600">{market === 'de' ? 'Veroeffentlichte Monatsplaene' : 'Publikált havi beosztások'}</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">{market === 'de' ? 'Nutzende Apotheken:' : 'Használó gyógyszertárak:'}</p>
                {scheduleManagerStats.usingPharmacies.length === 0 ? (
                  <p className="text-xs text-gray-500">{market === 'de' ? 'Noch keine aktiven Nutzer.' : 'Még nincs aktív használó.'}</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {scheduleManagerStats.usingPharmacies.map((pharmacy) => (
                      <div key={pharmacy.id} className="flex items-center justify-between rounded bg-white border border-gray-200 px-2 py-1.5">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-gray-800 truncate">{pharmacy.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{pharmacy.city || (market === 'de' ? 'Ort nicht angegeben' : 'Település nincs megadva')}</p>
                        </div>
                        <div className="text-right text-[11px] text-gray-600 whitespace-nowrap">
                          <p>{market === 'de' ? 'Mitarbeitende' : 'Alkalmazott'}: <span className="font-semibold">{pharmacy.employeeCount}</span></p>
                          <p>{market === 'de' ? 'Veroeffentlichte Monate' : 'Publikált hónap'}: <span className="font-semibold">{pharmacy.publishedMonthCount}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4">{market === 'de' ? `Registrierte Benutzer (${users.length})` : `Regisztrált felhasználók (${users.length})`}</h2>
          
          {loadingUsers ? (
            <div className="text-center py-8">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{market === 'de' ? 'Noch keine Benutzer' : 'Még nincsenek felhasználók'}</div>
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
                          {u.displayName || (market === 'de' ? 'Ohne Namen' : 'Névtelen')}
                        </button>
                        <div className="text-xs text-gray-500 break-all mt-0.5">{u.email}</div>
                      </div>
                      {isAdmin && (
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="text-red-600 hover:text-red-800 text-lg flex-shrink-0"
                      >
                        🗑
                      </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {u.pharmagisterRole && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                          {u.pharmagisterRole}
                        </span>
                      )}
                      <span className={u.pharmaProfileComplete ? "text-green-600 text-xs" : "text-orange-600 text-xs"}>
                        {u.pharmaProfileComplete ? (market === 'de' ? '✓ Fertig' : '✓ Kész') : (market === 'de' ? '⚠ Unvollstaendig' : '⚠ Hiányos')}
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
                      <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Name' : 'Név'}</th>
                      <th className="text-left py-3 px-4 text-sm">Email</th>
                      <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Rolle' : 'Szerep'}</th>
                      <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Profil' : 'Profil'}</th>
                      <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Registrierung' : 'Regisztráció'}</th>
                      <th className="text-left py-3 px-4 text-sm">{market === 'de' ? 'Aktionen' : 'Műveletek'}</th>
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
                              {u.displayName || (market === 'de' ? 'Ohne Namen' : 'Névtelen')}
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
                            <span className="text-green-600">{market === 'de' ? '✓ Fertig' : '✓ Kész'}</span>
                          ) : (
                            <span className="text-orange-600">{market === 'de' ? '⚠ Unvollstaendig' : '⚠ Hiányos'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString(market === 'de' ? 'de-DE' : 'hu-HU') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {isAdmin && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            {market === 'de' ? 'Loeschen' : 'Törlés'}
                          </button>
                          )}
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
