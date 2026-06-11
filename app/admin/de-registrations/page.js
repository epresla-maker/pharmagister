"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Building2, Pill, UserCog, Users } from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

function formatRole(role) {
  if (role === 'pharmacy' || role === 'gyógyszertár') return 'Gyógyszertár';
  if (role === 'pharmacist' || role === 'gyógyszerész') return 'Gyógyszerész';
  if (role === 'assistant' || role === 'szakasszisztens') return 'PTA';
  return 'Nincs szerepkör';
}

function getRoleBadge(role) {
  if (role === 'pharmacy' || role === 'gyógyszertár') return 'bg-green-100 text-green-700';
  if (role === 'pharmacist' || role === 'gyógyszerész') return 'bg-blue-100 text-blue-700';
  if (role === 'assistant' || role === 'szakasszisztens') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-500';
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  if (typeof value === 'string') return new Date(value);
  return null;
}

export default function DeRegistrationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pharmacies: 0,
    pharmacists: 0,
    assistants: 0,
    users: [],
  });

  useEffect(() => {
    if (!loading && (!user || !ADMIN_EMAILS.includes(user.email))) {
      router.push('/login');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) return;

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const deUsers = usersSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((entry) => entry.market === 'de');

        const sortedUsers = deUsers
          .map((entry) => ({
            id: entry.id,
            name: entry.displayName || entry.name || '-',
            email: entry.email || '-',
            role: entry.pharmagisterRole || null,
            createdAt: entry.createdAt || null,
          }))
          .sort((left, right) => {
            const leftTs = toDate(left.createdAt)?.getTime() || 0;
            const rightTs = toDate(right.createdAt)?.getTime() || 0;
            return rightTs - leftTs;
          });

        setStats({
          total: deUsers.length,
          pharmacies: deUsers.filter((entry) => entry.pharmagisterRole === 'pharmacy' || entry.pharmagisterRole === 'gyógyszertár').length,
          pharmacists: deUsers.filter((entry) => entry.pharmagisterRole === 'pharmacist' || entry.pharmagisterRole === 'gyógyszerész').length,
          assistants: deUsers.filter((entry) => entry.pharmagisterRole === 'assistant' || entry.pharmagisterRole === 'szakasszisztens').length,
          users: sortedUsers,
        });
      } catch (error) {
        console.error('Error loading DE registrations:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [user]);

  if (loading || !user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, className }) => (
    <div className={`rounded-2xl p-5 text-center ${className}`}>
      <Icon className="mx-auto mb-2" size={26} />
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Német regisztrációk</h1>
              <p className="text-sm text-gray-500 mt-1">Csak a DE piachoz tartozó regisztrációk.</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={18} /> Vissza
            </button>
          </div>
        </div>

        {loadingUsers ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-500">DE regisztrációk betöltése...</div>
        ) : (
          <>
            <section className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Összes regisztráció" value={stats.total} className="bg-slate-100 text-slate-700" />
                <StatCard icon={Building2} label="Gyógyszertár" value={stats.pharmacies} className="bg-green-50 text-green-700" />
                <StatCard icon={Pill} label="Gyógyszerész" value={stats.pharmacists} className="bg-blue-50 text-blue-700" />
                <StatCard icon={UserCog} label="PTA" value={stats.assistants} className="bg-orange-50 text-orange-700" />
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Regisztrált felhasználók</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-3 pr-3">Név</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Szerepkör</th>
                      <th className="py-3 pl-3">Regisztráció ideje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map((entry) => {
                      const createdAt = toDate(entry.createdAt);
                      return (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-3 pr-3 font-medium text-gray-900">{entry.name}</td>
                          <td className="py-3 px-3 text-gray-600">{entry.email}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getRoleBadge(entry.role)}`}>
                              {formatRole(entry.role)}
                            </span>
                          </td>
                          <td className="py-3 pl-3 text-gray-500">
                            {createdAt ? createdAt.toLocaleString('hu-HU') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}