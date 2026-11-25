"use client";

import { motion } from "framer-motion";
import { TAPE_TAGS, type TapeTag } from "@/types/tape";

interface CassetteTapeProps {
  spinning: boolean;
  ejecting: boolean;
  progress: number; // 0.0 -> 1.0
  tag: TapeTag;
  durationLabel: string;
  subtitle?: string;
}

function TapeReel({
  spinning,
  spoolRadius,
}: {
  spinning: boolean;
  spoolRadius: number;
}) {
  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
      {/* Dark magnetic tape spool */}
      <div
        className="absolute rounded-full bg-tape-ribbon border border-amber-950/80 shadow-inner transition-all duration-300"
        style={{
          width: `${spoolRadius}%`,
          height: `${spoolRadius}%`,
        }}
      />

      {/* Rotating Geared Reel Hub */}
      <motion.svg
        viewBox="0 0 64 64"
        className="relative z-10 w-10 h-10 sm:w-12 sm:h-12"
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={
          spinning
            ? { repeat: Infinity, duration: 1.8, ease: "linear" }
            : { duration: 0.3 }
        }
      >
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="#f3efe0"
          stroke="#44403c"
          strokeWidth="2"
        />
        <circle cx="32" cy="32" r="14" fill="#1c1917" />
        {/* 6 Gear Teeth */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect
            key={deg}
            x="30"
            y="16"
            width="4"
            height="6"
            rx="1"
            fill="#f3efe0"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="6" fill="#080706" />
      </motion.svg>
    </div>
  );
}

export function CassetteTape({
  spinning,
  ejecting,
  progress,
  tag,
  durationLabel,
  subtitle,
}: CassetteTapeProps) {
  const tagMeta = TAPE_TAGS.find((t) => t.id === tag) ?? TAPE_TAGS[1];
  const clamped = Math.max(0, Math.min(1, progress));

  // Left spool shrinks from 94% -> 62%, Right spool grows from 62% -> 94%
  const leftSpool = 94 - clamped * 32;
  const rightSpool = 62 + clamped * 32;

  return (
    <motion.div
      initial={{ y: 0, opacity: 1, scale: 1 }}
      animate={
        ejecting
          ? { y: -48, opacity: 0, scale: 0.94, rotateX: 12 }
          : { y: 0, opacity: 1, scale: 1, rotateX: 0 }
      }
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative w-full max-w-[360px] mx-auto aspect-[1.58/1] rounded-xl bg-gradient-to-b from-stone-800 via-stone-900 to-stone-950 border border-stone-700/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_10px_25px_rgba(0,0,0,0.85)] p-3 sm:p-4 flex flex-col justify-between select-none overflow-hidden"
    >
      {/* 4 Metallic Corner Screws */}
      {[
        "top-2 left-2",
        "top-2 right-2",
        "bottom-2 left-2",
        "bottom-2 right-2",
      ].map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} w-2.5 h-2.5 rounded-full bg-stone-600 border border-stone-900 shadow-inner`}
        />
      ))}

      {/* Paper Sticker Label */}
      <div className="relative bg-sticker-parchment text-stone-900 rounded-md px-3 py-2 shadow-sm border border-amber-900/20">
        {/* Ruled lines & orange vintage stripe */}
        <div className="flex items-center justify-between border-b border-amber-800/25 pb-1 mb-1">
          <span className="font-hand text-base sm:text-lg font-bold text-stone-900 leading-none">
            {tagMeta.shortTag}
          </span>
          <span className="font-lcd text-sm text-amber-900 bg-amber-200/70 px-1.5 py-0.5 rounded">
            {durationLabel}
          </span>
        </div>
        <p className="font-hand text-xs sm:text-sm text-stone-700 truncate">
          {subtitle || tagMeta.label}
        </p>

        {/* Orange-Amber Cassette Stripe */}
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-red-700 opacity-85" />
      </div>

      {/* Transparent Tape Window */}
      <div className="relative my-auto mx-2 h-20 sm:h-24 rounded-lg bg-stone-950/90 border-2 border-stone-700/70 shadow-[inset_0_3px_10px_rgba(0,0,0,0.95)] flex items-center justify-between px-3 sm:px-5 overflow-hidden">
        {/* Magnetic ribbon bridge across bottom */}
        <div className="pointer-events-none absolute inset-x-10 bottom-3 h-1 bg-tape-ribbon/80" />

        <TapeReel spinning={spinning} spoolRadius={leftSpool} />

        {/* Center Tape Counter Window / Guides */}
        <div className="flex flex-col items-center gap-1 z-10">
          <div className="w-8 h-1 rounded-full bg-stone-700" />
          <div className="w-5 h-5 rounded-full border border-stone-700/80 bg-stone-900/80" />
        </div>

        <TapeReel spinning={spinning} spoolRadius={rightSpool} />
      </div>

      {/* Bottom Trapezoid Capstan Holes */}
      <div className="mx-auto w-3/4 h-4 bg-stone-950/80 border-t border-stone-700/60 rounded-t-md flex items-center justify-around px-4">
        <span className="w-2 h-2 rounded-full bg-stone-800 border border-stone-600" />
        <span className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-700" />
        <span className="w-2 h-2 rounded-full bg-stone-800 border border-stone-600" />
      </div>
    </motion.div>
  );
}
