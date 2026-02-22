"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import RouteGuard from '@/app/components/RouteGuard';
import { Loader2, Camera, ArrowLeft, Building2, User, Users } from 'lucide-react';

function PharmagisterSetupContent() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role');
  const editMode = searchParams.get('edit') === 'true';
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [step, setStep] = useState(role ? 2 : 1); // 1: szerepkör választás, 2: adatok megadása
  const [selectedRole, setSelectedRole] = useState(role || '');
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const [formData, setFormData] = useState({
    // Közös mezők
    displayName: '',
    photoURL: '',
    phone: '',
    
    // Gyógyszertár specifikus
    pharmacyName: '',
    contactName: '',
    city: '',
    zipCode: '',
    street: '',
    houseNumber: '',
    
    // Helyettesítő specifikus
    yearsOfExperience: '',
    softwareKnowledge: [],
    hourlyRate: '',
    bio: '',
  });

  const softwareOptions = [
    'Lx-Line',
    'Novodata',
    'Quadro Byte',
    'Daxa',
    'Primula',
    'Egyéb'
  ];

  // Ha van már szerepkör és nem edit módban vagyunk, irányítsuk vissza
  useEffect(() => {
    if (userData?.pharmagisterRole && !editMode) {
      router.push('/pharmagister');
      return;
    }

    // Edit módban töltsd be az adatokat
    if (editMode && userData) {
      setSelectedRole(userData.pharmagisterRole || '');
      setStep(2);
      setFormData({
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        phone: userData.phone || userData.pharmacyPhone || '',
        pharmacyName: userData.pharmacyName || '',
        contactName: userData.contactName || userData.displayName || '',
        city: userData.pharmacyCity || userData.city || '',
        zipCode: userData.pharmacyZipCode || userData.zipCode || '',
        street: userData.pharmacyStreet || userData.street || '',
        houseNumber: userData.pharmacyHouseNumber || userData.houseNumber || '',
        yearsOfExperience: userData.pharmaYearsOfExperience || '',
        softwareKnowledge: userData.pharmaSoftwareKnowledge || [],
        hourlyRate: userData.pharmaHourlyRate || '',
        bio: userData.pharmaBio || '',
      });
      setPhotoPreview(userData.photoURL || null);
    }
  }, [userData, editMode, router]);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleSoftwareToggle = (software) => {
    setFormData(prev => ({
      ...prev,
      softwareKnowledge: prev.softwareKnowledge.includes(software)
        ? prev.softwareKnowledge.filter(s => s !== software)
        : [...prev.softwareKnowledge, software]
    }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A fájl mérete maximum 5MB lehet!');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Csak képfájlokat tölthetsz fel!');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('upload_preset', 'pharmagister_profiles');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/dyoq9pcdx/image/upload`,
        {
          method: 'POST',
          body: uploadFormData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Feltöltés sikertelen');
      }

      const imageUrl = data.secure_url;
      
      // Azonnal mentjük Firestore-ba
      await setDoc(doc(db, 'users', user.uid), { photoURL: imageUrl }, { merge: true });
      
      setFormData(prev => ({ ...prev, photoURL: imageUrl }));
      alert('✅ Profilkép mentve!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Hiba történt a kép feltöltése során: ' + error.message);
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      
      const dataToUpdate = {
        pharmagisterRole: selectedRole,
        pharmaProfileComplete: true,
        updatedAt: new Date().toISOString(),
      };

      if (selectedRole === 'pharmacy') {
        // Gyógyszertár validáció - TELJES CÍM KÖTELEZŐ
        if (!formData.pharmacyName || !formData.contactName || !formData.city || !formData.zipCode || !formData.street || !formData.houseNumber) {
          alert('Kérlek töltsd ki az összes kötelező mezőt! A gyógyszertár teljes címe kötelező (város, irányítószám, utca, házszám).');
          setLoading(false);
          return;
        }
        
        Object.assign(dataToUpdate, {
          displayName: formData.contactName,
          photoURL: formData.photoURL || '',
          pharmacyName: formData.pharmacyName,
          contactName: formData.contactName,
          pharmacyCity: formData.city,
          pharmacyZipCode: formData.zipCode,
          pharmacyStreet: formData.street,
          pharmacyHouseNumber: formData.houseNumber,
          pharmacyPhone: formData.phone,
          pharmacyEmail: user.email,
        });
      } else {
        // Helyettesítő validáció
        if (!formData.displayName || !formData.yearsOfExperience || formData.softwareKnowledge.length === 0) {
          alert('Kérlek töltsd ki az összes kötelező mezőt!');
          setLoading(false);
          return;
        }
        
        Object.assign(dataToUpdate, {
          displayName: formData.displayName,
          photoURL: formData.photoURL || '',
          phone: formData.phone,
          pharmaYearsOfExperience: formData.yearsOfExperience,
          pharmaSoftwareKnowledge: formData.softwareKnowledge,
          pharmaHourlyRate: formData.hourlyRate || null,
          pharmaBio: formData.bio,
        });
      }

      await updateDoc(userRef, dataToUpdate);
      
      if (editMode) {
        alert('✅ Profil sikeresen frissítve!');
      } else {
        alert('✅ Profil sikeresen létrehozva!');
      }
      
      router.push('/pharmagister');
      
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Hiba történt a profil mentése során.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8 pb-40">
        <div className="max-w-[420px] sm:max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6">{" "}          
          {/* Fejléc */}
          <div className="mb-6">
            <button
              onClick={() => step === 2 && !editMode ? setStep(1) : router.push('/pharmagister')}
              className="flex items-center text-purple-600 hover:text-purple-700 mb-4"
            >
              <ArrowLeft className="w-5 h-5 mr-1" />
              {step === 2 && !editMode ? 'Vissza' : 'Pharmagister'}
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {editMode ? 'Profil szerkesztése' : 'Pharmagister Regisztráció'}
            </h1>
            <p className="text-gray-600 mt-1">
              {step === 1 ? 'Válaszd ki a szerepkörödet' : 
               selectedRole === 'pharmacy' ? '🏢 Gyógyszertár adatok' :
               selectedRole === 'pharmacist' ? 'Gyógyszerész adatok' :
               'Szakasszisztens adatok'}
            </p>
          </div>

          {/* STEP 1: Szerepkör választás */}
          {step === 1 && (
            <div className="space-y-4">
              <button
                onClick={() => handleRoleSelect('pharmacy')}
                className="w-full bg-white border-2 border-gray-200 hover:border-purple-400 rounded-xl p-6 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Building2 className="w-7 h-7 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Gyógyszertár</h3>
                    <p className="text-sm text-gray-500">Helyettesítőt keresek a patikámba</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('pharmacist')}
                className="w-full bg-white border-2 border-gray-200 hover:border-blue-400 rounded-xl p-6 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <User className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Gyógyszerész</h3>
                    <p className="text-sm text-gray-500">Helyettesítést vállalok gyógyszerészként</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('assistant')}
                className="w-full bg-white border-2 border-gray-200 hover:border-green-400 rounded-xl p-6 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <Users className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Szakasszisztens</h3>
                    <p className="text-sm text-gray-500">Helyettesítést vállalok asszisztensként</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: Adatok megadása */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
              
              {/* Profilkép feltöltés */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                    {photoPreview || formData.photoURL ? (
                      <img 
                        src={photoPreview || formData.photoURL} 
                        alt="Profilkép" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition-colors shadow-lg"
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
                <p className="text-sm text-gray-500 mt-2">Profilkép feltöltése</p>
              </div>

              {selectedRole === 'pharmacy' ? (
                /* Gyógyszertár űrlap */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gyógyszertár neve <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.pharmacyName}
                      onChange={(e) => setFormData({ ...formData, pharmacyName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="pl. Alma Gyógyszertár"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kapcsolattartó neve <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="pl. Kovács Péter"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email cím
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Automatikusan kitöltve a regisztrációból</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefonszám
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="+36 30 123 4567"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Város <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Budapest"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Irányítószám <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="1234"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Utca <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Kossuth Lajos utca"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Házszám <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.houseNumber}
                        onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="12"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Helyettesítő űrlap (Gyógyszerész & Szakasszisztens) */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teljes név <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="pl. Nagy Eszter"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email cím
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Automatikusan kitöltve a regisztrációból</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefonszám
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="+36 30 123 4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tapasztalat <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.yearsOfExperience}
                      onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="">Válassz...</option>
                      <option value="0-1">0-1 év</option>
                      <option value="1-3">1-3 év</option>
                      <option value="3-5">3-5 év</option>
                      <option value="5-10">5-10 év</option>
                      <option value="10+">10+ év</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Szoftverismeret <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {softwareOptions.map(software => (
                        <label key={software} className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.softwareKnowledge.includes(software)}
                            onChange={() => handleSoftwareToggle(software)}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{software}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Órabér (Ft) <span className="text-gray-400 text-xs">(opcionális)</span>
                    </label>
                    <input
                      type="number"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="0"
                      placeholder="Hagyd üresen ha nem szeretnéd megadni"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bemutatkozás
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Írj néhány mondatot magadról, ami meggyőzi a gyógyszertárakat..."
                    />
                  </div>
                </>
              )}

              {/* Submit gomb */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Mentés...
                  </>
                ) : (
                  editMode ? 'Profil mentése' : 'Regisztráció beküldése'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}

export default function PharmagisterSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Betöltés...</p>
        </div>
      </div>
    }>
      <PharmagisterSetupContent />
    </Suspense>
  );
}
