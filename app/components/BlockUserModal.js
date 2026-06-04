"use client";
import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { getClientMarket } from '@/lib/marketI18n';

export default function BlockUserModal({ 
  isOpen, 
  onClose, 
  targetUserId,
  targetUserName,
  isCurrentlyBlocked = false,
  onBlockChange
}) {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const market = getClientMarket();
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!user || !targetUserId) return;
    setLoading(true);

    try {
      const blockRef = doc(db, 'blockedUsers', `${user.uid}_${targetUserId}`);
      
      if (isCurrentlyBlocked) {
        // Unblock
        await deleteDoc(blockRef);
      } else {
        // Block
        await setDoc(blockRef, {
          blockerId: user.uid,
          blockedUserId: targetUserId,
          blockedUserName: targetUserName,
          createdAt: new Date().toISOString(),
        });
      }

      if (onBlockChange) {
        onBlockChange(!isCurrentlyBlocked);
      }
      
      onClose();
    } catch (error) {
      console.error('Block error:', error);
      alert(market === 'de' ? 'Ein Fehler ist aufgetreten.' : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl max-w-md w-full`}>
        {/* Header */}
        <div className="flex items center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-orange-600" />
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {isCurrentlyBlocked
                ? (market === 'de' ? 'Blockierung aufheben' : 'Tiltás feloldása')
                : (market === 'de' ? 'Benutzer blockieren' : 'Felhasználó letiltása')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {isCurrentlyBlocked ? (
              <>
                {market === 'de' ? 'Moechtest du die Blockierung wirklich aufheben fuer' : 'Biztosan feloldod'} <strong>{targetUserName}</strong>{market === 'de' ? '?' : ' tiltását?'}
                <br/><br/>
                {market === 'de' ? 'Ihr koennt danach wieder Inhalte sehen und euch Nachrichten senden.' : 'Újra látni fogod a tartalmait és üzeneteket küldhettek egymásnak.'}
              </>
            ) : (
              <>
                {market === 'de' ? 'Moechtest du den Benutzer wirklich blockieren:' : 'Biztosan letiltod'} <strong>{targetUserName}</strong>{market === 'de' ? '?' : ' felhasználót?'}
                <br/><br/>
                {market === 'de' ? 'Nach der Blockierung:' : 'Ha letiltod:'}
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>{market === 'de' ? 'Er/Sie kann dir keine Nachrichten mehr senden' : 'Nem fog tudni üzenetet küldeni neked'}</li>
                  <li>{market === 'de' ? 'Du siehst seine/ihre Bedarfe nicht mehr' : 'Nem fogod látni az igényeit'}</li>
                  <li>{market === 'de' ? 'Er/Sie sieht deine Bedarfe ebenfalls nicht' : 'Ő sem fogja látni a te igényeidet'}</li>
                </ul>
              </>
            )}
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium ${
                darkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              {market === 'de' ? 'Abbrechen' : 'Mégse'}
            </button>
            <button
              onClick={handleBlock}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-white ${
                loading
                  ? 'bg-orange-400 cursor-not-allowed'
                  : isCurrentlyBlocked 
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {loading ? '...' : (isCurrentlyBlocked ? (market === 'de' ? 'Aufheben' : 'Feloldás') : (market === 'de' ? 'Blockieren' : 'Letiltás'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
