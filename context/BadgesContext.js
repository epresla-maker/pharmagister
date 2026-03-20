"use client";
import { createContext, useContext } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDashboardBadges } from '@/hooks/useDashboardBadges';

const BadgesContext = createContext({ badges: {}, refreshBadges: () => {} });

export function BadgesProvider({ children }) {
  const { user, userData } = useAuth();
  const { badges, refreshBadges } = useDashboardBadges(user, userData);

  return (
    <BadgesContext.Provider value={{ badges, refreshBadges }}>
      {children}
    </BadgesContext.Provider>
  );
}

export function useBadges() {
  return useContext(BadgesContext);
}
