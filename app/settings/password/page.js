"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { 
  ArrowLeft, 
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword 
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getClientMarket, t } from '@/lib/marketI18n';

export default function PasswordChangePage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { darkMode } = useTheme();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const market = getClientMarket();

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return { minLength, hasUpperCase, hasLowerCase, hasNumber };
  };

  const passwordValidation = validatePassword(newPassword);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!currentPassword) {
      setError(market === 'de' ? 'Bitte gib dein aktuelles Passwort ein.' : 'Add meg a jelenlegi jelszavad!');
      return;
    }
    
    if (!isPasswordValid) {
      setError(market === 'de' ? 'Das Passwort erfuellt die Anforderungen nicht.' : 'A jelszó nem felel meg a követelményeknek!');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError(market === 'de' ? 'Die beiden Passwoerter stimmen nicht ueberein.' : 'A két jelszó nem egyezik!');
      return;
    }

    setSaving(true);

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      
      // Record password activation in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        passwordActivated: true,
        passwordActivatedAt: serverTimestamp(),
        lastPasswordChange: serverTimestamp()
      });
      
      setSuccess(true);
      
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Redirect after success
      setTimeout(() => {
        router.push('/settings');
      }, 2000);
      
    } catch (err) {
      console.error('Password change error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(market === 'de' ? 'Falsches aktuelles Passwort.' : 'Hibás jelenlegi jelszó!');
      } else if (err.code === 'auth/too-many-requests') {
        setError(market === 'de' ? 'Zu viele Versuche. Bitte spaeter erneut versuchen.' : 'Túl sok próbálkozás. Kérjük, próbáld újra később!');
      } else {
        setError(market === 'de' ? 'Beim Aendern des Passworts ist ein Fehler aufgetreten. Bitte versuche es erneut.' : 'Hiba történt a jelszó módosítása során. Próbáld újra!');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
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
          <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {market === 'de' ? 'Passwort aendern' : 'Jelszó módosítása'}
          </h1>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* Success Message */}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-200 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-green-800 font-medium">{market === 'de' ? 'Passwort erfolgreich geaendert!' : 'Jelszó sikeresen módosítva!'}</p>
              <p className="text-green-600 text-sm">{market === 'de' ? 'Weiterleitung...' : 'Átirányítás...'}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Info Card */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 mb-4`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
              <Lock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {market === 'de' ? 'Neues Passwort festlegen' : 'Új jelszó beállítása'}
              </h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {market === 'de' ? 'Waehle ein starkes und sicheres Passwort' : 'Válassz egy erős, biztonságos jelszót'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 space-y-4`}>
          {/* Current Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {market === 'de' ? 'Aktuelles Passwort' : 'Jelenlegi jelszó'}
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {market === 'de' ? 'Neues Passwort' : 'Új jelszó'}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {/* Password Requirements */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className={`flex items-center gap-2 text-xs ${passwordValidation.minLength ? 'text-green-600' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {passwordValidation.minLength ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                  {market === 'de' ? 'Mindestens 8 Zeichen' : 'Legalább 8 karakter'}
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasUpperCase ? 'text-green-600' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {passwordValidation.hasUpperCase ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                  {market === 'de' ? 'Mindestens ein Grossbuchstabe' : 'Legalább egy nagybetű'}
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasLowerCase ? 'text-green-600' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {passwordValidation.hasLowerCase ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                  {market === 'de' ? 'Mindestens ein Kleinbuchstabe' : 'Legalább egy kisbetű'}
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasNumber ? 'text-green-600' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {passwordValidation.hasNumber ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border" />}
                  {market === 'de' ? 'Mindestens eine Zahl' : 'Legalább egy szám'}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {market === 'de' ? 'Neues Passwort bestaetigen' : 'Új jelszó megerősítése'}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{market === 'de' ? 'Die beiden Passwoerter stimmen nicht ueberein.' : 'A két jelszó nem egyezik!'}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving || !isPasswordValid || newPassword !== confirmPassword}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              saving || !isPasswordValid || newPassword !== confirmPassword
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {saving ? t('loadingSave', market) : (market === 'de' ? 'Passwort aendern' : 'Jelszó módosítása')}
          </button>
        </form>
      </div>
    </div>
  );
}
