// context/AuthContext.js
"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut as authSignOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { MARKET_COOKIE, normalizeMarket } from "@/lib/market";

const MARKET_OVERRIDE_ADMIN_EMAILS = new Set(['epresla@icloud.com']);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const applyUserDoc = (nextUserData, firebaseUser) => {
      setUserData(nextUserData);
      const normalizedEmail = String(nextUserData?.email || firebaseUser?.email || '').trim().toLowerCase();
      const cookieMatch = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|; )pm_market=([^;]+)/)
        : null;
      const cookieMarket = cookieMatch?.[1] ? normalizeMarket(decodeURIComponent(cookieMatch[1])) : null;
      const normalizedMarket = MARKET_OVERRIDE_ADMIN_EMAILS.has(normalizedEmail)
        ? (cookieMarket || normalizeMarket(nextUserData?.market))
        : normalizeMarket(nextUserData?.market);
      document.cookie = `${MARKET_COOKIE}=${normalizedMarket}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {

      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            applyUserDoc(userSnap.data(), firebaseUser);
          } else {
            setUserData(null);
          }
        } catch (error) {
          console.error('AuthContext getDoc failed:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // LastSeen és lastLogin frissítés
  // FONTOS: Csak user.uid-tól függ, NEM userData-tól (különben végtelen ciklus!)
  useEffect(() => {
    if (!user?.uid) return;

    // Első frissítés amikor megnyitja az oldalt (lastLogin is!)
    const userDocRef = doc(db, "users", user.uid);
    updateDoc(userDocRef, {
      lastSeen: serverTimestamp(),
      lastLogin: serverTimestamp() // Ez növeli a belépés statisztikát
    }).catch(() => {});

    // LastSeen frissítés 10 percenként (de lastLogin csak egyszer, oldal megnyitáskor)
    const interval = setInterval(() => {
      updateDoc(userDocRef, {
        lastSeen: serverTimestamp()
      }).catch(() => {});
    }, 600000); // 10 perc (600000ms)

    return () => clearInterval(interval);
  }, [user?.uid]); // ← Csak user.uid, NEM userData!

  const signOut = async () => {
    try {
      await authSignOut(auth);
    } catch (error) {
      // Silent fail
    }
  };

  const value = { user, userData, loading, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
