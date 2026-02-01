"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function FixRolePage() {
  const { user, userData } = useAuth();
  const [selectedRole, setSelectedRole] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdateRole = async () => {
    if (!user || !selectedRole) return;

    const confirmed = window.confirm(
      `Biztosan beállítod a szerepkört erre: ${selectedRole}?`
    );

    if (!confirmed) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pharmagisterRole: selectedRole
      });
      alert(`✅ Szerepkör sikeresen beállítva: ${selectedRole}`);
      window.location.reload();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('❌ Hiba történt: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>Bejelentkezés szükséges...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">🔧 Szerepkör javítás</h1>
        
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-700">
            <strong>Email:</strong> {userData?.email || user.email}
          </p>
          <p className="text-sm text-gray-700">
            <strong>Jelenlegi szerepkör:</strong>{' '}
            {userData?.pharmagisterRole || '❌ NINCS'}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Válaszd ki a szerepkört:
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="">-- Válassz --</option>
            <option value="pharmacy">🏥 Gyógyszertár (pharmacy)</option>
            <option value="pharmacist">💊 Gyógyszerész (pharmacist)</option>
            <option value="assistant">Szakasszisztens (assistant)</option>
          </select>
        </div>

        <button
          onClick={handleUpdateRole}
          disabled={!selectedRole || updating}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white ${
            selectedRole && !updating
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {updating ? '⏳ Frissítés...' : '✅ Szerepkör beállítása'}
        </button>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-xs text-yellow-800">
            ⚠️ Ez az oldal csak admin/debugging célra szolgál. Törlöm miután megjavítottuk a szerepkört.
          </p>
        </div>
      </div>
    </div>
  );
}
