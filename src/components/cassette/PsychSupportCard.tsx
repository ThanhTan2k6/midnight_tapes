"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HeartHandshake, PhoneCall, Wind, X } from "lucide-react";
import type { RagSupportPayload } from "@/types/tape";

interface PsychSupportCardProps {
  payload: RagSupportPayload;
  onClose: () => void;
}

type BreathPhase = "HÍT VÀO (4s)" | "GIỮ HƠI (7s)" | "THỞ RA (8s)";

export function PsychSupportCard({ payload, onClose }: PsychSupportCardProps) {
  const [breathingActive, setBreathingActive] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>("HÍT VÀO (4s)");

  useEffect(() => {
    if (!breathingActive) return;

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed = (elapsed + 1) % 19; // 4 + 7 + 8 = 19s cycle
      if (elapsed < 4) {
        setPhase("HÍT VÀO (4s)");
      } else if (elapsed < 11) {
        setPhase("GIỮ HƠI (7s)");
      } else {
        setPhase("THỞ RA (8s)");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [breathingActive]);

  const circleScale = !breathingActive
    ? 1
    : phase === "HÍT VÀO (4s)"
    ? 1.35
    : phase === "GIỮ HƠI (7s)"
    ? 1.35
    : 0.92;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      className="w-full rounded-xl bg-sticker-parchment text-stone-900 border-2 border-amber-700/35 shadow-[0_18px_40px_rgba(0,0,0,0.75)] p-4 sm:p-5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2 border-b border-amber-900/20 pb-2">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-amber-800 shrink-0" />
          <h3 className="font-hand text-lg font-bold text-stone-900">
            Lá thư ủi an từ Gác Đêm
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng lá thư"
          className="text-stone-600 hover:text-stone-900 p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-line">
        {payload.letter}
      </p>

      {/* Interactive 4-7-8 Breathing Visualizer */}
      <div className="rounded-lg bg-amber-900/10 border border-amber-900/15 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: circleScale }}
            transition={{
              duration:
                phase === "HÍT VÀO (4s)" ? 4 : phase === "THỞ RA (8s)" ? 8 : 0.4,
              ease: "easeInOut",
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 shadow-[0_0_14px_rgba(217,119,6,0.45)] flex items-center justify-center shrink-0"
          >
            <Wind className="w-4 h-4 text-amber-50" />
          </motion.div>
          <div>
            <p className="text-xs font-semibold text-stone-900">
              Nhịp thở 4-7-8 dịu thần kinh
            </p>
            <p className="text-[11px] font-lcd tracking-wider text-amber-900">
              {breathingActive ? phase : "Bấm để bắt đầu 19 giây thư giãn"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setBreathingActive((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-amber-800 text-amber-50 text-xs font-medium hover:bg-amber-700 transition-colors cursor-pointer shrink-0"
        >
          {breathingActive ? "Tạm dừng" : "Thực hành thở"}
        </button>
      </div>

      {/* Verified Vietnam Mental Health Hotlines */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-stone-700">
          Tổng đài lắng nghe & hỗ trợ tâm lý miễn phí luôn trực bên bạn:
        </span>
        <div className="flex flex-wrap gap-2">
          {payload.hotlines.map((h) => (
            <a
              key={h.number}
              href={`tel:${h.number}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-900 text-amber-200 text-xs font-medium hover:bg-stone-800 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {h.name}: <strong>{h.number}</strong>
              </span>
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
