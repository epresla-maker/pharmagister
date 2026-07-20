"use client";

import { useState, useEffect } from "react";

// iOS-safe hook: tracks visualViewport height and offsetTop.
// When the keyboard opens on iOS, visualViewport.height shrinks.
// Using this to set the container height keeps the composer above the keyboard.
export default function useVisualViewport() {
  const [vp, setVp] = useState(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      setVp({ height: viewport.height, offsetTop: viewport.offsetTop });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return vp;
}
