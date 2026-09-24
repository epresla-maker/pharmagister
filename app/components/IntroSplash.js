"use client";
import { useEffect, useRef, useState } from 'react';

const INTRO_DURATION_MS = 1800;
const FADE_MS = 300;

// Shows the Pharmagister intro video briefly when the app is first opened.
// Mounted once at the root (ClientProviders), so client-side navigation
// between pages does not re-trigger it - only a fresh app load does.
export default function IntroSplash() {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), INTRO_DURATION_MS);
    const hideTimer = setTimeout(() => setVisible(false), INTRO_DURATION_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    videoRef.current?.play?.().catch(() => {});
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#6B46C1] transition-opacity"
      style={{ opacity: fadingOut ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <video
        ref={videoRef}
        className="max-w-full max-h-full"
        src="/intro/pharmagister_intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
      />
    </div>
  );
}
