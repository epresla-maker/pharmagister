"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Edit2, Save, X, Camera, AlertTriangle, Trash2 } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

export default function PharmaProfileEditor({ pharmaRole }) {
  const { user, userData } = useAuth();
  const market = getClientMarket();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    // Gyógyszertár
    pharmacyName: '',
    pharmacyAddress: '',
    pharmacyZipCode: '',
    pharmacyCity: '',
    pharmacyPhone: '',
    pharmacyEmail: '',
    
    // Helyettesítő
    pharmaYearsOfExperience: '',
    pharmaSoftwareKnowledge: [],
    pharmaHourlyRate: '',
    pharmaAvailableFrom: '',
    pharmaBio: '',
  });

  const softwareOptions = [
    'Lx-Line',
    'Novodata',
    'Quadro Byte',
    'Daxa',
    'Primula',
    'Egyéb'
  ];

  const getSoftwareLabel = (software) => {
    if (market !== 'de') return software;
    if (software === 'Egyéb') return 'Sonstige';
    return software;
  };

  // Store original data for cancel functionality
  const [originalFormData, setOriginalFormData] = useState({});

  useEffect(() => {
    if (userData) {
      const data = {
        pharmacyName: userData.pharmacyName || '',
        pharmacyAddress: userData.pharmacyAddress || '',
        pharmacyZipCode: userData.pharmacyZipCode || '',
        pharmacyCity: userData.pharmacyCity || '',
        pharmacyPhone: userData.pharmacyPhone || '',
        pharmacyEmail: userData.pharmacyEmail || '',
        pharmaYearsOfExperience: userData.pharmaYearsOfExperience || '',
        pharmaSoftwareKnowledge: userData.pharmaSoftwareKnowledge || [],
        pharmaHourlyRate: userData.pharmaHourlyRate || '',
        pharmaAvailableFrom: userData.pharmaAvailableFrom || '',
        pharmaBio: userData.pharmaBio || '',
      };
      setFormData(data);
      setOriginalFormData(data); // Save original data
    }
  }, [userData]);

  const handleCancel = () => {
    // Reset to original data
    setFormData(originalFormData);
    setEditing(false);
  };

  const handleSoftwareToggle = (software) => {
    setFormData(prev => ({
      ...prev,
      pharmaSoftwareKnowledge: prev.pharmaSoftwareKnowledge.includes(software)
        ? prev.pharmaSoftwareKnowledge.filter(s => s !== software)
        : [...prev.pharmaSoftwareKnowledge, software]
    }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(market === 'de' ? 'Die Dateigroesse darf maximal 5 MB sein!' : 'A fájl mérete maximum 5MB lehet!');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert(market === 'de' ? 'Du kannst nur Bilddateien hochladen!' : 'Csak képfájlokat tölthetsz fel!');
      return;
    }

    setUploadingPhoto(true);
    try {
      // 1. FormData létrehozása
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', `pharma_${user.uid}`); // pharma prefix a mappához

      // 2. API hívás a képfeltöltéshez Cloudinary-ra
      const idToken = await user.getIdToken();
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || (market === 'de' ? 'Upload fehlgeschlagen' : 'Feltöltés sikertelen'));
      }

      // 3. URL mentése Firestore-ba
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        pharmaPhotoURL: data.url,
        updatedAt: new Date().toISOString()
      });

      alert(market === 'de' ? 'Profilbild erfolgreich hochgeladen!' : 'Profilkép sikeresen feltöltve!');
      
      // Frissítjük az oldalt hogy látszódjon az új kép
      window.location.reload();
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert(market === 'de' ? 'Fehler beim Hochladen des Bildes.' : 'Hiba történt a kép feltöltése során.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      
      const dataToUpdate = {
        updatedAt: new Date().toISOString(),
      };

      if (pharmaRole === 'pharmacy') {
        if (!formData.pharmacyName || !formData.pharmacyCity) {
          alert(market === 'de' ? 'Bitte fuelle die Pflichtfelder aus!' : 'Kérlek töltsd ki a kötelező mezőket!');
          setLoading(false);
          return;
        }
        
        Object.assign(dataToUpdate, {
          pharmacyName: formData.pharmacyName,
          pharmacyAddress: formData.pharmacyAddress,
          pharmacyZipCode: formData.pharmacyZipCode,
          pharmacyCity: formData.pharmacyCity,
          pharmacyPhone: formData.pharmacyPhone,
          pharmacyEmail: formData.pharmacyEmail,
        });
      } else {
        if (!formData.pharmaYearsOfExperience || formData.pharmaSoftwareKnowledge.length === 0 || !formData.pharmaHourlyRate) {
          alert(market === 'de' ? 'Bitte fuelle die Pflichtfelder aus!' : 'Kérlek töltsd ki a kötelező mezőket!');
          setLoading(false);
          return;
        }
        
        Object.assign(dataToUpdate, {
          pharmaYearsOfExperience: formData.pharmaYearsOfExperience,
          pharmaSoftwareKnowledge: formData.pharmaSoftwareKnowledge,
          pharmaHourlyRate: formData.pharmaHourlyRate,
          pharmaAvailableFrom: formData.pharmaAvailableFrom,
          pharmaBio: formData.pharmaBio,
        });
      }

      await updateDoc(userRef, dataToUpdate);
      
      alert(market === 'de' ? 'Profil erfolgreich aktualisiert!' : 'Profil sikeresen frissítve!');
      setEditing(false);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(market === 'de' ? 'Fehler beim Aktualisieren des Profils.' : 'Hiba történt a profil frissítése során.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePharmagisterProfile = async () => {
    if (!user) return;

    const confirmation = window.prompt(
      market === 'de'
        ? 'Gib zur Bestaetigung der Loeschung des Pharmagister-Profils bitte ein: PHARMA'
        : 'A Pharmagister profil törlésének megerősítéséhez írd be: PHARMA'
    );

    if (confirmation !== 'PHARMA') {
      alert(market === 'de' ? 'Loeschung abgebrochen.' : 'A törlés megszakítva.');
      return;
    }

    try {
      // Remove pharmagister-related fields from user document
      await updateDoc(doc(db, 'users', user.uid), {
        pharmagisterRole: null,
        pharmaProfileComplete: false,
        pharmacyName: null,
        pharmacyAddress: null,
        pharmacyZipCode: null,
        pharmacyCity: null,
        pharmacyPhone: null,
        pharmacyEmail: null,
        pharmaYearsOfExperience: null,
        pharmaSoftwareKnowledge: null,
        pharmaHourlyRate: null,
        pharmaAvailableFrom: null,
        pharmaBio: null,
      });

      alert(market === 'de' ? 'Dein Pharmagister-Profil wurde erfolgreich geloescht!' : 'Pharmagister profilod sikeresen törölve!');
      setShowDeleteModal(false);
      
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error deleting Pharmagister profile:', error);
      alert((market === 'de' ? 'Fehler beim Loeschen des Pharmagister-Profils: ' : 'Hiba történt a Pharmagister profil törlése során: ') + error.message);
    }
  };

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#111827]">{market === 'de' ? 'Mein Pharmagister-Profil' : 'Pharmagister Profilom'}</h2>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#6B46C1] hover:bg-purple-700 text-white rounded-xl transition-colors font-medium"
          >
            <Edit2 className="w-4 h-4" />
            {market === 'de' ? 'Bearbeiten' : 'Szerkesztés'}
          </button>
        </div>

        {/* Profilkép megjelenítése - csak gyógyszertárnál, csak megtekintés */}
        {pharmaRole === 'pharmacy' && userData?.pharmaPhotoURL && (
          <div className="mb-6 flex items-center gap-4">
            <div>
              <img 
                src={userData.pharmaPhotoURL} 
                alt={market === 'de' ? 'Pharma-Profil' : 'Pharma profil'}
                className="w-24 h-24 rounded-full object-cover border-4 border-green-600"
              />
            </div>
            <div>
              <p className="text-sm text-gray-600">{market === 'de' ? 'Pharmagister-Profilbild' : 'Pharmagister profilkép'}</p>
              <p className="text-xs text-gray-500 mt-1">{market === 'de' ? 'Dieses Bild wird bei deinen Beitragen angezeigt' : 'Ez a kép jelenik meg a posztjaidnál'}</p>
            </div>
          </div>
        )}

        {pharmaRole === 'pharmacy' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Registrierungstyp:' : 'Regisztráció típusa:'}</label>
                <p className="text-[#111827] font-medium text-lg">{market === 'de' ? 'Apotheke' : 'Gyógyszertár'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Apothekenname' : 'Gyógyszertár neve'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmacyName || '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Stadt' : 'Város'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmacyCity || '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Postleitzahl' : 'Irányítószám'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmacyZipCode || '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Adresse' : 'Cím'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmacyAddress || '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Telefonnummer' : 'Telefonszám'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmacyPhone || '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">Email</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmacyEmail || '-'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Registrierungstyp:' : 'Regisztráció típusa:'}</label>
                <p className="text-[#111827] font-medium text-lg">
                  {pharmaRole === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : (market === 'de' ? 'Assistent/in' : 'Szakasszisztens')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Erfahrung' : 'Tapasztalat'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmaYearsOfExperience || '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Stundenlohn' : 'Órabér'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmaHourlyRate ? `${formData.pharmaHourlyRate} Ft` : '-'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Verfuegbar' : 'Elérhető'}</label>
                <p className="text-[#111827] font-medium text-lg">{formData.pharmaAvailableFrom || '-'}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Softwarekenntnisse' : 'Szoftverismeret'}</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.pharmaSoftwareKnowledge.length > 0 ? (
                  formData.pharmaSoftwareKnowledge.map(software => (
                    <span key={software} className="px-3 py-2 bg-[#F3F4F6] text-[#111827] border border-[#E5E7EB] rounded-xl text-sm font-semibold">
                      {getSoftwareLabel(software)}
                    </span>
                  ))
                ) : (
                  <p className="text-[#6B7280]">-</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-[#6B7280] mb-1">{market === 'de' ? 'Vorstellung' : 'Bemutatkozás'}</label>
              <p className="text-[#111827] whitespace-pre-wrap text-lg">{formData.pharmaBio || '-'}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#111827]">{market === 'de' ? 'Profil bearbeiten' : 'Profil Szerkesztése'}</h2>
      </div>

      {/* Profilkép feltöltés - csak szerkesztéskor, csak gyógyszertárnál */}
      {pharmaRole === 'pharmacy' && (
        <div className="mb-6 p-4 bg-white border border-[#E5E7EB] rounded-xl">
          <div className="flex items-center gap-4">
            <div className="relative">
              {userData?.pharmaPhotoURL ? (
                <img 
                  src={userData.pharmaPhotoURL} 
                  alt={market === 'de' ? 'Pharma-Profil' : 'Pharma profil'}
                  className="w-24 h-24 rounded-full object-cover border-4 border-green-600"
                />
              ) : (
                <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 9h-4v4h-4v-4H6v-4h4V4h4v4h4v4z"/>
                  </svg>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 p-2 bg-[#6B46C1] hover:bg-purple-700 text-white rounded-full shadow-lg disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">{market === 'de' ? 'Profilbild' : 'Profilkép'}</p>
              <p className="text-xs text-[#6B7280] mt-1">{market === 'de' ? 'Klicke auf das Kamera-Symbol, um das Bild zu aendern' : 'Kattints a kamera ikonra a kép megváltoztatásához'}</p>
              <p className="text-xs text-[#6B7280]">Max 5MB, JPG/PNG</p>
            </div>
          </div>
        </div>
      )}

      {pharmaRole === 'pharmacy' ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#6B7280] mb-2">
              {market === 'de' ? 'Apothekenname' : 'Gyógyszertár neve'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.pharmacyName}
              onChange={(e) => setFormData({ ...formData, pharmacyName: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#6B7280] mb-2">
                {market === 'de' ? 'Postleitzahl' : 'Irányítószám'}
              </label>
              <input
                type="text"
                value={formData.pharmacyZipCode}
                onChange={(e) => setFormData({ ...formData, pharmacyZipCode: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-[#6B7280] mb-2">
                {market === 'de' ? 'Stadt' : 'Város'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pharmacyCity}
                onChange={(e) => setFormData({ ...formData, pharmacyCity: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-2">
              {market === 'de' ? 'Adresse (Strasse, Hausnummer)' : 'Cím (utca, házszám)'}
            </label>
            <input
              type="text"
              value={formData.pharmacyAddress}
              onChange={(e) => setFormData({ ...formData, pharmacyAddress: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#6B7280] mb-2">
                {market === 'de' ? 'Telefonnummer' : 'Telefonszám'}
              </label>
              <input
                type="tel"
                value={formData.pharmacyPhone}
                onChange={(e) => setFormData({ ...formData, pharmacyPhone: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#6B7280] mb-2">
                {market === 'de' ? 'E-Mail-Adresse' : 'Email cím'}
              </label>
              <input
                type="email"
                value={formData.pharmacyEmail}
                onChange={(e) => setFormData({ ...formData, pharmacyEmail: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#6B7280] mb-2">
              {market === 'de' ? 'Erfahrung (Jahre)' : 'Tapasztalat (évek)'} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.pharmaYearsOfExperience}
              onChange={(e) => setFormData({ ...formData, pharmaYearsOfExperience: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
            >
              <option value="">{market === 'de' ? 'Waehlen...' : 'Válassz...'}</option>
              <option value="0-1">{market === 'de' ? '0-1 Jahre' : '0-1 év'}</option>
              <option value="1-3">{market === 'de' ? '1-3 Jahre' : '1-3 év'}</option>
              <option value="3-5">{market === 'de' ? '3-5 Jahre' : '3-5 év'}</option>
              <option value="5-10">{market === 'de' ? '5-10 Jahre' : '5-10 év'}</option>
              <option value="10+">{market === 'de' ? '10+ Jahre' : '10+ év'}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#6B7280] mb-2">
              {market === 'de' ? 'Softwarekenntnisse' : 'Szoftverismeret'} <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {softwareOptions.map(software => (
                <label key={software} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.pharmaSoftwareKnowledge.includes(software)}
                    onChange={() => handleSoftwareToggle(software)}
                    className="w-4 h-4 text-[#111827] bg-white border-[#E5E7EB] rounded focus:ring-[#6B7280]"
                  />
                  <span className="ml-2 text-[#111827] font-medium">{getSoftwareLabel(software)}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#6B7280] mb-2">
              {market === 'de' ? 'Stundenlohn (Ft)' : 'Órabér (Ft)'} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.pharmaHourlyRate}
              onChange={(e) => setFormData({ ...formData, pharmaHourlyRate: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-2">
              {market === 'de' ? 'Ab wann verfuegbar?' : 'Elérhető mikortól?'}
            </label>
            <input
              type="date"
              value={formData.pharmaAvailableFrom}
              onChange={(e) => setFormData({ ...formData, pharmaAvailableFrom: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#6B7280] mb-2">
              {market === 'de' ? 'Vorstellung' : 'Bemutatkozás'}
            </label>
            <textarea
              value={formData.pharmaBio}
              onChange={(e) => setFormData({ ...formData, pharmaBio: e.target.value })}
              rows="4"
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6B7280]"
              placeholder={market === 'de' ? 'Schreibe ein paar Saetze ueber dich...' : 'Írj néhány mondatot magadról...'}
            />
          </div>
        </div>
      )}

      {/* Gombok az űrlap alján */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCancel}
          className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#E5E7EB] text-[#111827] rounded-xl hover:bg-[#F3F4F6] transition-colors font-medium w-full sm:w-auto"
        >
          <X className="w-5 h-5" />
          {market === 'de' ? 'Abbrechen' : 'Mégse'}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#111827] hover:bg-[#374151] text-white rounded-xl transition-colors disabled:opacity-50 shadow-lg font-medium w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {market === 'de' ? 'Speichern...' : 'Mentés...'}
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {market === 'de' ? 'Speichern' : 'Mentés'}
            </>
          )}
        </button>
      </div>

      {/* Pharmagister Profile Deletion Section */}
      <div className="mt-8 pt-8 border-t-2 border-red-200">
        <h2 className="text-xl font-bold text-[#111827] mb-4">{market === 'de' ? 'Pharmagister-Profil loeschen' : 'Pharmagister profil törlése'}</h2>
        <div className="bg-white border-2 border-red-200 rounded-xl p-6">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            {market === 'de' ? 'Pharmagister-Profil loeschen' : 'Pharmagister profil törlése'}
          </button>
        </div>
      </div>

      {/* Delete Pharmagister Profile Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border-2 border-red-300 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h3 className="text-2xl font-bold text-red-600">{market === 'de' ? 'Pharmagister-Profil loeschen' : 'Pharmagister profil törlése'}</h3>
            </div>
            
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl mb-4">
              <p className="text-sm text-red-800 font-semibold mb-2">
                {market === 'de' ? 'Diese Aktion ist endgueltig!' : 'Ez a művelet végleges!'}
              </p>
              <p className="text-sm text-red-700">
                {market === 'de'
                  ? 'Alle Daten deines Pharmagister-Profils werden geloescht (Apotheke, berufliche Daten usw.), aber dein Hauptkonto bleibt unberuehrt. Moechtest du wirklich fortfahren?'
                  : 'A Pharmagister profilod összes adata törlődik (gyógyszertár, szakmai adatok stb.), de a fő fiókodat nem érinti. Biztosan folytatni szeretnéd?'}
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-[#374151]">
                {market === 'de'
                  ? 'Zur Bestaetigung der Loeschung gib in das Feld Folgendes ein: '
                  : 'A törlés megerősítéséhez írd be a mezőbe: '}<strong>PHARMA</strong>
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleDeletePharmagisterProfile}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  {market === 'de' ? 'Pharmagister-Profil loeschen' : 'Pharmagister profil törlése'}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  {market === 'de' ? 'Abbrechen' : 'Mégse'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
