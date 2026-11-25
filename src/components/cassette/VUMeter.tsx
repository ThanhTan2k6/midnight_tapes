"use client";

import { useEffect, useState } from "react";

interface VUMeterProps {
  active: boolean;
  mode: "RECORD" | "LISTEN";
  /** Real-time audio amplitude (0.0 -> 1.0) from AnalyserNode */
  level?: number;
}

export function VUMeter({ active, mode, level }: VUMeterProps) {
  const [simAngle, setSimAngle] = useState(-42);

  useEffect(() => {
    if (!active || level !== undefined) return;

    const interval = setInterval(() => {
      const base = mode === "RECORD" ? -12 : -8;
      const swing = (Math.random() - 0.35) * 38;
      const next = Math.max(-38, Math.min(34, base + swing));
      setSimAngle(next);
    }, 130);

    return () => clearInterval(interval);
  }, [active, mode, level]);

  const displayAngle = !active
    ? -42
    : level !== undefined
    ? -42 + Math.min(1, Math.max(0, level)) * 76
    : simAngle;

  return (
    <div
      aria-label="Đồng hồ VU"
      className="relative w-28 sm:w-32 h-14 rounded bg-gradient-to-b from-amber-950/90 via-amber-900/60 to-stone-950 border border-stone-700/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)] overflow-hidden select-none"
    >
      {/* Warm backlight glow */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          active ? "opacity-90" : "opacity-35"
        }`}
        style={{
          background:
            "radial-gradient(circle at 50% 95%, rgba(245, 158, 11, 0.38), transparent 72%)",
        }}
      />

      {/* Scale Arc & Markings */}
      <svg
        viewBox="0 0 120 60"
        className="relative z-10 w-full h-full"
        aria-hidden="true"
      >
        <path
          d="M 18 46 A 48 48 0 0 1 82 22"
          fill="none"
          stroke="#fcd34d"
          strokeWidth="1.2"
          strokeOpacity="0.65"
        />
        <path
          d="M 82 22 A 48 48 0 0 1 102 46"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.8"
          strokeOpacity="0.85"
        />
        <text x="16" y="34" fill="#fde68a" fontSize="6" fontFamily="monospace">
          -20
        </text>
        <text x="54" y="18" fill="#fde68a" fontSize="6" fontFamily="monospace">
          0
        </text>
        <text x="95" y="34" fill="#fca5a5" fontSize="6" fontFamily="monospace">
          +3
        </text>
        <text
          x="52"
          y="36"
          fill="#d97706"
          fontSize="7"
          fontWeight="bold"
          fontFamily="sans-serif"
          opacity="0.7"
        >
          VU
        </text>
      </svg>

      {/* Swinging Needle */}
      <div
        className="absolute bottom-[-6px] left-1/2 w-[1.5px] h-11 bg-red-400 origin-bottom transition-transform duration-75 ease-out z-20 shadow-[0_0_4px_rgba(248,113,113,0.7)]"
        style={{
          transform: `translateX(-50%) rotate(${displayAngle}deg)`,
        }}
      />

      {/* Pivot Cap */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-stone-800 border border-stone-600 z-30" />
    </div>
  );
}
