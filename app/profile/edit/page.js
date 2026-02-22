"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Save, X, Camera, ArrowLeft, User } from 'lucide-react';
import RouteGuard from '@/app/components/RouteGuard';

export default function ProfileEditPage() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
    bio: '',
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        displayName: userData.displayName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        bio: userData.bio || '',
      });
    }
  }, [userData]);

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

    setUploadingPhoto(true);
    try {
      // Ellenőrzés: van-e user
      if (!user || !user.uid) {
        throw new Error('Nincs bejelentkezve felhasználó!');
      }

      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('upload_preset', 'pharmagister_profiles');

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) {
        throw new Error('Cloudinary nincs konfigurálva');
      }

      console.log('Uploading to Cloudinary...');
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formDataUpload,
        }
      );

      const data = await response.json();
      console.log('Cloudinary response:', data);
      
      if (!response.ok) {
        console.error('Cloudinary error:', data);
        throw new Error(data.error?.message || 'Upload failed');
      }

      const imageUrl = data.secure_url;
      
      if (!imageUrl) {
        throw new Error('Nem kaptunk vissza URL-t a Cloudinary-tól');
      }

      // Firestore update - setDoc merge-gel megbízhatóbb
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { photoURL: imageUrl }, { merge: true });
      
      alert('✅ Kép mentve! Frissítés...');
      window.location.reload();
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert(`Hiba történt: ${error.message}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        email: formData.email || null,
        phone: formData.phone || null,
        bio: formData.bio || null,
      });
      alert('✅ Profil sikeresen mentve!');
      router.push('/settings');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Hiba történt a mentés során.');
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-[#F9FAFB]'} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-[#6B46C1]" />
      </div>
    );
  }

  return (
    <RouteGuard>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-[#F9FAFB]'} pb-24`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} border-b px-4 py-3 sticky top-0 z-10`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-white' : 'text-[#111827]'}`} />
            </button>
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              Profil szerkesztése
            </h1>
          </div>
        </div>

        <div className="p-4 max-w-lg mx-auto">
          {/* Profile Photo */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {userData.photoURL ? (
                <img
                  src={userData.photoURL}
                  alt="Profil"
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#6B46C1]"
                />
              ) : (
                <div className={`w-24 h-24 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} flex items-center justify-center border-4 border-[#6B46C1]`}>
                  <User className={`w-12 h-12 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 p-2 bg-[#6B46C1] rounded-full text-white hover:bg-[#5a3aa3] transition-colors"
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
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'} mt-2`}>
              Kattints a kamera ikonra a kép módosításához
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-[#374151]'} mb-1`}>
                Név
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1] ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-[#E5E7EB] text-[#111827]'
                }`}
                placeholder="A neved"
              />
            </div>

            {/* Email */}
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-[#374151]'} mb-1`}>
                E-mail cím
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1] ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-[#E5E7EB] text-[#111827]'
                }`}
                placeholder="email@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-[#374151]'} mb-1`}>
                Telefonszám
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1] ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-[#E5E7EB] text-[#111827]'
                }`}
                placeholder="+36 XX XXX XXXX"
              />
            </div>

            {/* Bio */}
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-[#374151]'} mb-1`}>
                Bemutatkozás
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                rows={4}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#6B46C1] focus:border-[#6B46C1] resize-none ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-[#E5E7EB] text-[#111827]'
                }`}
                placeholder="Írj magadról néhány sort..."
              />
            </div>
          </div>

          {/* Pharmagister link */}
          {userData.pharmaRole && (
            <div className={`mt-6 p-4 rounded-xl ${darkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-purple-200'} border`}>
              <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'} mb-2`}>
                A Pharmagister szakmai profilod szerkesztéséhez:
              </p>
              <button
                onClick={() => router.push('/pharmagister?tab=profile')}
                className="w-full px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3aa3] transition-colors text-sm font-medium"
              >
                Pharmagister profil szerkesztése
              </button>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full mt-6 px-4 py-3 bg-[#6B46C1] text-white rounded-xl hover:bg-[#5a3aa3] transition-colors font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Mentés
              </>
            )}
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => router.back()}
            className={`w-full mt-3 px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
              darkMode 
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                : 'bg-gray-100 text-[#374151] hover:bg-gray-200'
            } transition-colors`}
          >
            <X className="w-5 h-5" />
            Mégse
          </button>
        </div>
      </div>
    </RouteGuard>
  );
}
