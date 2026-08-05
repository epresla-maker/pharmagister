"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import RouteGuard from '@/app/components/RouteGuard';
import { ArrowLeft, User, Phone, Mail, MapPin, Clock, Code, DollarSign, FileText, Shield, Loader2, Pencil, Flag, Ban, Star, ThumbsUp } from 'lucide-react';
import ReportModal from '@/app/components/ReportModal';
import BlockUserModal from '@/app/components/BlockUserModal';
import { getClientMarket } from '@/lib/marketI18n';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const market = getClientMarket();
  const userId = params.id;
  
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  // Load block status
  useEffect(() => {
    if (!user || !userId || user.uid === userId) return;
    const checkBlock = async () => {
      try {
        const blockDoc = await getDoc(doc(db, 'blockedUsers', `${user.uid}_${userId}`));
        setIsBlocked(blockDoc.exists());
      } catch (e) {}
    };
    checkBlock();
  }, [user, userId]);

  const loadProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setProfileData(userDoc.data());
      } else {
        alert(market === 'de' ? 'Benutzer nicht gefunden.' : 'A felhasználó nem található.');
        router.back();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      alert(market === 'de' ? 'Fehler beim Laden des Profils.' : 'Hiba történt az adatlap betöltése során.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Privacy beállítások ellenőrzése
  const canShow = (field) => {
    if (!profileData?.privacySettings?.substitute) return true; // Default: minden látható
    return profileData.privacySettings.substitute[field] !== false;
  };

  if (loading) {
    return (
      <RouteGuard>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </RouteGuard>
    );
  }

  if (!profileData) {
    return null;
  }

  const isSubstitute = profileData.pharmagisterRole === 'pharmacist' || profileData.pharmagisterRole === 'assistant' || profileData.pharmagisterRole === 'pka';
  const isProfileAdmin = profileData.email === 'epresla@icloud.com';
  const roleLabel = isProfileAdmin ? 'Admin' :
                    profileData.pharmagisterRole === 'pharmacist' ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') :
                    profileData.pharmagisterRole === 'assistant' ? (market === 'de' ? 'PTA' : 'Szakasszisztens') :
                    profileData.pharmagisterRole === 'pka' ? 'PKA' : (market === 'de' ? 'Apotheke' : 'Gyógyszertár');
  
  // Ellenőrizzük, hogy saját profilunkat nézzük-e
  const isOwnProfile = user?.uid === userId;

  return (
    <RouteGuard>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} pb-20`}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold">{isOwnProfile ? (market === 'de' ? 'Mein Profil' : 'Profilom') : (market === 'de' ? 'Profil' : 'Adatlap')}</h1>
            </div>
            
            {/* Szerkesztés gomb - csak saját profilnál */}
            {isOwnProfile ? (
              <button
                onClick={() => {
                  const isPartner = userData?.accountType === 'partner_marketplace' || userData?.accountType === 'partner_advertiser' || userData?.accountType === 'partner_professional' || userData?.partnerAdvertiser || userData?.partnerProfessional;
                  router.push(isPartner ? '/partner' : '/pharmagister/setup?edit=true');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  darkMode 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                }`}
              >
                <Pencil className="w-4 h-4" />
                {market === 'de' ? 'Bearbeiten' : 'Szerkesztés'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBlockModal(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode 
                      ? 'hover:bg-gray-700 text-orange-400' 
                      : 'hover:bg-gray-100 text-orange-600'
                  }`}
                  title={market === 'de' ? 'Benutzer blockieren' : 'Felhasználó letiltása'}
                >
                  <Ban className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode 
                      ? 'hover:bg-gray-700 text-red-400' 
                      : 'hover:bg-gray-100 text-red-600'
                  }`}
                  title={market === 'de' ? 'Melden' : 'Jelentés'}
                >
                  <Flag className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Profile Card */}
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm overflow-hidden`}>
            {/* Header with photo */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-32 relative">
              <div className="absolute -bottom-12 left-6">
                {profileData.photoURL ? (
                  <img
                    src={profileData.photoURL}
                    alt={profileData.displayName}
                    className="w-24 h-24 rounded-full border-4 border-white object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-300 flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="pt-16 px-6 pb-6">
              <div className="mb-4">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {profileData.displayName || (market === 'de' ? 'Unbekannt' : 'Névtelen')}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {roleLabel}
                  </span>
                  {profileData.pharmaApproved && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {market === 'de' ? 'Verifiziert' : 'Jóváhagyott'}
                    </span>
                  )}
                  {/* Értékelés megjelenítése helyettesítőknél */}
                  {isSubstitute && (
                    profileData.pharmaRating && profileData.pharmaRating.ratingCount >= 1 ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {profileData.pharmaRating.averageRating?.toFixed(1) || '-'}
                        {profileData.pharmaRating.wouldChooseAgainPercent >= 70 && (
                          <span className="ml-1 flex items-center gap-0.5">
                            <ThumbsUp className="w-3 h-3" />
                            {market === 'de' ? 'Empfohlen' : 'Ajánlott'}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className={`px-3 py-1 ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'} rounded-full text-sm flex items-center gap-1`}>
                        <Star className="w-3 h-3" />
                        {market === 'de' ? 'Noch keine Bewertung' : 'Még nem érkezett értékelés'}
                      </span>
                    )
                  )}
                </div>
              </div>

              {isSubstitute ? (
                // Helyettesítő adatok
                <div className="space-y-4">
                  {/* Elérhetőség */}
                  <div>
                    <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-3`}>
                      {market === 'de' ? 'Kontakt' : 'Elérhetőség'}
                    </h3>
                    <div className="space-y-3">
                      {canShow('shareEmail') ? (
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-blue-600" />
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                            {profileData.email || 'Nincs megadva'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 opacity-50">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <span className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Email nem nyilvános
                          </span>
                        </div>
                      )}

                      {canShow('sharePhone') ? (
                        profileData.phone ? (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-green-600" />
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                              {profileData.phone}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 opacity-50">
                            <Phone className="w-5 h-5 text-gray-400" />
                            <span className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              {market === 'de' ? 'Keine Telefonnummer angegeben' : 'Telefon nincs megadva'}
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-3 opacity-50">
                          <Phone className="w-5 h-5 text-gray-400" />
                          <span className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {market === 'de' ? 'Telefon nicht oeffentlich' : 'Telefon nem nyilvános'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Szakmai adatok */}
                  <div>
                    <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-3`}>
                      {market === 'de' ? 'Berufliche Daten' : 'Szakmai adatok'}
                    </h3>
                    <div className="space-y-3">
                      {canShow('shareExperience') && profileData.pharmaYearsOfExperience && (
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-orange-600" />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Erfahrung' : 'Tapasztalat'}</p>
                            <p className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                              {profileData.pharmaYearsOfExperience} {market === 'de' ? 'Jahre' : 'év'}
                            </p>
                          </div>
                        </div>
                      )}

                      {canShow('shareSoftwareKnowledge') && profileData.pharmaSoftwareKnowledge?.length > 0 && (
                        <div className="flex items-start gap-3">
                          <Code className="w-5 h-5 text-purple-600 mt-1" />
                          <div className="flex-1">
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>{market === 'de' ? 'Software-Kenntnisse' : 'Szoftverismeret'}</p>
                            <div className="flex flex-wrap gap-2">
                              {profileData.pharmaSoftwareKnowledge.map((software, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 ${darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'} rounded text-sm`}
                                >
                                  {software}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {canShow('shareHourlyRate') && profileData.pharmaHourlyRate && (
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-5 h-5 text-teal-600" />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Stundenlohn' : 'Órabér'}</p>
                            <p className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                              {profileData.pharmaHourlyRate} {market === 'de' ? 'EUR/Stunde' : 'Ft/óra'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bemutatkozás */}
                  {canShow('shareBio') && profileData.pharmaBio && (
                    <div>
                      <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-3`}>
                        {market === 'de' ? 'Vorstellung' : 'Bemutatkozás'}
                      </h3>
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-indigo-600 mt-1" />
                        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm leading-relaxed`}>
                          {profileData.pharmaBio}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Értékelések részletesen */}
                  <div>
                    <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-3`}>
                      {market === 'de' ? 'Bewertungen' : 'Értékelések'}
                    </h3>
                    {profileData.pharmaRating && profileData.pharmaRating.ratingCount >= 1 ? (
                      <div className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-4 space-y-3`}>
                        {/* Összesített értékelés */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                            <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {profileData.pharmaRating.averageRating?.toFixed(1) || '-'}
                            </span>
                            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>/ 5</span>
                          </div>
                          {profileData.pharmaRating.wouldChooseAgainPercent >= 70 && (
                            <div className="flex items-center gap-1 text-green-600">
                              <ThumbsUp className="w-4 h-4" />
                              <span className="text-sm font-medium">{market === 'de' ? 'Empfohlen' : 'Ajánlott'}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Részletes értékelések */}
                        <div className="space-y-2 pt-2 border-t border-gray-300/30">
                          {profileData.pharmaRating.ratings?.megbizhatas && (
                            <div className="flex items-center justify-between">
                              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{market === 'de' ? 'Zuverlaessigkeit' : 'Megbízhatóság'}</span>
                              <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(star => (
                                  <Star 
                                    key={star} 
                                    className={`w-3.5 h-3.5 ${
                                      star <= Math.round(profileData.pharmaRating.ratings.megbizhatas)
                                        ? 'fill-amber-500 text-amber-500'
                                        : darkMode ? 'text-gray-600' : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {profileData.pharmaRating.ratings?.szakmaiTudas && (
                            <div className="flex items-center justify-between">
                              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{market === 'de' ? 'Fachwissen' : 'Szakmai tudás'}</span>
                              <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(star => (
                                  <Star 
                                    key={star} 
                                    className={`w-3.5 h-3.5 ${
                                      star <= Math.round(profileData.pharmaRating.ratings.szakmaiTudas)
                                        ? 'fill-amber-500 text-amber-500'
                                        : darkMode ? 'text-gray-600' : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {profileData.pharmaRating.ratings?.kommunikacio && (
                            <div className="flex items-center justify-between">
                              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{market === 'de' ? 'Kommunikation' : 'Kommunikáció'}</span>
                              <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(star => (
                                  <Star 
                                    key={star} 
                                    className={`w-3.5 h-3.5 ${
                                      star <= Math.round(profileData.pharmaRating.ratings.kommunikacio)
                                        ? 'fill-amber-500 text-amber-500'
                                        : darkMode ? 'text-gray-600' : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Újra választaná százalék */}
                        {profileData.pharmaRating.wouldChooseAgainPercent !== undefined && (
                          <div className={`pt-2 border-t border-gray-300/30 text-center`}>
                            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {market === 'de'
                                ? <> <span className="font-semibold text-green-600">{profileData.pharmaRating.wouldChooseAgainPercent}%</span> der Apotheken wuerden diese Person wieder waehlen</>
                                : <>A gyógyszertárak <span className="font-semibold text-green-600">{profileData.pharmaRating.wouldChooseAgainPercent}%</span>-a újra választaná</>}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-lg p-4 flex items-center gap-2`}>
                        <Star className={`w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {market === 'de' ? 'Noch keine Bewertung' : 'Még nem érkezett értékelés'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Gyógyszertár adatok
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-3`}>
                      {market === 'de' ? 'Apothekendaten' : 'Gyógyszertár adatok'}
                    </h3>
                    <div className="space-y-3">
                      {profileData.pharmacyName && (
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                              {profileData.pharmacyName}
                            </p>
                            {(profileData.pharmacyCity || profileData.pharmacyStreet) && (
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {profileData.pharmacyZipCode} {profileData.pharmacyCity}, {profileData.pharmacyStreet} {profileData.pharmacyHouseNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {profileData.pharmacyPhone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-green-600" />
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                            {profileData.pharmacyPhone}
                          </span>
                        </div>
                      )}

                      {profileData.pharmacyEmail && (
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-blue-600" />
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                            {profileData.pharmacyEmail}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-start gap-2">
                  <Shield className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`} />
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {market === 'de' ? 'Die Daten werden gemaess Datenschutzeinstellungen angezeigt.' : 'Az adatok az adatvédelmi beállításoknak megfelelően jelennek meg.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportType="user"
          reportedUserId={userId}
          reportedUserName={profileData?.displayName || profileData?.name}
        />

        {/* Block Modal */}
        <BlockUserModal
          isOpen={showBlockModal}
          onClose={() => setShowBlockModal(false)}
          targetUserId={userId}
          targetUserName={profileData?.displayName || profileData?.name}
          isCurrentlyBlocked={isBlocked}
          onBlockChange={setIsBlocked}
        />
      </div>
    </RouteGuard>
  );
}
