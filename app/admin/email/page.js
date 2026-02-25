"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Mail, Users, Search, X, ChevronDown, ChevronUp, Send, ArrowLeft, CheckCircle, AlertCircle, Clock, Eye, EyeOff } from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

// Email vázlat sablon - ITT TUDOD MÓDOSÍTANI AZ EMAIL SZÖVEGÉT
const generateInactiveUserEmail = (name, keepLink, deleteLink) => {
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
  
  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  
  // Email state
  const [selectedRecipients, setSelectedRecipients] = useState([]);
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
      loadSentEmails();
    }
  }, [user]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.email)
        .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'hu'));
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
        return alert('Válassz ki legalább egy felhasználót!');
      }
      targetLabel = `${tokenSelectedUsers.length} kiválasztott felhasználónak`;
      userIds = tokenSelectedUsers.map(u => u.id);
    }

    if (!confirm(`Biztosan generálod a tokeneket ${targetLabel}?`)) return;
    
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
        alert(`✅ Sikeresen generálva ${data.count} felhasználónak!`);
      } else {
        alert('❌ Hiba: ' + data.error);
      }
    } catch (error) {
      alert('❌ Hiba a token generálás során: ' + error.message);
    } finally {
      setGeneratingTokens(false);
    }
  };

  const sendBulkTokenEmails = async () => {
    if (generatedTokens.length === 0) return alert('Nincsenek generált tokenek!');
    if (!confirm(`Biztosan elküldöd a személyre szabott emailt mind a ${generatedTokens.length} felhasználónak?\n\nEz ${Math.ceil(generatedTokens.length / 5)} batch-ben fog kimenni (5-ösével).`)) return;

    setBulkSending(true);
    setBulkSendProgress({ sent: 0, failed: 0, total: generatedTokens.length });
    setBulkSendResult(null);

    const BATCH_SIZE = 5;
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors = [];

    try {
      const idToken = await user.getIdToken();

      for (let i = 0; i < generatedTokens.length; i += BATCH_SIZE) {
        const batch = generatedTokens.slice(i, i + BATCH_SIZE);
        
        try {
          const response = await fetch('/api/admin/send-bulk-token-emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ tokens: batch })
          });

          const result = await response.json();

          if (response.ok) {
            totalSent += result.sent;
            totalFailed += result.failed;
            if (result.errors) allErrors.push(...result.errors);
          } else {
            // Ha a request sikertelen, az egész batch-et sikertelennek jelöljük
            totalFailed += batch.length;
            batch.forEach(t => allErrors.push({ email: t.email, name: t.name, error: result.error || 'Request failed' }));
          }
        } catch (fetchErr) {
          totalFailed += batch.length;
          batch.forEach(t => allErrors.push({ email: t.email, name: t.name, error: fetchErr.message }));
        }

        // Progress frissítés minden batch után
        setBulkSendProgress({ sent: totalSent, failed: totalFailed, total: generatedTokens.length });

        // Kis szünet batch-ek között
        if (i + BATCH_SIZE < generatedTokens.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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
    } catch (err) {
      setBulkSendResult({ type: 'error', message: 'Hálózati hiba: ' + err.message });
    } finally {
      setBulkSending(false);
    }
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
    if (selectedRecipients.length === 0) return alert('Válassz legalább egy címzettet!');
    if (!subject.trim()) return alert('Add meg a tárgyat!');
    if (!body.trim()) return alert('Írd meg az üzenetet!');

    if (!confirm(`Biztosan elküldöd az emailt ${selectedRecipients.length} címzettnek?`)) return;

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
          message: `✅ Sikeresen elküldve ${result.sent} címzettnek!${result.failed > 0 ? ` ❌ ${result.failed} sikertelen.` : ''}`,
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
        setSendResult({ type: 'error', message: result.error || 'Ismeretlen hiba történt' });
      }
    } catch (err) {
      setSendResult({ type: 'error', message: 'Hálózati hiba: ' + err.message });
    } finally {
      setSending(false);
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Mail className="text-purple-600" size={28} />
              <h1 className="text-xl sm:text-2xl font-bold">Email küldés</h1>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1 text-purple-600 hover:text-purple-800 text-sm"
            >
              <ArrowLeft size={16} />
              Admin
            </button>
          </div>
          <p className="text-sm text-gray-500">Feladó: info@pharmagister.hu</p>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'compose' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Send size={16} />
              Új email
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tokens' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users size={16} />
              Token generálás
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sent' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock size={16} />
              Elküldött ({sentEmails.length})
            </button>
          </div>
        </div>

        {/* COMPOSE TAB */}
        {activeTab === 'compose' && (<>
        {/* Recipients section */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users size={20} />
              Címzettek ({selectedRecipients.length})
            </h2>
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-sm"
            >
              {showUserList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showUserList ? 'Bezárás' : 'Felhasználók'}
            </button>
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
                Mind törlése
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
                    placeholder="Keresés név vagy email alapján..."
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
                  <option value="all">Minden szerep</option>
                  <option value="pharmacist">Gyógyszerész</option>
                  <option value="pharmacy">Gyógyszertár</option>
                  <option value="assistant">Szakasszisztens</option>
                  <option value="inactive" className="text-red-600">🚫 Inaktív (soha nem lépett be)</option>
                </select>
              </div>

              {/* Select all / deselect */}
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={selectAll}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                >
                  Mind kijelölés ({filteredUsers.length})
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                >
                  Mind törlés
                </button>
                <button
                  onClick={selectInactiveUsers}
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 font-medium"
                >
                  🚫 Inaktív felhasználók ({users.filter(u => !u.lastLogin && !u.lastSeen && !u.passwordActivated).length})
                </button>
              </div>

              {/* Users list */}
              {loadingUsers ? (
                <div className="text-center py-4 text-gray-500">Felhasználók betöltése...</div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Nincs találat</div>
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
                          <div className="text-sm font-medium truncate">{u.displayName || 'Névtelen'}</div>
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
          <h2 className="text-lg font-semibold mb-3">Üzenet</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tárgy</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email tárgya..."
                className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Üzenet</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Írd meg az üzenetet..."
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
        <div className="flex justify-end">
          <button
            onClick={sendEmail}
            disabled={sending || selectedRecipients.length === 0 || !subject.trim() || !body.trim()}
            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Küldés folyamatban...
              </>
            ) : (
              <>
                <Send size={18} />
                Email küldése ({selectedRecipients.length} címzett)
              </>
            )}
          </button>
        </div>
        </>)}

        {/* TOKEN GENERATION TAB */}
        {activeTab === 'tokens' && (
          <div className="space-y-4">
            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Token generálás felhasználóknak</h3>
              <p className="text-sm text-blue-800">
                Ez a funkció egyedi linkeket generál a kiválasztott felhasználóknak.
                Minden felhasználó kap 2 linket:
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                <li><strong>Megtartás link:</strong> A felhasználó megtarthatja a fiókját</li>
                <li><strong>Törlés link:</strong> A felhasználó törölheti a fiókját és minden adatát</li>
              </ul>
              <p className="text-sm text-blue-800 mt-2">
                A tokenek 30 napig érvényesek és csak egyszer használhatók fel.
              </p>
            </div>

            {/* Célcsoport választó */}
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="font-semibold text-sm mb-3">Célcsoport kiválasztása</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { key: 'inactive', label: '🚫 Inaktívak', count: users.filter(u => !u.lastLogin && !u.lastSeen && !u.passwordActivated).length, color: 'orange' },
                  { key: 'active', label: '✅ Aktívak', count: users.filter(u => u.passwordActivated || u.lastLogin || u.lastSeen).length, color: 'green' },
                  { key: 'all', label: '👥 Mindenki', count: users.length, color: 'blue' },
                  { key: 'custom', label: '🎯 Egyéni', count: tokenSelectedUsers.length, color: 'purple' },
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
                      placeholder="Keresés név vagy email alapján..."
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
                        Mind törlése
                      </button>
                    </div>
                  )}

                  {/* Felhasználó lista */}
                  {loadingUsers ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Betöltés...</div>
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
                          return <div className="text-center py-4 text-gray-500 text-sm">Nincs találat</div>;
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
                                <div className="text-sm font-medium truncate">{u.displayName || 'Névtelen'}</div>
                                <div className="text-xs text-gray-500 truncate">{u.email}</div>
                              </div>
                              {isInactive && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex-shrink-0">Inaktív</span>
                              )}
                              {u.pharmagisterRole && (
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded flex-shrink-0">
                                  {u.pharmagisterRole === 'pharmacist' || u.pharmagisterRole === 'gyógyszerész' ? 'Gyógyszerész' :
                                   u.pharmagisterRole === 'pharmacy' || u.pharmagisterRole === 'gyógyszertár' ? 'Gyógyszertár' :
                                   u.pharmagisterRole === 'assistant' || u.pharmagisterRole === 'szakasszisztens' ? 'Szakasszisztens' :
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
              <button
                onClick={generateTokens}
                disabled={generatingTokens || (tokenTarget === 'custom' && tokenSelectedUsers.length === 0)}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium shadow-lg mt-4"
              >
                {generatingTokens ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Tokenek generálása...
                  </>
                ) : (
                  <>
                    <Users size={20} />
                    Tokenek generálása
                    {tokenTarget === 'inactive' && ` (${users.filter(u => !u.lastLogin && !u.lastSeen && !u.passwordActivated).length} inaktív)`}
                    {tokenTarget === 'active' && ` (${users.filter(u => u.passwordActivated || u.lastLogin || u.lastSeen).length} aktív)`}
                    {tokenTarget === 'all' && ` (${users.length} felhasználó)`}
                    {tokenTarget === 'custom' && ` (${tokenSelectedUsers.length} kiválasztott)`}
                  </>
                )}
              </button>
            </div>

            {/* Generated tokens list */}
            {generatedTokens.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Generált tokenek ({generatedTokens.length} felhasználó)
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
                          {showTokenEmail === idx ? 'Email elrejtése' : 'Email vázlat'}
                        </button>
                      </div>

                      {showTokenEmail === idx && (() => {
                        const emailTemplate = generateInactiveUserEmail(tokenData.name, tokenData.keepLink, tokenData.deleteLink);
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
                                alert('📋 Email szöveg vágólapra másolva!');
                              }}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                            >
                              📋 Szöveg másolása
                            </button>
                            <button
                              onClick={() => {
                                const template = generateInactiveUserEmail(tokenData.name, tokenData.keepLink, tokenData.deleteLink);
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
                Elküldött emailek
              </h2>
              <button
                onClick={loadSentEmails}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
              >
                Frissítés
              </button>
            </div>

            {loadingSent ? (
              <div className="text-center py-8 text-gray-500">Betöltés...</div>
            ) : sentEmails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Még nincs elküldött email</div>
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
                            {email.sentAt ? new Date(email.sentAt).toLocaleString('hu-HU', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            }) : 'Ismeretlen dátum'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            {email.sentCount} elküldve
                          </span>
                          {email.failedCount > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              {email.failedCount} sikertelen
                            </span>
                          )}
                          {expandedEmail === email.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </div>
                    </button>

                    {expandedEmail === email.id && (
                      <div className="border-t p-3 bg-gray-50">
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Címzettek ({email.to.length}):</p>
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
                            <p className="text-xs font-medium text-red-500 mb-1">Sikertelen címzettek:</p>
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
                          <p className="text-xs font-medium text-gray-500 mb-1">Üzenet:</p>
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
