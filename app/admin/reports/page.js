"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowLeft, AlertTriangle, Flag, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { getClientMarket } from '@/lib/marketI18n';

const ADMINKA_EMAILS = ['etinatina22@gmail.com', 'epresla@icloud.com'];

function formatDate(value) {
  if (!value) return '—';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });
}

function getTypeLabel(type, market) {
  switch (type) {
    case 'user':
      return market === 'de' ? 'Nutzer/in' : 'Felhasználó';
    case 'message':
      return market === 'de' ? 'Nachricht' : 'Üzenet';
    case 'comment':
      return market === 'de' ? 'Kommentar' : 'Komment';
    case 'communityPost':
      return market === 'de' ? 'Community-Beitrag' : 'Közösségi poszt';
    case 'pharmaDemandPost':
      return market === 'de' ? 'Vertretungsanfrage' : 'Helyettesítési igény';
    case 'serviceFeedPost':
      return market === 'de' ? 'Service-Feed-Beitrag' : 'Service Feed poszt';
    default:
      return type || '—';
  }
}

export default function AdminReportsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const normalizedEmail = String(user?.email || userData?.email || '').trim().toLowerCase();
  const isAuthorized = ADMINKA_EMAILS.some((email) => email.toLowerCase() === normalizedEmail);

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push('/');
    }
  }, [user, loading, isAuthorized, router]);

  useEffect(() => {
    if (!user || !isAuthorized) return;

    const fetchReports = async () => {
      setLoadingReports(true);
      try {
        const snapshot = await getDocs(collection(db, 'reports'));
        const items = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
        setReports(items);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoadingReports(false);
      }
    };

    fetchReports();
  }, [user, isAuthorized]);

  const stats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((report) => report.status === 'pending').length,
      resolved: reports.filter((report) => report.status === 'resolved').length,
    };
  }, [reports]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push('/adminka')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {market === 'de' ? 'Meldungen' : 'Jelentések'}
              </h1>
              <p className="text-sm text-gray-500">
                {userData?.displayName || user.email}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <Flag className="w-5 h-5 text-red-500" />
                <span className="font-semibold">{market === 'de' ? 'Gesamt' : 'Összes'}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="font-semibold">{market === 'de' ? 'Offen' : 'Függőben'}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-semibold">{market === 'de' ? 'Erledigt' : 'Megoldva'}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.resolved}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {market === 'de' ? 'Liste der Meldungen' : 'Jelentések listája'}
            </h2>
            <span className="text-sm text-gray-500">{reports.length} {market === 'de' ? 'Eintraege' : 'elem'}</span>
          </div>

          {loadingReports ? (
            <div className="text-gray-500 py-8">{market === 'de' ? 'Lade Meldungen...' : 'Jelentések betöltése...'}</div>
          ) : reports.length === 0 ? (
            <div className="text-gray-500 py-8">{market === 'de' ? 'Keine Meldungen gefunden.' : 'Nincsenek jelentések.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-3 pr-4">{market === 'de' ? 'Datum' : 'Dátum'}</th>
                    <th className="py-3 pr-4">{market === 'de' ? 'Melder' : 'Jelentő'}</th>
                    <th className="py-3 pr-4">{market === 'de' ? 'Gemeldet' : 'Jelentett'}</th>
                    <th className="py-3 pr-4">{market === 'de' ? 'Grund' : 'Ok'}</th>
                    <th className="py-3 pr-4">{market === 'de' ? 'Typ' : 'Típus'}</th>
                    <th className="py-3 pr-4">{market === 'de' ? 'Status' : 'Állapot'}</th>
                    <th className="py-3 pr-4">{market === 'de' ? 'Details' : 'Részletek'}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b last:border-b-0 align-top">
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDate(report.createdAt)}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{report.reporterName || report.reporterEmail || report.reporterId || '—'}</div>
                        <div className="text-xs text-gray-500">{report.reporterEmail || ''}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{report.reportedUserName || report.reportedUserId || '—'}</div>
                        <div className="text-xs text-gray-500">{report.itemId || ''}</div>
                      </td>
                      <td className="py-3 pr-4">{report.reason || '—'}</td>
                      <td className="py-3 pr-4">{getTypeLabel(report.type, market)}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${report.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {report.status === 'resolved' ? (market === 'de' ? 'Erledigt' : 'Megoldva') : (market === 'de' ? 'Offen' : 'Függőben')}
                        </span>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <div className="text-gray-700 whitespace-pre-line">{report.details || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
