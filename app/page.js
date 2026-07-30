"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getEffectivePharmagisterRole } from '../lib/pharmagisterProfile';

export default function HomePage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  const pharmaRole = getEffectivePharmagisterRole(userData);
  const partnerAccountTypes = new Set(['partner_advertiser', 'partner_marketplace', 'partner_professional']);
  const normalizedAccountType = String(userData?.accountType || '').trim().toLowerCase();
  const isPartnerAccount = Boolean(
    userData?.partnerAdvertiser === true ||
      userData?.partnerProfessional === true ||
      partnerAccountTypes.has(normalizedAccountType)
  );

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (isPartnerAccount) {
        router.replace('/partner');
        return;
      }

      router.replace(pharmaRole ? '/kozosseg' : '/pharmagister');
    } else {
      router.replace('/login');
    }
  }, [user, pharmaRole, isPartnerAccount, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return null;
}
