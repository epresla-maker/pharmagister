"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Mail, Users, Search, X, ChevronDown, ChevronUp, Send, ArrowLeft, CheckCircle, AlertCircle, Clock, Eye, EyeOff } from "lucide-react";
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

// Email vázlat sablon - ITT TUDOD MÓDOSÍTANI AZ EMAIL SZÖVEGÉT
const generateInactiveUserEmail = (name, keepLink, deleteLink, market = 'hu') => {
  if (market === 'de') {
    const subject = 'Kontoloeschung - Entscheidung erforderlich';
    const body = `Hallo ${name}!

Wir haben gesehen, dass du dich bei Pharmagister registriert hast, dein Konto aber noch nicht aktiviert hast und dich noch nicht angemeldet hast.

Bitte waehle eine der folgenden Optionen:

✅ KONTO BEHALTEN
Wenn du dein Konto behalten moechtest, klicke auf diesen Link:
${keepLink}

❌ KONTO LOESCHEN
Wenn du dein Konto und alle deine Daten loeschen moechtest, klicke auf diesen Link:
${deleteLink}

Wenn du innerhalb von 30 Tagen keine Auswahl triffst, wird dein Konto automatisch geloescht.

Die Links sind 30 Tage gueltig und koennen nur einmal verwendet werden.

Viele Gruesse,
Pharmagister Team`;
    return { subject, body };
  }

  const subject = 'Fiók törlése - döntés szükséges';
  const body = `Kedves ${name}!

Észrevettük, hogy regisztráltál a Pharmagister oldalunkon, de még nem aktiváltad a fiókodat és nem is léptél be.

Kérjük, válaszd ki az alábbi opciók egyikét:

✅ FIÓK MEGTARTÁSA
Ha szeretnéd megtartani a fiókodat, kattints erre a linkre:
${keepLink}

❌ FIÓK TÖRLÉSE
Ha törölni szeretnéd a fiókodat és minden adatodat, kattints erre a linkre:
${deleteLink}

Ha 30 napon belül nem választasz, a fiókod automatikusan törlésre kerül.

A linkek 30 napig érvényesek és csak egyszer használhatók fel.

Üdvözlettel,
Pharmagister csapat`;

  return { subject, body };
};

export default function AdminEmailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();
  
  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  
  // Email state
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [manualRecipientInput, setManualRecipientInput] = useState('');
  const [manualRecipientError, setManualRecipientError] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Sent emails state
  const [sentEmails, setSentEmails] = useState([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [showSentEmails, setShowSentEmails] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'sent' | 'tokens'

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Token generation state
  const [generatingTokens, setGeneratingTokens] = useState(false);
  const [generatedTokens, setGeneratedTokens] = useState([]);
  const [showTokenEmail, setShowTokenEmail] = useState(null);
  const [tokenTarget, setTokenTarget] = useState('inactive'); // 'inactive' | 'active' | 'all' | 'custom'
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenSelectedUsers, setTokenSelectedUsers] = useState([]);

  // Bulk send state
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState(null); // { sent, failed, total }
  const [bulkSendResult, setBulkSendResult] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
      loadSentEmails();
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    const updateKeyboardHeight = () => {
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardHeight(inset > 20 ? inset : 0);
    };

    updateKeyboardHeight();
    viewport?.addEventListener('resize', updateKeyboardHeight);
    viewport?.addEventListener('scroll', updateKeyboardHeight);

    return () => {
      viewport?.removeEventListener('resize', updateKeyboardHeight);
      viewport?.removeEventListener('scroll', updateKeyboardHeight);
    };
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.email)
        .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', market === 'de' ? 'de' : 'hu'));
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadSentEmails = async () => {
    setLoadingSent(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/sent-emails', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await response.json();
      if (data.emails) setSentEmails(data.emails);
    } catch (error) {
      console.error('Error loading sent emails:', error);
    } finally {
      setLoadingSent(false);
    }
  };

  const generateTokens = async () => {
    let targetLabel = '';
    let userIds = null;

    if (tokenTarget === 'inactive') {
      targetLabel = 'inaktív felhasználóknak';
    } else if (tokenTarget === 'active') {
      targetLabel = 'aktív felhasználóknak';
      userIds = users.filter(u => u.passwordActivated || u.lastLogin || u.lastSeen).map(u => u.id);
    } else if (tokenTarget === 'all') {
      targetLabel = 'minden felhasználónak';
      userIds = users.map(u => u.id);
    } else if (tokenTarget === 'custom') {
      if (tokenSelectedUsers.length === 0) {
        return alert(market === 'de' ? 'Waehle mindestens einen Benutzer aus!' : 'Válassz ki legalább egy felhasználót!');
      }
      targetLabel = `${tokenSelectedUsers.length} kiválasztott felhasználónak`;
      userIds = tokenSelectedUsers.map(u => u.id);
    }

    if (!confirm(market === 'de' ? `Moechtest du die Tokens wirklich fuer ${targetLabel} generieren?` : `Biztosan generálod a tokeneket ${targetLabel}?`)) return;
    
    setGeneratingTokens(true);
    try {
      const idToken = await user.getIdToken();
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(userIds ? { userIds } : {}),
      };
      const response = await fetch('/api/admin/generate-inactive-tokens', fetchOptions);
      const data = await response.json();
      
      if (response.ok) {
        setGeneratedTokens(data.tokens);
        alert(market === 'de' ? `✅ Erfolgreich fuer ${data.count} Benutzer generiert!` : `✅ Sikeresen generálva ${data.count} felhasználónak!`);
      } else {
        alert((market === 'de' ? '❌ Fehler: ' : '❌ Hiba: ') + data.error);
      }
    } catch (error) {
      alert((market === 'de' ? '❌ Fehler bei der Token-Generierung: ' : '❌ Hiba a token generálás során: ') + error.message);
    } finally {
      setGeneratingTokens(false);
    }
  };

  const sendBulkTokenEmails = async () => {
    if (generatedTokens.length === 0) return alert(market === 'de' ? 'Es gibt keine generierten Tokens!' : 'Nincsenek generált tokenek!');
    if (!confirm(market === 'de' ? `Moechtest du die personalisierte E-Mail wirklich an alle ${generatedTokens.length} Benutzer senden?\n\nDer Versand erfolgt in ${Math.ceil(generatedTokens.length / 10)} Batches (je 10).` : `Biztosan elküldöd a személyre szabott emailt mind a ${generatedTokens.length} felhasználónak?\n\nEz ${Math.ceil(generatedTokens.length / 10)} batch-ben fog kimenni (10-esével).`)) return;

    setBulkSending(true);
    setBulkSendProgress({ sent: 0, failed: 0, total: generatedTokens.length });
    setBulkSendResult(null);

    const BATCH_SIZE = 10;
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors = [];

    for (let i = 0; i < generatedTokens.length; i += BATCH_SIZE) {
      const batch = generatedTokens.slice(i, i + BATCH_SIZE);
      
      try {
        // Token frissítés minden batch-nél (nehogy lejárjon)
        const idToken = await user.getIdToken(true);

        const response = await fetch('/api/admin/send-bulk-token-emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ tokens: batch })
        });

        let result;
        try {
          result = await response.json();
        } catch (parseErr) {
          // Ha a válasz nem JSON (pl. Vercel 504 timeout)
          throw new Error(
            market === 'de'
              ? `HTTP ${response.status} - Antwort konnte nicht verarbeitet werden`
              : `HTTP ${response.status} - nem sikerült a válasz feldolgozása`
          );
        }

        if (response.ok) {
          totalSent += result.sent;
          totalFailed += result.failed;
          if (result.errors) allErrors.push(...result.errors);
        } else {
          totalFailed += batch.length;
          batch.forEach(t => allErrors.push({ email: t.email, name: t.name, error: result.error || (market === 'de' ? 'Anfrage fehlgeschlagen' : 'Kérés sikertelen') }));
        }
      } catch (fetchErr) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} hiba:`, fetchErr);
        totalFailed += batch.length;
        batch.forEach(t => allErrors.push({ email: t.email, name: t.name, error: fetchErr.message }));
      }

      // Progress frissítés minden batch után
      setBulkSendProgress({ sent: totalSent, failed: totalFailed, total: generatedTokens.length });

      // Kis szünet batch-ek között
      if (i + BATCH_SIZE < generatedTokens.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setBulkSendResult({
      type: 'success',
      sent: totalSent,
      failed: totalFailed,
      total: generatedTokens.length,
      errors: allErrors
    });
    loadSentEmails();
    setBulkSending(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !searchQuery || 
        (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesRole = true;
      if (filterRole === 'inactive') {
        // Inaktív: soha nem lépett be ÉS nem aktiválta a jelszót
        const hasNeverLoggedIn = !u.lastLogin && !u.lastSeen;
        const hasNotActivated = !u.passwordActivated;
        matchesRole = hasNeverLoggedIn && hasNotActivated;
      } else if (filterRole !== 'all') {
        matchesRole = u.pharmagisterRole === filterRole ||
          (filterRole === 'pharmacist' && u.pharmagisterRole === 'gyógyszerész') ||
          (filterRole === 'pharmacy' && u.pharmagisterRole === 'gyógyszertár') ||
          (filterRole === 'assistant' && u.pharmagisterRole === 'szakasszisztens');
      }
      
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, filterRole]);

  const toggleRecipient = (userObj) => {
    setSelectedRecipients(prev => {
      const exists = prev.find(r => r.email === userObj.email);
      if (exists) return prev.filter(r => r.email !== userObj.email);
      return [...prev, { email: userObj.email, displayName: userObj.displayName || userObj.email }];
    });
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  const parseManualRecipientTokens = (raw) => {
    return String(raw || '')
      .split(/[\n;,]+/)
      .map(token => token.trim())
      .filter(Boolean)
      .map(token => {
        const angleMatch = token.match(/^(.*)<([^>]+)>$/);
        if (angleMatch) {
          return {
            displayName: angleMatch[1].trim().replace(/^"|"$/g, '') || angleMatch[2].trim(),
            email: normalizeEmail(angleMatch[2]),
          };
        }

        return {
          displayName: token,
          email: normalizeEmail(token),
        };
      });
  };

  const addManualRecipients = () => {
    const entries = parseManualRecipientTokens(manualRecipientInput);
    if (entries.length === 0) {
      setManualRecipientError(market === 'de' ? 'Gib mindestens eine E-Mail-Adresse ein!' : 'Adj meg legalább egy email címet!');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set(selectedRecipients.map(r => normalizeEmail(r.email)));
    const validRecipients = [];
    const invalidEntries = [];

    for (const entry of entries) {
      if (!emailRegex.test(entry.email)) {
        invalidEntries.push(entry.email || entry.displayName);
        continue;
      }
      if (seen.has(entry.email)) continue;
      seen.add(entry.email);
      validRecipients.push({
        email: entry.email,
        displayName: entry.displayName || entry.email,
      });
    }

    if (validRecipients.length > 0) {
      setSelectedRecipients(prev => [...prev, ...validRecipients]);
      setManualRecipientInput('');
      setManualRecipientError('');
    }

    if (invalidEntries.length > 0) {
      setManualRecipientError(
        market === 'de'
          ? `Ungültige E-Mail-Adressen: ${invalidEntries.join(', ')}`
          : `Érvénytelen email cím(ek): ${invalidEntries.join(', ')}`
      );
    }
  };

  const isSelected = (email) => selectedRecipients.some(r => r.email === email);

  const selectAll = () => {
    const newRecipients = filteredUsers
      .filter(u => !isSelected(u.email))
      .map(u => ({ email: u.email, displayName: u.displayName || u.email }));
    setSelectedRecipients(prev => [...prev, ...newRecipients]);
  };

  const deselectAll = () => {
    const filteredEmails = new Set(filteredUsers.map(u => u.email));
    setSelectedRecipients(prev => prev.filter(r => !filteredEmails.has(r.email)));
  };

  const removeRecipient = (email) => {
    setSelectedRecipients(prev => prev.filter(r => r.email !== email));
  };
  const selectInactiveUsers = () => {
    const inactiveUsers = users.filter(u => {
      const hasNeverLoggedIn = !u.lastLogin && !u.lastSeen;
      const hasNotActivated = !u.passwordActivated;
      return hasNeverLoggedIn && hasNotActivated && u.email;
    });
    const newRecipients = inactiveUsers
      .filter(u => !isSelected(u.email))
      .map(u => ({ email: u.email, displayName: u.displayName || u.email }));
    setSelectedRecipients(prev => [...prev, ...newRecipients]);
  };
  const sendEmail = async () => {
    if (selectedRecipients.length === 0) return alert(market === 'de' ? 'Waehle mindestens einen Empfaenger aus!' : 'Válassz legalább egy címzettet!');
    if (!subject.trim()) return alert(market === 'de' ? 'Gib einen Betreff ein!' : 'Add meg a tárgyat!');
    if (!body.trim()) return alert(market === 'de' ? 'Schreibe eine Nachricht!' : 'Írd meg az üzenetet!');

    if (!confirm(market === 'de' ? `Moechtest du die E-Mail wirklich an ${selectedRecipients.length} Empfaenger senden?` : `Biztosan elküldöd az emailt ${selectedRecipients.length} címzettnek?`)) return;

    setSending(true);
    setSendResult(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          to: selectedRecipients.map(r => r.email),
          subject: subject.trim(),
          body: body.trim(),
          isHtml: false,
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setSendResult({
          type: 'success',
          message: market === 'de'
            ? `✅ Erfolgreich an ${result.sent} Empfaenger gesendet!${result.failed > 0 ? ` ❌ ${result.failed} fehlgeschlagen.` : ''}`
            : `✅ Sikeresen elküldve ${result.sent} címzettnek!${result.failed > 0 ? ` ❌ ${result.failed} sikertelen.` : ''}`,
          details: result
        });
        if (result.failed === 0) {
          setSubject('');
          setBody('');
          setSelectedRecipients([]);
        }
        // Reload sent emails list
        loadSentEmails();
      } else {
        setSendResult({ type: 'error', message: result.error || (market === 'de' ? 'Unbekannter Fehler' : 'Ismeretlen hiba történt') });
      }
    } catch (err) {
      setSendResult({ type: 'error', message: (market === 'de' ? 'Netzwerkfehler: ' : 'Hálózati hiba: ') + err.message });
    } finally {
      setSending(false);
    }
  };

  if (loading || !user || !ALL_ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto overscroll-contain bg-gray-50 p-2 sm:p-4 pb-[calc(10rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Mail className="text-purple-600" size={28} />
              <h1 className="text-xl sm:text-2xl font-bold">{market === 'de' ? 'E-Mail Versand' : 'Email küldés'}</h1>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1 text-purple-600 hover:text-purple-800 text-sm"
            >
              <ArrowLeft size={16} />
              Admin
            </button>
          </div>
          <p className="text-sm text-gray-500">{market === 'de' ? 'Absender' : 'Feladó'}: epresla@icloud.com</p>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'compose' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Send size={16} />
              {market === 'de' ? 'Neue E-Mail' : 'Új email'}
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tokens' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users size={16} />
              {market === 'de' ? 'Token-Generierung' : 'Token generálás'}
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sent' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock size={16} />
              {market === 'de' ? 'Gesendet' : 'Elküldött'} ({sentEmails.length})
            </button>
          </div>
        </div>

        {/* COMPOSE TAB */}
        {activeTab === 'compose' && (<div className="pb-[calc(16rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
        {/* Recipients section */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users size={20} />
              {market === 'de' ? 'Empfaenger' : 'Címzettek'} ({selectedRecipients.length})
            </h2>
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-sm"
            >
              {showUserList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showUserList ? (market === 'de' ? 'Schliessen' : 'Bezárás') : (market === 'de' ? 'Benutzer' : 'Felhasználók')}
            </button>
          </div>

          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {market === 'de' ? 'Manuelle Empfaenger' : 'Kézi címzett hozzáadása'}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualRecipientInput}
                onChange={(e) => {
                  setManualRecipientInput(e.target.value);
                  setManualRecipientError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualRecipients();
                  }
                }}
                placeholder={market === 'de' ? 'name@domain.hu, Muster <email@domain.com>' : 'nev@domain.hu, Név <email@domain.com>'}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addManualRecipients}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                {market === 'de' ? 'Hinzufuegen' : 'Hozzáadás'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {market === 'de' ? 'Mehrere Adressen mit Komma, Semikolon oder Zeilenumbruch trennen.' : 'Több címet vesszővel, pontosvesszővel vagy sor töréssel is megadhatsz.'}
            </p>
            {manualRecipientError ? (
              <p className="mt-2 text-xs text-red-600">{manualRecipientError}</p>
            ) : null}
          </div>

          {/* Selected recipients chips */}
          {selectedRecipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedRecipients.map(r => (
                <span key={r.email} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                  {r.displayName}
                  <button onClick={() => removeRecipient(r.email)} className="hover:text-purple-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setSelectedRecipients([])}
                className="text-xs text-red-600 hover:text-red-800 underline"
              >
                {market === 'de' ? 'Alle entfernen' : 'Mind törlése'}
              </button>
            </div>
          )}

          {/* User list dropdown */}
          {showUserList && (
            <div className="border rounded-lg p-3 bg-gray-50">
              {/* Search and filter */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder={market === 'de' ? 'Suche nach Name oder E-Mail...' : 'Keresés név vagy email alapján...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="all">{market === 'de' ? 'Alle Rollen' : 'Minden szerep'}</option>
                  <option value="pharmacist">{market === 'de' ? 'Apotheker' : 'Gyógyszerész'}</option>
                  <option value="pharmacy">{market === 'de' ? 'Apotheke' : 'Gyógyszertár'}</option>
                  <option value="assistant">{market === 'de' ? 'Assistent' : 'Szakasszisztens'}</option>
                  <option value="inactive" className="text-red-600">{market === 'de' ? '🚫 Inaktiv (nie angemeldet)' : '🚫 Inaktív (soha nem lépett be)'}</option>
                </select>
              </div>

              {/* Select all / deselect */}
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={selectAll}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                >
                  {market === 'de' ? 'Alle auswaehlen' : 'Mind kijelölés'} ({filteredUsers.length})
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                >
                  {market === 'de' ? 'Alle entfernen' : 'Mind törlés'}
                </button>
                <button
                  onClick={selectInactiveUsers}
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 font-medium"
                >
                  {market === 'de' ? '🚫 Inaktive Benutzer' : '🚫 Inaktív felhasználók'} ({users.filter(u => !u.lastLogin && !u.lastSeen && !u.passwordActivated).length})
                </button>
              </div>

              {/* Users list */}
              {loadingUsers ? (
                <div className="text-center py-4 text-gray-500">{market === 'de' ? 'Benutzer werden geladen...' : 'Felhasználók betöltése...'}</div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">{market === 'de' ? 'Keine Treffer' : 'Nincs találat'}</div>
                  ) : (
                    filteredUsers.map(u => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white transition-colors ${
                          isSelected(u.email) ? 'bg-purple-50 border border-purple-200' : 'bg-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected(u.email)}
                          onChange={() => toggleRecipient(u)}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.displayName || (market === 'de' ? 'Ohne Namen' : 'Névtelen')}</div>
                          <div className="text-xs text-gray-500 truncate">{u.email}</div>
                        </div>
                        {u.pharmagisterRole && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded flex-shrink-0">
                            {u.pharmagisterRole}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email form */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4">
          <h2 className="text-lg font-semibold mb-3">{market === 'de' ? 'Nachricht' : 'Üzenet'}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{market === 'de' ? 'Betreff' : 'Tárgy'}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={market === 'de' ? 'E-Mail Betreff...' : 'Email tárgya...'}
                className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{market === 'de' ? 'Nachricht' : 'Üzenet'}</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={market === 'de' ? 'Schreibe deine Nachricht...' : 'Írd meg az üzenetet...'}
                rows={10}
                className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              />
            </div>
          </div>
        </div>

        {/* Send result */}
        {sendResult && (
          <div className={`rounded-lg p-4 mb-4 ${
            sendResult.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {sendResult.type === 'success' ? (
                <CheckCircle className="text-green-600" size={20} />
              ) : (
                <AlertCircle className="text-red-600" size={20} />
              )}
              <p className={`text-sm font-medium ${sendResult.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {sendResult.message}
              </p>
            </div>
            {sendResult.details?.errors?.length > 0 && (
              <div className="mt-2 text-xs text-red-700">
                <p className="font-medium">Sikertelen küldések:</p>
                {sendResult.details.errors.map((e, i) => (
                  <p key={i}>{e.email}: {e.error}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Send button */}
        {isAdmin && (
          <>
            <div className="hidden sm:flex justify-end">
              <button
                onClick={sendEmail}
                disabled={sending || selectedRecipients.length === 0 || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {market === 'de' ? 'Wird gesendet...' : 'Küldés folyamatban...'}
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    {market === 'de' ? 'E-Mail senden' : 'Email küldése'} ({selectedRecipients.length} {market === 'de' ? 'Empfaenger' : 'címzett'})
                  </>
                )}
              </button>
            </div>

            <div
              className="fixed left-3 right-3 z-40 sm:hidden"
              style={{ bottom: `${Math.max(12, keyboardHeight + 12)}px` }}
            >
              <button
                onClick={sendEmail}
                disabled={sending || selectedRecipients.length === 0 || !subject.trim() || !body.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-4 text-base font-semibold text-white shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {market === 'de' ? 'Wird gesendet...' : 'Küldés folyamatban...'}
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    {market === 'de' ? 'E-Mail senden' : 'Email küldése'} ({selectedRecipients.length})
                  </>
                )}
              </button>
            </div>
          </>
        )}
        </div>)}

        {/* TOKEN GENERATION TAB */}
        {activeTab === 'tokens' && (
          <div className="space-y-4">
            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">{market === 'de' ? 'Token-Generierung fuer Benutzer' : 'Token generálás felhasználóknak'}</h3>
              <p className="text-sm text-blue-800">
                {market === 'de' ? 'Diese Funktion erstellt individuelle Links fuer die ausgewaehlten Benutzer. Jeder Benutzer erhaelt 2 Links:' : 'Ez a funkció egyedi linkeket generál a kiválasztott felhasználóknak. Minden felhasználó kap 2 linket:'}
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                <li><strong>Megtartás link:</strong> A felhasználó megtarthatja a fiókját</li>
                <li><strong>Törlés link:</strong> A felhasználó törölheti a fiókját és minden adatát</li>
              </ul>
              <p className="text-sm text-blue-800 mt-2">
                {market === 'de' ? 'Die Tokens sind 30 Tage gueltig und nur einmal verwendbar.' : 'A tokenek 30 napig érvényesek és csak egyszer használhatók fel.'}
              </p>
            </div>

            {/* Célcsoport választó */}
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="font-semibold text-sm mb-3">{market === 'de' ? 'Zielgruppe auswaehlen' : 'Célcsoport kiválasztása'}</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { key: 'inactive', label: market === 'de' ? '🚫 Inaktive' : '🚫 Inaktívak', count: users.filter(u => !u.lastLogin && !u.lastSeen && !u.passwordActivated).length, color: 'orange' },
                  { key: 'active', label: market === 'de' ? '✅ Aktive' : '✅ Aktívak', count: users.filter(u => u.passwordActivated || u.lastLogin || u.lastSeen).length, color: 'green' },
                  { key: 'all', label: market === 'de' ? '👥 Alle' : '👥 Mindenki', count: users.length, color: 'blue' },
                  { key: 'custom', label: market === 'de' ? '🎯 Individuell' : '🎯 Egyéni', count: tokenSelectedUsers.length, color: 'purple' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTokenTarget(opt.key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      tokenTarget === opt.key
                        ? `border-${opt.color}-500 bg-${opt.color}-50 shadow-sm`
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className={`text-lg font-bold mt-0.5 ${tokenTarget === opt.key ? `text-${opt.color}-600` : 'text-gray-700'}`}>
                      {opt.count}
                    </p>
                  </button>
                ))}
              </div>

              {/* Egyéni felhasználó választó */}
              {tokenTarget === 'custom' && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder={market === 'de' ? 'Suche nach Name oder E-Mail...' : 'Keresés név vagy email alapján...'}
                      value={tokenSearch}
                      onChange={(e) => setTokenSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Kiválasztott felhasználók chipek */}
                  {tokenSelectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {tokenSelectedUsers.map(u => (
                        <span key={u.id} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                          {u.displayName || u.email}
                          <button onClick={() => setTokenSelectedUsers(prev => prev.filter(p => p.id !== u.id))} className="hover:text-purple-900">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <button
                        onClick={() => setTokenSelectedUsers([])}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        {market === 'de' ? 'Alle entfernen' : 'Mind törlése'}
                      </button>
                    </div>
                  )}

                  {/* Felhasználó lista */}
                  {loadingUsers ? (
                    <div className="text-center py-4 text-gray-500 text-sm">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {(() => {
                        const q = tokenSearch.toLowerCase().trim();
                        const filtered = q
                          ? users.filter(u =>
                              (u.displayName || '').toLowerCase().includes(q) ||
                              (u.email || '').toLowerCase().includes(q)
                            )
                          : users;
                        if (filtered.length === 0) {
                          return <div className="text-center py-4 text-gray-500 text-sm">{market === 'de' ? 'Keine Treffer' : 'Nincs találat'}</div>;
                        }
                        return filtered.map(u => {
                          const isChecked = tokenSelectedUsers.some(s => s.id === u.id);
                          const isInactive = !u.lastLogin && !u.lastSeen && !u.passwordActivated;
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white transition-colors ${
                                isChecked ? 'bg-purple-50 border border-purple-200' : 'bg-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setTokenSelectedUsers(prev => prev.filter(p => p.id !== u.id));
                                  } else {
                                    setTokenSelectedUsers(prev => [...prev, u]);
                                  }
                                }}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{u.displayName || (market === 'de' ? 'Ohne Namen' : 'Névtelen')}</div>
                                <div className="text-xs text-gray-500 truncate">{u.email}</div>
                              </div>
                              {isInactive && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex-shrink-0">{market === 'de' ? 'Inaktiv' : 'Inaktív'}</span>
                              )}
                              {u.pharmagisterRole && (
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded flex-shrink-0">
                                  {u.pharmagisterRole === 'pharmacist' || u.pharmagisterRole === 'gyógyszerész' ? (market === 'de' ? 'Apotheker' : 'Gyógyszerész') :
                                   u.pharmagisterRole === 'pharmacy' || u.pharmagisterRole === 'gyógyszertár' ? (market === 'de' ? 'Apotheke' : 'Gyógyszertár') :
                                   u.pharmagisterRole === 'assistant' || u.pharmagisterRole === 'szakasszisztens' ? (market === 'de' ? 'Assistent' : 'Szakasszisztens') :
                                   u.pharmagisterRole}
                                </span>
                              )}
                            </label>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Generate button */}
              {isAdmin && (
              <button
                onClick={generateTokens}
                disabled={generatingTokens || (tokenTarget === 'custom' && tokenSelectedUsers.length === 0)}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium shadow-lg mt-4"
              >
                {generatingTokens ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {market === 'de' ? 'Tokens werden generiert...' : 'Tokenek generálása...'}
                  </>
                ) : (
                  <>
                    <Users size={20} />
                    {market === 'de' ? 'Tokens generieren' : 'Tokenek generálása'}
                    {tokenTarget === 'inactive' && ` (${users.filter(u => !u.lastLogin && !u.lastSeen && !u.passwordActivated).length} inaktív)`}
                    {tokenTarget === 'active' && ` (${users.filter(u => u.passwordActivated || u.lastLogin || u.lastSeen).length} aktív)`}
                    {tokenTarget === 'all' && ` (${users.length} felhasználó)`}
                    {tokenTarget === 'custom' && ` (${tokenSelectedUsers.length} kiválasztott)`}
                  </>
                )}
              </button>
              )}
            </div>

            {/* Generated tokens list */}
            {generatedTokens.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {market === 'de' ? 'Generierte Tokens' : 'Generált tokenek'} ({generatedTokens.length} {market === 'de' ? 'Benutzer' : 'felhasználó'})
                </h2>
                
                <div className="space-y-3">
                  {generatedTokens.map((tokenData, idx) => (
                    <div key={tokenData.userId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-sm">{tokenData.name}</p>
                          <p className="text-xs text-gray-500">{tokenData.email}</p>
                        </div>
                        <button
                          onClick={() => setShowTokenEmail(showTokenEmail === idx ? null : idx)}
                          className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 flex items-center gap-1"
                        >
                          {showTokenEmail === idx ? <EyeOff size={14} /> : <Eye size={14} />}
                          {showTokenEmail === idx ? (market === 'de' ? 'E-Mail ausblenden' : 'Email elrejtése') : (market === 'de' ? 'E-Mail Vorlage' : 'Email vázlat')}
                        </button>
                      </div>

                      {showTokenEmail === idx && (() => {
                        const emailTemplate = generateInactiveUserEmail(tokenData.name, tokenData.keepLink, tokenData.deleteLink, market);
                        return (
                        <div className="bg-gray-50 rounded-lg p-3 text-sm">
                          <p className="font-medium mb-2">Email vázlat (másold be az Új email tabon):</p>
                          <div className="bg-white border rounded p-3 mb-3">
                            <p className="text-xs text-gray-500 mb-1"><strong>Tárgy:</strong></p>
                            <p className="text-sm mb-3">{emailTemplate.subject}</p>
                            
                            <p className="text-xs text-gray-500 mb-1"><strong>Üzenet:</strong></p>
                            <div className="text-sm whitespace-pre-wrap text-gray-700">
                              {emailTemplate.body}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(emailTemplate.body);
                                alert(market === 'de' ? '📋 E-Mail Text in die Zwischenablage kopiert!' : '📋 Email szöveg vágólapra másolva!');
                              }}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                            >
                              📋 Szöveg másolása
                            </button>
                            <button
                              onClick={() => {
                                const template = generateInactiveUserEmail(tokenData.name, tokenData.keepLink, tokenData.deleteLink, market);
                                setActiveTab('compose');
                                setSelectedRecipients([{ email: tokenData.email, displayName: tokenData.name }]);
                                setSubject(template.subject);
                                setBody(template.body);
                              }}
                              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
                            >
                              ✉️ Email küldéshez
                            </button>
                          </div>
                        </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>

                {/* Tömeges küldés gomb */}
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-green-900 text-sm">📨 Tömeges email küldés</p>
                      <p className="text-xs text-green-700 mt-1">
                        Minden felhasználó személyre szabott emailt kap az egyedi linkjeivel.
                      </p>
                    </div>
                    {isAdmin && (
                    <button
                      onClick={sendBulkTokenEmails}
                      disabled={bulkSending}
                      className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-md whitespace-nowrap"
                    >
                      {bulkSending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Küldés folyamatban...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Összes email elküldése ({generatedTokens.length})
                        </>
                      )}
                    </button>
                    )}
                  </div>

                  {/* Progresszió */}
                  {bulkSending && bulkSendProgress && (
                    <div className="mt-3">
                      <div className="w-full bg-green-200 rounded-full h-3">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(((bulkSendProgress.sent + bulkSendProgress.failed) / bulkSendProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-green-700 mt-1 text-center font-medium">
                        Küldés folyamatban... {bulkSendProgress.sent + bulkSendProgress.failed} / {bulkSendProgress.total}
                        {bulkSendProgress.sent > 0 && ` (✅ ${bulkSendProgress.sent} sikeres`}
                        {bulkSendProgress.failed > 0 && `, ❌ ${bulkSendProgress.failed} sikertelen`}
                        {bulkSendProgress.sent > 0 && ')'}
                      </p>
                    </div>
                  )}

                  {/* Eredmény */}
                  {bulkSendResult && !bulkSending && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${
                      bulkSendResult.type === 'success'
                        ? 'bg-white border border-green-300'
                        : 'bg-red-50 border border-red-300'
                    }`}>
                      {bulkSendResult.type === 'success' ? (
                        <>
                          <p className="font-medium text-green-800">
                            ✅ Sikeresen elküldve: {bulkSendResult.sent} / {bulkSendResult.total}
                            {bulkSendResult.failed > 0 && (
                              <span className="text-red-600 ml-2">❌ Sikertelen: {bulkSendResult.failed}</span>
                            )}
                          </p>
                          {bulkSendResult.errors.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-red-600 font-medium">Sikertelen címzettek:</p>
                              {bulkSendResult.errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-500">{e.name} ({e.email}): {e.error}</p>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="font-medium text-red-800">❌ {bulkSendResult.message}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>💡 Tipp:</strong> Vagy kattints az "Email küldéshez" gombra az egyes felhasználóknál, ha egyesével szeretnéd küldeni.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SENT EMAILS TAB */}
        {activeTab === 'sent' && (
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock size={20} />
                {market === 'de' ? 'Gesendete E-Mails' : 'Elküldött emailek'}
              </h2>
              <button
                onClick={loadSentEmails}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
              >
                {market === 'de' ? 'Aktualisieren' : 'Frissítés'}
              </button>
            </div>

            {loadingSent ? (
              <div className="text-center py-8 text-gray-500">{market === 'de' ? 'Wird geladen...' : 'Betöltés...'}</div>
            ) : sentEmails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">{market === 'de' ? 'Noch keine gesendeten E-Mails' : 'Még nincs elküldött email'}</div>
            ) : (
              <div className="space-y-3">
                {sentEmails.map(email => (
                  <div key={email.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{email.subject}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {email.sentAt ? new Date(email.sentAt).toLocaleString(market === 'de' ? 'de-DE' : 'hu-HU', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            }) : (market === 'de' ? 'Unbekanntes Datum' : 'Ismeretlen dátum')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            {email.sentCount} {market === 'de' ? 'gesendet' : 'elküldve'}
                          </span>
                          {email.failedCount > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              {email.failedCount} {market === 'de' ? 'fehlgeschlagen' : 'sikertelen'}
                            </span>
                          )}
                          {expandedEmail === email.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </div>
                    </button>

                    {expandedEmail === email.id && (
                      <div className="border-t p-3 bg-gray-50">
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">{market === 'de' ? 'Empfaenger' : 'Címzettek'} ({email.to.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {email.to.map((addr, i) => (
                              <span key={i} className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                {addr}
                              </span>
                            ))}
                          </div>
                        </div>
                        {email.failedTo?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-red-500 mb-1">{market === 'de' ? 'Fehlgeschlagene Empfaenger:' : 'Sikertelen címzettek:'}</p>
                            <div className="flex flex-wrap gap-1">
                              {email.failedTo.map((addr, i) => (
                                <span key={i} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                  {addr}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">{market === 'de' ? 'Nachricht:' : 'Üzenet:'}</p>
                          <div className="bg-white border rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
                            {email.body}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
