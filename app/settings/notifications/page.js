"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Bell, MessageCircle, Calendar, CheckCircle, Loader2, Smartphone, MapPin, X, Plus } from 'lucide-react';
import RouteGuard from '@/app/components/RouteGuard';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const [saving, setSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  
  const pharmaRole = userData?.pharmagisterRole;
  
  const [settings, setSettings] = useState({
    pushEnabled: true,
    newMessage: true,
    newApplication: true,
    applicationStatus: true,
    newDemand: true,
    reminders: true,
    // Új beállítások az igény értesítésekhez
    demandZipCodes: [],
    demandPositions: [], // ['pharmacist', 'assistant']
  });
  
  const [newZipCode, setNewZipCode] = useState('');
  const [zipCodeError, setZipCodeError] = useState('');

  useEffect(() => {
    if (userData?.notificationSettings) {
      setSettings(prev => ({
        ...prev,
        ...userData.notificationSettings,
        // Alapértelmezetten a saját szerepkörünket kapcsoljuk be
        demandPositions: userData.notificationSettings.demandPositions || 
          (pharmaRole === 'pharmacist' ? ['pharmacist'] : 
           pharmaRole === 'assistant' ? ['assistant'] : [])
      }));
    } else if (pharmaRole && pharmaRole !== 'pharmacy') {
      // Ha nincs még beállítás, alapértelmezetten a saját szerepkört állítsuk be
      setSettings(prev => ({
        ...prev,
        demandPositions: pharmaRole === 'pharmacist' ? ['pharmacist'] : 
                         pharmaRole === 'assistant' ? ['assistant'] : []
      }));
    }
    
    // Check push permission status
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    
    // Check push subscription status
    checkPushSubscription();
  }, [userData]);
  
  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsPushSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };
  
  const handleEnablePush = async () => {
    try {
      console.log('🔔 Starting push subscription...');
      
      // 1. Check if supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('A böngésződ nem támogatja a push értesítéseket.');
        return;
      }
      
      // 2. Request notification permission
      console.log('🔔 Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('🔔 Permission result:', permission);
      setPushPermission(permission);
      
      if (permission !== 'granted') {
        alert('Az értesítések engedélyezése szükséges a push értesítésekhez.');
        return;
      }
      
      // 3. Get service worker registration
      console.log('🔔 Getting service worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('🔔 Service worker ready:', registration);
      
      // 4. Subscribe to push
      console.log('🔔 Subscribing to push with VAPID key:', VAPID_PUBLIC_KEY?.substring(0, 20) + '...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('🔔 Subscription created:', subscription);
      
      // 5. Save to server
      console.log('🔔 Saving subscription to server...');
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscription: subscription.toJSON()
        })
      });
      
      const result = await response.json();
      console.log('🔔 Server response:', result);
      
      if (response.ok) {
        setIsPushSubscribed(true);
        alert('✅ Push értesítések sikeresen bekapcsolva!');
      } else {
        throw new Error(result.error || 'Server error');
      }
    } catch (error) {
      console.error('🔔 Push subscription error:', error);
      alert('Hiba történt a push értesítések bekapcsolásakor: ' + error.message);
    }
  };

  const handleDisablePush = async () => {
    try {
      console.log('🔔 Disabling push subscription...');
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();
        console.log('🔔 Unsubscribed from push');
        
        // Remove from server
        const response = await fetch('/api/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            endpoint: subscription.endpoint
          })
        });
        
        console.log('🔔 Server delete response:', await response.json());
      }
      
      setIsPushSubscribed(false);
      alert('Push értesítések kikapcsolva.');
    } catch (error) {
      console.error('🔔 Error disabling push:', error);
      alert('Hiba történt: ' + error.message);
    }
  };

  const handleToggle = async (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(newSettings);
    
    // Save to Firestore
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: newSettings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handlePositionToggle = async (position) => {
    const currentPositions = settings.demandPositions || [];
    let newPositions;
    
    if (currentPositions.includes(position)) {
      newPositions = currentPositions.filter(p => p !== position);
    } else {
      newPositions = [...currentPositions, position];
    }
    
    const newSettings = {
      ...settings,
      demandPositions: newPositions
    };
    setSettings(newSettings);
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: newSettings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleAddZipCode = async () => {
    const zip = newZipCode.trim();
    
    // Validáció
    if (!zip) {
      setZipCodeError('Adj meg egy irányítószámot');
      return;
    }
    
    if (!/^\d{4}$/.test(zip)) {
      setZipCodeError('Az irányítószám 4 számjegyű kell legyen');
      return;
    }
    
    if (settings.demandZipCodes?.includes(zip)) {
      setZipCodeError('Ez az irányítószám már szerepel a listában');
      return;
    }
    
    setZipCodeError('');
    
    const newZipCodes = [...(settings.demandZipCodes || []), zip];
    const newSettings = {
      ...settings,
      demandZipCodes: newZipCodes
    };
    setSettings(newSettings);
    setNewZipCode('');
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: newSettings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveZipCode = async (zipToRemove) => {
    const newZipCodes = (settings.demandZipCodes || []).filter(z => z !== zipToRemove);
    const newSettings = {
      ...settings,
      demandZipCodes: newZipCodes
    };
    setSettings(newSettings);
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: newSettings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettings(settings);
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

  const notificationTypes = [
    {
      key: 'newMessage',
      icon: MessageCircle,
      title: 'Új üzenetek',
      description: 'Értesítés új chat üzenetekről',
      color: 'text-blue-600',
      bgColor: darkMode ? 'bg-blue-900/30' : 'bg-blue-100',
      showFor: ['pharmacy', 'pharmacist', 'assistant', null] // mindenki
    },
    {
      key: 'newApplication',
      icon: CheckCircle,
      title: 'Új jelentkezések',
      description: 'Értesítés, ha valaki jelentkezik az igényedre',
      color: 'text-green-600',
      bgColor: darkMode ? 'bg-green-900/30' : 'bg-green-100',
      showFor: ['pharmacy'] // csak gyógyszertáraknak
    },
    {
      key: 'applicationStatus',
      icon: Bell,
      title: 'Jelentkezés státusza',
      description: 'Értesítés, ha elfogadták vagy elutasították a jelentkezésed',
      color: 'text-orange-600',
      bgColor: darkMode ? 'bg-orange-900/30' : 'bg-orange-100',
      showFor: ['pharmacist', 'assistant'] // csak helyettesítőknek
    },
    {
      key: 'newDemand',
      icon: Calendar,
      title: 'Új igények',
      description: 'Értesítés új helyettesítési igényekről a környéken',
      color: 'text-purple-600',
      bgColor: darkMode ? 'bg-purple-900/30' : 'bg-purple-100',
      showFor: ['pharmacist', 'assistant'] // csak helyettesítőknek
    },
    {
      key: 'reminders',
      icon: Bell,
      title: 'Emlékeztetők',
      description: 'Közelgő helyettesítések emlékeztetői',
      color: 'text-teal-600',
      bgColor: darkMode ? 'bg-teal-900/30' : 'bg-teal-100',
      showFor: ['pharmacy', 'pharmacist', 'assistant', null] // mindenki
    }
  ].filter(item => item.showFor.includes(pharmaRole));

  return (
    <RouteGuard>
      <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
            >
              <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
            </button>
            <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Értesítések</h1>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-auto text-[#6B46C1]" />}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Global Settings */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
            <div className={`px-4 py-2 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
              <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>
                Általános
              </h3>
            </div>
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {/* Push notification engedélyezés */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isPushSubscribed ? (darkMode ? 'bg-green-900/30' : 'bg-green-100') : (darkMode ? 'bg-gray-700' : 'bg-gray-100')}`}>
                    <Smartphone className={`w-5 h-5 ${isPushSubscribed ? 'text-green-600' : (darkMode ? 'text-gray-400' : 'text-gray-500')}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Push értesítések</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {isPushSubscribed ? 'Bekapcsolva ✓' : pushPermission === 'denied' ? 'Letiltva a böngészőben' : 'Nincs bekapcsolva'}
                    </p>
                  </div>
                </div>
                {!isPushSubscribed && pushPermission !== 'denied' ? (
                  <button
                    onClick={handleEnablePush}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Bekapcsolás
                  </button>
                ) : isPushSubscribed ? (
                  <button
                    onClick={handleDisablePush}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Kikapcsolás
                  </button>
                ) : (
                  <span className="text-red-500 text-xs">Böngésző tiltja</span>
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                    <Bell className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>App értesítések</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Értesítések az alkalmazásban</p>
                  </div>
                </div>
                <Toggle enabled={settings.pushEnabled} onToggle={() => handleToggle('pushEnabled')} />
              </div>
            </div>
          </div>

          {/* Notification Types */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
            <div className={`px-4 py-2 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
              <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>
                Értesítés típusok
              </h3>
            </div>
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {notificationTypes.map((item) => (
                <div key={item.key} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.bgColor}`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div>
                      <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                    </div>
                  </div>
                  <Toggle enabled={settings[item.key]} onToggle={() => handleToggle(item.key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Igény értesítés szűrők - csak helyettesítőknek */}
          {(pharmaRole === 'pharmacist' || pharmaRole === 'assistant') && settings.newDemand && (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
              <div className={`px-4 py-2 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
                <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>
                  Igény értesítés szűrők
                </h3>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Pozíció szűrő */}
                <div>
                  <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                    Milyen pozíciókról kapsz értesítést?
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-3`}>
                    Válaszd ki, milyen típusú igényekről szeretnél értesítést kapni
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePositionToggle('pharmacist')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        settings.demandPositions?.includes('pharmacist')
                          ? 'bg-purple-600 text-white'
                          : darkMode 
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Gyógyszerész
                    </button>
                    <button
                      onClick={() => handlePositionToggle('assistant')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        settings.demandPositions?.includes('assistant')
                          ? 'bg-purple-600 text-white'
                          : darkMode 
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Szakasszisztens
                    </button>
                  </div>
                </div>

                {/* Irányítószám szűrő */}
                <div className={`pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Irányítószám szűrő
                    </p>
                  </div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-3`}>
                    Add meg az irányítószámokat, amelyekről értesítést szeretnél kapni. Ha üres, minden területről kapsz értesítést.
                  </p>
                  
                  {/* Irányítószám hozzáadása */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newZipCode}
                      onChange={(e) => {
                        setNewZipCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setZipCodeError('');
                      }}
                      placeholder="Pl. 1013"
                      maxLength={4}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    />
                    <button
                      onClick={handleAddZipCode}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Hozzáad
                    </button>
                  </div>
                  
                  {zipCodeError && (
                    <p className="text-red-500 text-xs mb-2">{zipCodeError}</p>
                  )}
                  
                  {/* Mentett irányítószámok */}
                  {settings.demandZipCodes && settings.demandZipCodes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.demandZipCodes.map((zip) => (
                        <div
                          key={zip}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                            darkMode 
                              ? 'bg-purple-900/30 text-purple-300' 
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          <span>{zip}</span>
                          <button
                            onClick={() => handleRemoveZipCode(zip)}
                            className="ml-1 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Nincs irányítószám megadva - minden területről kapsz értesítést
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className={`${darkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-purple-200'} border rounded-xl p-4`}>
            <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              💡 A push értesítések működéséhez engedélyezd az értesítéseket a böngésző beállításaiban is.
            </p>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
