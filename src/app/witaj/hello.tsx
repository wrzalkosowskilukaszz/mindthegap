"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";

const TEXT = "Hello Julia!";
const NEXT = "/kontakty";
const CONFETTI = ["#1fca8c", "#0e9a69", "#ffc542", "#ff7ab6", "#5b9dff", "#1fca8c", "#ffc542", "#ff7ab6"];

/**
 * "Hello Julia!" writes itself in a handwritten script: the outline is drawn left to right, the ink
 * fills in, a little confetti pops, then the app opens. Click anywhere (or press any key) to skip.
 * With reduced motion the greeting simply appears.
 */
export function Hello() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    router.prefetch(NEXT);
    let done = false;
    const start = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    // Wait for the handwriting font so the first stroke is drawn with the right letters.
    document.fonts?.load("700 150px 'Dancing Script Variable'").then(start, start);
    const fallback = setTimeout(start, 900);
    return () => clearTimeout(fallback);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const go = () => router.replace(NEXT);
    const t = setTimeout(go, reduced ? 1600 : 4200);
    window.addEventListener("keydown", go);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", go);
    };
  }, [ready, router]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: any key also skips (listener on window)
    <main
      className="hello"
      onClick={() => router.replace(NEXT)}
      style={{ visibility: ready ? "visible" : "hidden" }}
    >
      {ready ? (
        <div className="hello-inner">
          <svg viewBox="0 0 900 260" role="img" aria-label={TEXT}>
            <defs>
              <linearGradient id="hello-ink" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#0e9a69" />
                <stop offset="0.6" stopColor="#17b67d" />
                <stop offset="1" stopColor="#1fca8c" />
              </linearGradient>
              <linearGradient id="hello-edge" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0.85" stopColor="#fff" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id="hello-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="260">
                <rect className="hello-reveal" x="0" y="0" width="900" height="260" fill="url(#hello-edge)" />
              </mask>
            </defs>
            <g mask="url(#hello-mask)">
              <text x="450" y="185" textAnchor="middle" className="hello-text hello-fill">
                {TEXT}
              </text>
              <text x="450" y="185" textAnchor="middle" className="hello-text hello-stroke">
                {TEXT}
              </text>
            </g>
          </svg>
          <div className="hello-confetti" aria-hidden="true">
            {CONFETTI.concat(CONFETTI).map((c, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const dist = 170 + (i % 3) * 60;
              const style = {
                background: c,
                "--dx": `${Math.cos(angle) * dist}px`,
                "--dy": `${Math.sin(angle) * dist * 0.7}px`,
                "--rot": `${(i % 2 ? 1 : -1) * (120 + i * 25)}deg`,
                animationDelay: `${1.9 + (i % 4) * 0.05}s`,
              } as CSSProperties;
              return <i key={`${c}-${angle}`} style={style} />;
            })}
          </div>
          <p className="hello-sub">
            Miłego dnia <span className="hello-wave">👋</span>
          </p>
        </div>
      ) : null}
      <span className="hello-skip">Kliknij, aby przejść dalej</span>
    </main>
  );
}
