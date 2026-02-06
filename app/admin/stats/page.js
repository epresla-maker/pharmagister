"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, Building2, Pill, UserCog, TrendingUp, Clock, ArrowLeft } from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

export default function StatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    total: 0,
    gyogyszeresz: 0,
    gyogyszertar: 0,
    szakasszisztens: 0,
    last24h: {
      total: 0,
      gyogyszeresz: 0,
      gyogyszertar: 0,
      szakasszisztens: 0
    }
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user || !ADMIN_EMAILS.includes(user.email)) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate stats
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let gyogyszeresz = 0;
      let gyogyszertar = 0;
      let szakasszisztens = 0;
      let last24hGyogyszeresz = 0;
      let last24hGyogyszertar = 0;
      let last24hSzakasszisztens = 0;
      let last24hTotal = 0;

      usersData.forEach(u => {
        const role = u.pharmagisterRole;
        
        // Count by role
        if (role === 'pharmacist' || role === 'gyógyszerész') {
          gyogyszeresz++;
        } else if (role === 'pharmacy' || role === 'gyógyszertár') {
          gyogyszertar++;
        } else if (role === 'assistant' || role === 'szakasszisztens') {
          szakasszisztens++;
        }

        // Check last login in 24h
        let lastLogin = null;
        if (u.lastLogin) {
          if (u.lastLogin.toDate) {
            lastLogin = u.lastLogin.toDate();
          } else if (u.lastLogin.seconds) {
            lastLogin = new Date(u.lastLogin.seconds * 1000);
          } else if (typeof u.lastLogin === 'string') {
            lastLogin = new Date(u.lastLogin);
          }
        }

        if (lastLogin && lastLogin > last24h) {
          last24hTotal++;
          if (role === 'pharmacist' || role === 'gyógyszerész') {
            last24hGyogyszeresz++;
          } else if (role === 'pharmacy' || role === 'gyógyszertár') {
            last24hGyogyszertar++;
          } else if (role === 'assistant' || role === 'szakasszisztens') {
            last24hSzakasszisztens++;
          }
        }
      });

      setStats({
        total: usersData.length,
        gyogyszeresz,
        gyogyszertar,
        szakasszisztens,
        last24h: {
          total: last24hTotal,
          gyogyszeresz: last24hGyogyszeresz,
          gyogyszertar: last24hGyogyszertar,
          szakasszisztens: last24hSzakasszisztens
        }
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading || !user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Betöltés...</div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, title, value, color, subValue }) => (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subValue !== undefined && (
            <p className="text-sm text-gray-400 mt-1">
              <Clock size={12} className="inline mr-1" />
              Elmúlt 24 óra: <span className="font-semibold text-gray-600">{subValue}</span>
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
          <Icon className={color.replace('border-', 'text-')} size={28} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">📊 Statisztikák</h1>
            <p className="text-gray-500 mt-1">Felhasználói aktivitás áttekintés</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
            Vissza
          </button>
        </div>

        {loadingStats ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Statisztikák betöltése...</p>
          </div>
        ) : (
          <>
            {/* Active registrations by role */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Users size={20} />
                Aktív regisztrációk szerepkör szerint
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  title="Összes felhasználó"
                  value={stats.total}
                  color="border-purple-500"
                  subValue={stats.last24h.total}
                />
                <StatCard
                  icon={Pill}
                  title="Gyógyszerész"
                  value={stats.gyogyszeresz}
                  color="border-blue-500"
                  subValue={stats.last24h.gyogyszeresz}
                />
                <StatCard
                  icon={Building2}
                  title="Gyógyszertár"
                  value={stats.gyogyszertar}
                  color="border-green-500"
                  subValue={stats.last24h.gyogyszertar}
                />
                <StatCard
                  icon={UserCog}
                  title="Szakasszisztens"
                  value={stats.szakasszisztens}
                  color="border-orange-500"
                  subValue={stats.last24h.szakasszisztens}
                />
              </div>
            </div>

            {/* Last 24h activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingUp size={20} />
                Aktivitás az elmúlt 24 órában
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <Pill className="mx-auto text-blue-500 mb-2" size={32} />
                  <p className="text-3xl font-bold text-blue-600">{stats.last24h.gyogyszeresz}</p>
                  <p className="text-gray-600 text-sm">Gyógyszerész belépés</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <Building2 className="mx-auto text-green-500 mb-2" size={32} />
                  <p className="text-3xl font-bold text-green-600">{stats.last24h.gyogyszertar}</p>
                  <p className="text-gray-600 text-sm">Gyógyszertár belépés</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-xl">
                  <UserCog className="mx-auto text-orange-500 mb-2" size={32} />
                  <p className="text-3xl font-bold text-orange-600">{stats.last24h.szakasszisztens}</p>
                  <p className="text-gray-600 text-sm">Szakasszisztens belépés</p>
                </div>
              </div>
              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">
                  Összesen <span className="font-bold text-purple-600">{stats.last24h.total}</span> felhasználó lépett be az elmúlt 24 órában
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
