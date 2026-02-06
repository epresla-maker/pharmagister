// context/AuthContext.js
"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut as authSignOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, "users", firebaseUser.uid);

        unsubscribeSnapshot = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data());
              // NE frissítsük itt a lastSeen-t - végtelen ciklust okoz!
            } else {
              setUserData(null);
            }
            setLoading(false); 
          },
          (error) => {
            setUserData(null);
            setLoading(false); 
          }
        );
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
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
