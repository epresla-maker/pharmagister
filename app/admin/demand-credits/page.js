"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, RefreshCw, ArrowLeft, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];

function formatDate(value, locale) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(locale);
}

function statusBadge(status) {
  if (status === 'credited' || status === 'paid_confirmed') return 'bg-green-100 text-green-700';
  if (status === 'rejected' || status === 'cancelled' || status === 'expired') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function getServiceFrameCountdown(dueAt, status) {
  if (!dueAt) return 'Nincs hataridő';
  if (status === 'paid_confirmed' || status === 'credited') return 'Fizetés igazolva';
  if (status === 'expired') return 'Lejárt';
  const deadline = new Date(dueAt);
  const delta = deadline.getTime() - Date.now();
  if (delta <= 0) return 'Lejárt';
  const totalDays = Math.ceil(delta / (1000 * 60 * 60 * 24));
  return `${totalDays} nap maradt`;
}

export default function AdminDemandCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  const locale = market === 'de' ? 'de-DE' : 'hu-HU';
  const normalizedEmail = String(user?.email || '').trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(normalizedEmail);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [purchaseIntents, setPurchaseIntents] = useState([]);
  const [intentFilter, setIntentFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [paymentRefByIntent, setPaymentRefByIntent] = useState({});
  const [noteByIntent, setNoteByIntent] = useState({});

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/login');
    }
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      loadData();
    }
  }, [loading, user, isAdmin]);

  const authHeaders = async () => {
    const idToken = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  };

  const loadData = async () => {
    setLoadingData(true);
    setError('');
    try {
      const headers = await authHeaders();
      const expireResponse = await fetch('/api/admin/demand-credits/expire-overdue', {
        method: 'POST',
        headers,
      });
      const expireResult = await expireResponse.json().catch(() => ({}));
      if (!expireResponse.ok && expireResult?.code !== 'FORBIDDEN') {
        console.warn('Overdue cleanup failed:', expireResult);
      }

      const response = await fetch('/api/admin/demand-credits/overview', { headers });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'OVERVIEW_FAILED');
      }
      setPurchaseIntents(result.purchaseIntents || []);
    } catch (err) {
      setError(err.message || 'LOAD_FAILED');
    } finally {
      setLoadingData(false);
    }
  };

  const postAction = async (url, payload) => {
    setSaving(true);
    setError('');
    try {
      const headers = await authHeaders();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'REQUEST_FAILED');
      }
      await loadData();
      return result;
    } catch (err) {
      setError(err.message || 'REQUEST_FAILED');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const filteredIntents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchaseIntents.filter((item) => {
      if (intentFilter !== 'all' && item.status !== intentFilter) return false;
      if (!q) return true;
      return (
        String(item.requesterName || '').toLowerCase().includes(q)
        ||
        String(item.pharmacyName || '').toLowerCase().includes(q)
        || String(item.email || '').toLowerCase().includes(q)
        || String(item.id || '').toLowerCase().includes(q)
      );
    });
  }, [purchaseIntents, intentFilter, query]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {market === 'de' ? 'Service-Frame Anfragen Admin' : 'Szolgáltatási keret igénylések admin'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {market === 'de'
                  ? 'E-Mail-Anfragen, Zahlungsbestätigung, 8-Tage-Hinweis und automatische Ablaufverarbeitung.'
                  : 'E-mailes igénylések, fizetés ellenőrzése, 8 napos határidő és automatikus lejáratkezelés.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                {market === 'de' ? 'Zurueck' : 'Vissza'}
              </button>
              <button
                type="button"
                onClick={loadData}
                disabled={loadingData || saving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${(loadingData || saving) ? 'animate-spin' : ''}`} />
                {market === 'de' ? 'Aktualisieren' : 'Frissites'}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-3 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs uppercase text-gray-500">{market === 'de' ? 'Service-Frame Anfragen' : 'Szolgáltatási keret igénylések'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{purchaseIntents.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs uppercase text-gray-500">{market === 'de' ? 'Noch offen' : 'Nyitott tételek'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{purchaseIntents.filter((x) => x.status === 'pending_payment').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {market === 'de' ? 'Service-Frame Anfragen' : 'Szolgáltatási keret igénylések'}
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={market === 'de' ? 'Suche nach Name, Apotheke, E-Mail, ID' : 'Kereses nevre, gyogyszertarra, emailre, ID-ra'}
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <select
                value={intentFilter}
                onChange={(e) => setIntentFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">{market === 'de' ? 'Alle Status' : 'Minden statusz'}</option>
                <option value="pending_payment">pending_payment</option>
                <option value="paid_confirmed">paid_confirmed</option>
                <option value="credited">credited</option>
                <option value="rejected">rejected</option>
                <option value="expired">expired</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {loadingData ? (
              <div className="py-8 text-center text-gray-500">{market === 'de' ? 'Wird geladen...' : 'Betoltes...'}</div>
            ) : filteredIntents.length === 0 ? (
              <div className="py-8 text-center text-gray-500">{market === 'de' ? 'Keine Eintraege' : 'Nincs talalat'}</div>
            ) : filteredIntents.map((intent) => (
              <div key={intent.id} className="border rounded-lg p-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{intent.requesterName || intent.pharmacyName || '-'}</p>
                    <p className="text-xs text-gray-700">{market === 'de' ? 'Apotheke' : 'Gyogyszertar'}: {intent.pharmacyName || '-'}</p>
                    <p className="text-xs text-gray-600">{intent.email || '-'} | {intent.id}</p>
                    <p className="text-xs text-gray-600">
                      {market === 'de' ? 'Service-Frame' : 'Szolgáltatási keret'}: {intent.packageCredits} | {market === 'de' ? 'Preis' : 'Ar'}: {intent.finalPriceHuf} Ft
                      {intent.founderDiscountApplied ? ' | 50% founder' : ''}
                    </p>
                    {intent.invoiceSummary && (
                      <p className="text-xs text-gray-600">
                        {market === 'de' ? 'Rechnungsdaten' : 'Számlaadatok'}: {intent.invoiceSummary.companyName || intent.invoiceSummary.pharmacyName || intent.pharmacyName || '-'} | {market === 'de' ? 'StNr' : 'Adószám'}: {intent.invoiceSummary.taxNumber || intent.taxNumber || '-'} | {intent.invoiceSummary.pharmacyAddress || intent.pharmacyAddress || '-'} {intent.invoiceSummary.zipCode || intent.pharmacyZipCode || ''} {intent.invoiceSummary.city || intent.pharmacyCity || ''} | {intent.invoiceSummary.email || intent.email || '-'} | {intent.invoiceSummary.phone || '-'}
                      </p>
                    )}
                    <p className="text-xs text-gray-600">
                      {market === 'de' ? 'Zahlung bis' : 'Fizetesi hatarido'}: {formatDate(intent.dueAt, locale)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {market === 'de' ? 'Erstellt' : 'Letrehozva'}: {formatDate(intent.createdAt, locale)}
                      {' | '}
                      {getServiceFrameCountdown(intent.dueAt, intent.status)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(intent.status)}`}>
                    {intent.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <input
                    value={paymentRefByIntent[intent.id] ?? intent.paymentRef ?? ''}
                    onChange={(e) => setPaymentRefByIntent((prev) => ({ ...prev, [intent.id]: e.target.value }))}
                    placeholder={market === 'de' ? 'Zahlungsreferenz' : 'Fizetesi referencia'}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    value={noteByIntent[intent.id] ?? intent.adminNote ?? ''}
                    onChange={(e) => setNoteByIntent((prev) => ({ ...prev, [intent.id]: e.target.value }))}
                    placeholder={market === 'de' ? 'Admin-Notiz' : 'Admin megjegyzes'}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving || intent.status === 'paid_confirmed' || intent.status === 'credited'}
                    onClick={() => postAction('/api/admin/demand-credits/purchase-intents', {
                      intentId: intent.id,
                      action: 'confirm_payment',
                      paymentRef: paymentRefByIntent[intent.id] ?? intent.paymentRef ?? '',
                      adminNote: noteByIntent[intent.id] ?? intent.adminNote ?? '',
                    })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {market === 'de' ? 'Bezahlung eingegangen' : 'Bevétel megérkezett'}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => postAction('/api/admin/demand-credits/purchase-intents', {
                      intentId: intent.id,
                      action: 'set_status',
                      status: 'pending_payment',
                      paymentRef: paymentRefByIntent[intent.id] ?? intent.paymentRef ?? '',
                      adminNote: noteByIntent[intent.id] ?? intent.adminNote ?? '',
                    })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    <Clock3 className="w-3.5 h-3.5" />
                    pending_payment
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => postAction('/api/admin/demand-credits/purchase-intents', {
                      intentId: intent.id,
                      action: 'set_status',
                      status: 'rejected',
                      paymentRef: paymentRefByIntent[intent.id] ?? intent.paymentRef ?? '',
                      adminNote: noteByIntent[intent.id] ?? intent.adminNote ?? '',
                    })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    rejected
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
