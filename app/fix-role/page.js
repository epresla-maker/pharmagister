"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getClientMarket } from '@/lib/marketI18n';

export default function FixRolePage() {
  const { user, userData } = useAuth();
  const market = getClientMarket();
  const [selectedRole, setSelectedRole] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdateRole = async () => {
    if (!user || !selectedRole) return;

    const confirmed = window.confirm(
      market === 'de'
        ? `Moechtest du die Rolle wirklich auf ${selectedRole} setzen?`
        : `Biztosan beállítod a szerepkört erre: ${selectedRole}?`
    );

    if (!confirmed) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pharmagisterRole: selectedRole
      });
      alert(market === 'de' ? `✅ Rolle erfolgreich gesetzt: ${selectedRole}` : `✅ Szerepkör sikeresen beállítva: ${selectedRole}`);
      window.location.reload();
    } catch (error) {
      console.error('Error updating role:', error);
      alert((market === 'de' ? '❌ Fehler: ' : '❌ Hiba történt: ') + error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>{market === 'de' ? 'Anmeldung erforderlich...' : 'Bejelentkezés szükséges...'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">{market === 'de' ? '🔧 Rollen-Reparatur' : '🔧 Szerepkör javítás'}</h1>
        
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-700">
            <strong>Email:</strong> {userData?.email || user.email}
          </p>
          <p className="text-sm text-gray-700">
            <strong>{market === 'de' ? 'Aktuelle Rolle:' : 'Jelenlegi szerepkör:'}</strong>{' '}
            {userData?.pharmagisterRole || (market === 'de' ? '❌ KEINE' : '❌ NINCS')}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {market === 'de' ? 'Waehle die Rolle:' : 'Válaszd ki a szerepkört:'}
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="">{market === 'de' ? '-- Waehlen --' : '-- Válassz --'}</option>
            <option value="pharmacy">{market === 'de' ? '🏥 Apotheke (pharmacy)' : '🏥 Gyógyszertár (pharmacy)'}</option>
            <option value="pharmacist">{market === 'de' ? '💊 Apotheker/in (pharmacist)' : '💊 Gyógyszerész (pharmacist)'}</option>
            <option value="assistant">{market === 'de' ? 'Assistent/in (assistant)' : 'Szakasszisztens (assistant)'}</option>
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
          {updating ? (market === 'de' ? '⏳ Aktualisierung...' : '⏳ Frissítés...') : (market === 'de' ? '✅ Rolle setzen' : '✅ Szerepkör beállítása')}
        </button>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-xs text-yellow-800">
            {market === 'de' ? '⚠️ Diese Seite ist nur fuer Admin/Debugging gedacht. Sie wird nach der Rollenreparatur entfernt.' : '⚠️ Ez az oldal csak admin/debugging célra szolgál. Törlöm miután megjavítottuk a szerepkört.'}
          </p>
        </div>
      </div>
    </div>
  );
}
