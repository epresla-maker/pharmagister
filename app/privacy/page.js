"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Shield, Phone, Mail, MapPin, User, Clock, Loader2, Building2 } from 'lucide-react';
import RouteGuard from '@/app/components/RouteGuard';
import { getClientMarket } from '@/lib/marketI18n';

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();
  const [saving, setSaving] = useState(false);
  
  // Helyettesítő beállításai - mit küldjön a gyógyszertárnak jelentkezéskor
  const [substituteSettings, setSubstituteSettings] = useState({
    sharePhone: true,
    shareEmail: true,
    shareExperience: true,
    shareSoftwareKnowledge: true,
    shareHourlyRate: true,
    shareBio: true,
  });
  
  // Gyógyszertár beállításai - mit küldjön vissza a jelentkezőnek
  const [pharmacySettings, setPharmacySettings] = useState({
    sharePharmacyPhone: true,
    sharePharmacyEmail: true,
    sharePharmacyAddress: true,
    shareContactPerson: true,
    shareWorkHours: true,
  });

  const pharmaRole = userData?.pharmagisterRole;

  useEffect(() => {
    if (userData?.privacySettings) {
      if (userData.privacySettings.substitute) {
        setSubstituteSettings(prev => ({ ...prev, ...userData.privacySettings.substitute }));
      }
      if (userData.privacySettings.pharmacy) {
        setPharmacySettings(prev => ({ ...prev, ...userData.privacySettings.pharmacy }));
      }
    }
  }, [userData]);

  const handleToggle = async (settingType, key) => {
    let newSettings;
    
    if (settingType === 'substitute') {
      newSettings = {
        ...substituteSettings,
        [key]: !substituteSettings[key]
      };
      setSubstituteSettings(newSettings);
    } else {
      newSettings = {
        ...pharmacySettings,
        [key]: !pharmacySettings[key]
      };
      setPharmacySettings(newSettings);
    }
    
    setSaving(true);
    try {
      const updateData = {
        [`privacySettings.${settingType}`]: newSettings
      };
      await updateDoc(doc(db, 'users', user.uid), updateData);
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      // Revert on error
      if (settingType === 'substitute') {
        setSubstituteSettings(substituteSettings);
      } else {
        setPharmacySettings(pharmacySettings);
      }
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ enabled, onToggle }) => (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled 
          ? 'bg-[#6B46C1]' 
          : darkMode ? 'bg-gray-600' : 'bg-gray-300'
      }`}
    >
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );

  const substituteDataItems = [
    {
      key: 'sharePhone',
      icon: Phone,
      title: market === 'de' ? 'Telefonnummer' : 'Telefonszám',
      description: market === 'de' ? 'Die Apotheke sieht deine Telefonnummer' : 'A gyógyszertár láthatja a telefonszámodat',
      color: 'text-green-600',
      bgColor: darkMode ? 'bg-green-900/30' : 'bg-green-100'
    },
    {
      key: 'shareEmail',
      icon: Mail,
      title: market === 'de' ? 'E-Mail-Adresse' : 'E-mail cím',
      description: market === 'de' ? 'Die Apotheke sieht deine E-Mail-Adresse' : 'A gyógyszertár láthatja az e-mail címedet',
      color: 'text-blue-600',
      bgColor: darkMode ? 'bg-blue-900/30' : 'bg-blue-100'
    },
    {
      key: 'shareExperience',
      icon: Clock,
      title: market === 'de' ? 'Erfahrung' : 'Tapasztalat',
      description: market === 'de' ? 'Anzahl der Berufsjahre' : 'Munkatapasztalat évek száma',
      color: 'text-orange-600',
      bgColor: darkMode ? 'bg-orange-900/30' : 'bg-orange-100'
    },
    {
      key: 'shareSoftwareKnowledge',
      icon: User,
      title: market === 'de' ? 'Softwarekenntnisse' : 'Szoftverismeret',
      description: market === 'de' ? 'Bekannte Apothekensoftware' : 'Ismert gyógyszertári szoftverek',
      color: 'text-purple-600',
      bgColor: darkMode ? 'bg-purple-900/30' : 'bg-purple-100'
    },
    {
      key: 'shareHourlyRate',
      icon: Clock,
      title: market === 'de' ? 'Stundenlohn' : 'Órabér',
      description: market === 'de' ? 'Gewuenschten Stundenlohn anzeigen' : 'Elvárt órabér megjelenítése',
      color: 'text-teal-600',
      bgColor: darkMode ? 'bg-teal-900/30' : 'bg-teal-100'
    },
    {
      key: 'shareBio',
      icon: User,
      title: market === 'de' ? 'Kurzprofil' : 'Bemutatkozás',
      description: market === 'de' ? 'Kurzer Vorstellungstext' : 'Rövid bemutatkozó szöveg',
      color: 'text-indigo-600',
      bgColor: darkMode ? 'bg-indigo-900/30' : 'bg-indigo-100'
    }
  ];

  const pharmacyDataItems = [
    {
      key: 'sharePharmacyPhone',
      icon: Phone,
      title: market === 'de' ? 'Telefonnummer' : 'Telefonszám',
      description: market === 'de' ? 'Der/die Bewerber/in sieht die Telefonnummer der Apotheke' : 'A jelentkező láthatja a gyógyszertár telefonszámát',
      color: 'text-green-600',
      bgColor: darkMode ? 'bg-green-900/30' : 'bg-green-100'
    },
    {
      key: 'sharePharmacyEmail',
      icon: Mail,
      title: market === 'de' ? 'E-Mail-Adresse' : 'E-mail cím',
      description: market === 'de' ? 'Der/die Bewerber/in sieht die E-Mail-Adresse der Apotheke' : 'A jelentkező láthatja a gyógyszertár e-mail címét',
      color: 'text-blue-600',
      bgColor: darkMode ? 'bg-blue-900/30' : 'bg-blue-100'
    },
    {
      key: 'sharePharmacyAddress',
      icon: MapPin,
      title: market === 'de' ? 'Genaue Adresse' : 'Pontos cím',
      description: market === 'de' ? 'Strasse und Hausnummer anzeigen (Stadt ist immer sichtbar)' : 'Utca, házszám megjelenítése (város mindig látható)',
      color: 'text-red-600',
      bgColor: darkMode ? 'bg-red-900/30' : 'bg-red-100'
    },
    {
      key: 'shareContactPerson',
      icon: User,
      title: market === 'de' ? 'Ansprechperson' : 'Kapcsolattartó neve',
      description: market === 'de' ? 'Name der Ansprechperson anzeigen' : 'Kapcsolattartó személy megjelenítése',
      color: 'text-purple-600',
      bgColor: darkMode ? 'bg-purple-900/30' : 'bg-purple-100'
    }
  ];

  return (
    <RouteGuard>
      <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10 pt-safe-small`}>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
            >
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
            </button>
            <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Datenschutz' : 'Adatvédelem'}</h1>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-auto text-[#6B46C1]" />}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className={`${darkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-purple-200'} border rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                {market === 'de' ? 'Hier kannst du festlegen, welche Daten bei Bewerbung oder Annahme mit der Gegenseite geteilt werden.' : 'Itt beállíthatod, hogy milyen adataidat osszuk meg a másik féllel jelentkezéskor vagy elfogadáskor.'}
              </p>
            </div>
          </div>

          {/* Helyettesítő beállítások */}
          {(pharmaRole === 'pharmacist' || pharmaRole === 'assistant' || pharmaRole === 'pka' || !pharmaRole) && (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
              <div className={`px-4 py-3 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
                <div className="flex items-center gap-2">
                  <User className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {market === 'de' ? 'Bei Bewerbung gesendete Daten' : 'Jelentkezéskor küldött adatok'}
                  </h3>
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                  {market === 'de' ? 'Diese Daten sieht die Apotheke, wenn du dich auf eine Anfrage bewirbst' : 'Ezeket az adatokat látja a gyógyszertár, amikor jelentkezel egy igényre'}
                </p>
              </div>
              <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {substituteDataItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.bgColor}`}>
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                      </div>
                    </div>
                    <Toggle 
                      enabled={substituteSettings[item.key]} 
                      onToggle={() => handleToggle('substitute', item.key)} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gyógyszertár beállítások */}
          {(pharmaRole === 'pharmacy' || !pharmaRole) && (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
              <div className={`px-4 py-3 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {market === 'de' ? 'Bei Annahme gesendete Daten' : 'Elfogadáskor küldött adatok'}
                  </h3>
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                  {market === 'de' ? 'Diese Daten sieht der/die Bewerber/in nach Annahme' : 'Ezeket az adatokat látja a jelentkező, amikor elfogadod'}
                </p>
              </div>
              <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {pharmacyDataItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.bgColor}`}>
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                      </div>
                    </div>
                    <Toggle 
                      enabled={pharmacySettings[item.key]} 
                      onToggle={() => handleToggle('pharmacy', item.key)} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className={`${darkMode ? 'bg-yellow-900/30 border-yellow-600' : 'bg-yellow-50 border-yellow-500'} border rounded-xl p-4`}>
            <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
              {market === 'de' ? '⚠️ ' : '⚠️ '}<strong>{market === 'de' ? 'Wichtig:' : 'Fontos:'}</strong> {market === 'de' ? 'Grundlegende Identifikationsdaten (Name, Profilbild) bleiben fuer die Gegenseite immer sichtbar, damit die Kommunikation funktioniert.' : 'Az alapvető azonosító adatok (név, profilkép) mindig láthatók a másik fél számára a sikeres kommunikáció érdekében.'}
            </p>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
