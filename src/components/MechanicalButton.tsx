"use client";

import React from "react";

interface MechanicalButtonProps {
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "rec" | "eject";
  onClick: () => void;
  ariaLabel?: string;
}

export function MechanicalButton({
  label,
  subLabel,
  icon,
  active = false,
  disabled = false,
  variant = "default",
  onClick,
  ariaLabel,
}: MechanicalButtonProps) {
  const baseColors =
    variant === "rec"
      ? "bg-gradient-to-b from-red-900/90 to-red-950 border-red-700/50 text-red-100"
      : variant === "eject"
      ? "bg-gradient-to-b from-stone-700 to-stone-800 border-amber-lamp/30 text-amber-100"
      : "bg-gradient-to-b from-stone-700 to-stone-800 border-stone-600/50 text-stone-200";

  const activeStyle = active
    ? "translate-y-[4px] shadow-[0_1px_0_#080706,inset_0_2px_6px_rgba(0,0,0,0.65)] ring-1 ring-amber-glow/40"
    : "shadow-[0_5px_0_#080706,0_7px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 active:translate-y-[4px] active:shadow-[0_1px_0_#080706,inset_0_2px_6px_rgba(0,0,0,0.65)]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel || label}
      aria-pressed={active}
      className={`
        group relative flex flex-col items-center justify-center
        min-w-[54px] sm:min-w-[68px] h-14 sm:h-16 px-2 rounded-md border
        transition-all duration-75 select-none
        ${baseColors}
        ${disabled ? "opacity-40 cursor-not-allowed shadow-[0_2px_0_#080706] translate-y-[2px]" : `cursor-pointer ${activeStyle}`}
      `}
    >
      {/* Top metallic bevel highlight */}
      <span className="pointer-events-none absolute inset-x-1 top-0.5 h-[1px] bg-white/15 rounded-full" />

      <div className="flex items-center justify-center mb-1">{icon}</div>
      <span className="font-lcd text-xs sm:text-sm tracking-widest uppercase leading-none">
        {label}
      </span>
      {subLabel && (
        <span className="text-[9px] text-stone-400 leading-none mt-0.5">
          {subLabel}
        </span>
      )}
    </button>
  );
}
