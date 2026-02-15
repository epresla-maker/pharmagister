"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Mail, Users, Search, X, ChevronDown, ChevronUp, Send, ArrowLeft, CheckCircle, AlertCircle, Clock, Eye, EyeOff } from "lucide-react";

const ADMIN_EMAILS = ['epresla@icloud.com'];

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
  const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'sent'

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
      const response = await fetch('/api/admin/sent-emails');
      const data = await response.json();
      if (data.emails) setSentEmails(data.emails);
    } catch (error) {
      console.error('Error loading sent emails:', error);
    } finally {
      setLoadingSent(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !searchQuery || 
        (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = filterRole === 'all' || 
        u.pharmagisterRole === filterRole ||
        (filterRole === 'pharmacist' && u.pharmagisterRole === 'gyógyszerész') ||
        (filterRole === 'pharmacy' && u.pharmagisterRole === 'gyógyszertár') ||
        (filterRole === 'assistant' && u.pharmagisterRole === 'szakasszisztens');
      
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

  const sendEmail = async () => {
    if (selectedRecipients.length === 0) return alert('Válassz legalább egy címzettet!');
    if (!subject.trim()) return alert('Add meg a tárgyat!');
    if (!body.trim()) return alert('Írd meg az üzenetet!');

    if (!confirm(`Biztosan elküldöd az emailt ${selectedRecipients.length} címzettnek?`)) return;

    setSending(true);
    setSendResult(null);

    try {
      const response = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
                </select>
              </div>

              {/* Select all / deselect */}
              <div className="flex gap-2 mb-2">
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
