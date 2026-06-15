import { useState, useEffect } from "react";

// Tracks viewport size and orientation so layouts can switch between the desktop
// side-by-side board+sidebar and a stacked, touch-friendly mobile layout.
export function useViewport() {
  const read = () => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const [size, setSize] = useState(read);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSize(read()));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const { width, height } = size;
  // Stack when the screen is narrow OR taller than it is wide (phones/tablets in
  // portrait): a square board + a side panel does not fit a single row there.
  const isPortrait = height > width;
  const isCompact = width < 900 || isPortrait;
  const isPhone = width < 560;

  return { width, height, isPortrait, isCompact, isPhone };
}
