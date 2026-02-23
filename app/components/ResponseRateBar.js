"use client";
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * ResponseRateBar – Visszajelző sáv a gyógyszertár 72 órán belüli válaszadási arányáról.
 *
 * Színskála:  piros (0–33%) → narancs (33–66%) → zöld (66–100%)
 * A kiszámolt %-ig színes, felette szürke.
 * Alatta: "X jelentkezőből" felirat.
 *
 * @param {{ pharmacyId: string }} props
 */
export default function ResponseRateBar({ pharmacyId }) {
  const [responseRate, setResponseRate] = useState(null);
  const [totalApplications, setTotalApplications] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pharmacyId) {
      setLoading(false);
      return;
    }

    const calculateRate = async () => {
      try {
        const applicationsRef = collection(db, 'pharmaApplications');
        const q = query(applicationsRef, where('pharmacyId', '==', pharmacyId));
        const snapshot = await getDocs(q);

        const now = new Date();
        const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;

        let eligibleCount = 0;
        let respondedWithin72h = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();

          // createdAt – lehet serverTimestamp (Timestamp) vagy ISO string
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date(data.createdAt);

          if (data.status === 'accepted' || data.status === 'rejected') {
            eligibleCount++;
            // A válasz idejét az updatedAt / acceptedAt alapján számoljuk
            const respondedAt = data.acceptedAt
              ? new Date(data.acceptedAt)
              : data.updatedAt?.toDate
              ? data.updatedAt.toDate()
              : new Date(data.updatedAt);

            if (respondedAt - createdAt <= SEVENTY_TWO_HOURS) {
              respondedWithin72h++;
            }
          } else if (data.status === 'pending') {
            // Még nem válaszolt – csak ha már eltelt 72 óra
            if (now - createdAt > SEVENTY_TWO_HOURS) {
              eligibleCount++;
              // Nem válaszolt időben → nem számít bele a pozitívba
            }
          }
        });

        const rate =
          eligibleCount > 0
            ? Math.round((respondedWithin72h / eligibleCount) * 100)
            : 100; // 0 jelentkező = alapból zöld (100%)

        setResponseRate(rate);
        setTotalApplications(eligibleCount);
      } catch (error) {
        console.error('Error calculating response rate:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateRate();
  }, [pharmacyId]);

  if (loading) return null;

  // ---- Méretek ----
  const BAR_WIDTH = 240; // ~30 karakter
  const BAR_HEIGHT = 18; // nagybetű magasság
  const filledWidth = (responseRate / 100) * BAR_WIDTH;

  // Egyszínű kitöltés a tartomány szerint
  const barColor = responseRate < 33 ? '#ef4444' : responseRate < 66 ? '#f97316' : '#22c55e';

  return (
    <div style={{ display: 'inline-block', marginTop: 4 }}>
      {/* Sáv */}
      <div
        style={{
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          border: '2px solid #000',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          background: '#d1d5db', // szürke (kitöltetlen rész)
        }}
      >
        {/* Kitöltött rész - egyetlen szín a %-ig */}
        {filledWidth > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: filledWidth,
              height: '100%',
              background: barColor,
            }}
          />
        )}

        {/* Százalék szöveg a sávon belül */}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 11,
            fontWeight: 700,
            color: '#000',
            textShadow: '0 0 3px rgba(255,255,255,0.8)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {responseRate}%
        </span>
      </div>

      {/* Felirat */}
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
        válaszadás határidőtartása
      </div>
    </div>
  );
}
