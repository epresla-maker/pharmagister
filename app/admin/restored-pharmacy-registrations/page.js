"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, MousePointerClick, LogIn, RefreshCw } from "lucide-react";
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function RestoredPharmacyRegistrationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();

  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [error, setError] = useState('');

  const normalizedEmail = String(user?.email || '').trim().toLowerCase();
  const isAuthorized = ADMIN_EMAILS.some((email) => email.toLowerCase() === normalizedEmail)
    || ADMINKA_EMAILS.some((email) => email.toLowerCase() === normalizedEmail);

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push('/login');
    }
  }, [loading, user, isAuthorized, router]);

  const loadReport = async () => {
    if (!user) return;
    setLoadingReport(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/pharmacy-registration-recovery-report', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Riport hiba');
      }
      setReport(data);
    } catch (err) {
      setError(err.message || 'Riport betöltési hiba');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (user && isAuthorized) {
      loadReport();
    }
  }, [user, isAuthorized]);

  const sortedRows = useMemo(() => {
    const rows = report?.rows || [];
    return [...rows].sort((a, b) => {
      if (a.clicked !== b.clicked) return a.clicked ? -1 : 1;
      if (a.completedActivation !== b.completedActivation) return a.completedActivation ? -1 : 1;
      return String(a.email).localeCompare(String(b.email), 'hu');
    });
  }, [report]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Helyreállított gyógyszertári regisztrációk</h1>
              <p className="text-sm text-gray-500">Kampány kattintások és belépési állapot</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-white hover:bg-gray-800"
              >
                <ArrowLeft className="w-4 h-4" /> Vissza
              </button>
              <button
                onClick={loadReport}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
              >
                <RefreshCw className="w-4 h-4" /> Frissítés
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loadingReport || !report ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">Riport betöltése...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <MetricCard icon={Clock3} label="Címzett" value={report.summary.recipientCount} color="text-slate-700" />
              <MetricCard icon={MousePointerClick} label="Rákattintott" value={report.summary.clickedCount} color="text-blue-600" />
              <MetricCard icon={CheckCircle2} label="Teljesen aktivált" value={report.summary.completedActivationCount} color="text-emerald-600" />
              <MetricCard icon={LogIn} label="Belépett kattintás után" value={report.summary.loggedInAfterClickCount} color="text-violet-600" />
              <MetricCard icon={Clock3} label="Még nincs aktiválva" value={report.summary.stillNotActivatedCount} color="text-amber-600" />
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Kattintás</th>
                      <th className="px-3 py-2 text-left">Aktivált</th>
                      <th className="px-3 py-2 text-left">Belépett utána</th>
                      <th className="px-3 py-2 text-left">Utolsó belépés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.userId} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{row.email}</div>
                          <div className="text-xs text-gray-500">{row.displayName || '-'}</div>
                        </td>
                        <td className="px-3 py-2">
                          {row.clicked ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Igen
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Nem
                            </span>
                          )}
                          <div className="text-xs text-gray-500 mt-1">{row.clickedAt || '-'}</div>
                        </td>
                        <td className="px-3 py-2">
                          {row.completedActivation ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Igen</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Nem</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.loggedInAfterClick ? (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Igen</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Nem</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.lastLogin || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
