"use client";
import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export default function ReportModal({ 
  isOpen, 
  onClose, 
  reportType, // 'user' | 'message' | 'demand'
  reportedUserId,
  reportedUserName,
  itemId, // message ID vagy demand ID
  itemContent // üzenet szövege vagy demand címe
}) {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const reasons = {
    user: [
      'Zaklatás vagy gyűlöletbeszéd',
      'Spam vagy csalás',
      'Hamis profil',
      'Szakmán kívüli tartalom',
      'Egyéb'
    ],
    message: [
      'Zaklatás',
      'Tiszteletlen viselkedés',
      'Spam',
      'Fenyegetés',
      'Egyéb'
    ],
    demand: [
      'Hamis hirdetés',
      'Spam',
      'Szakszerűtlen tartalom',
      'Egyéb'
    ]
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;

    setLoading(true);

    try {
      const reportRef = doc(collection(db, 'reports'));
      await setDoc(reportRef, {
        reporterId: user.uid,
        reporterEmail: user.email,
        type: reportType,
        reportedUserId: reportedUserId || null,
        reportedUserName: reportedUserName || null,
        itemId: itemId || null,
        itemContent: itemContent || null,
        reason,
        details,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Email értesítés küldése adminnak
      await fetch('/api/send-report-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          reportedUserName,
          reason,
          details,
        })
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason('');
        setDetails('');
      }, 2000);
    } catch (error) {
      console.error('Report error:', error);
      alert('Hiba történt a jelentés során');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl max-w-md w-full`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-600" />
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Jelentés
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Köszönjük a jelentést!
            </p>
            <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Hamarosan megvizsgáljuk.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {reportedUserName && (
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Jelentett {reportType === 'user' ? 'felhasználó' : 'tartalom'}:
                </p>
                <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {reportedUserName}
                </p>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Mi a probléma?
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className={`w-full p-2.5 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">Válassz okot...</option>
                {reasons[reportType]?.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Részletek (opcionális)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Add meg a részleteket..."
                className={`w-full p-2.5 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium ${
                  darkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Mégse
              </button>
              <button
                type="submit"
                disabled={loading || !reason}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-white ${
                  loading || !reason
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? 'Küldés...' : 'Jelentés'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
