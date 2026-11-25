"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudRain, Volume2, VolumeX } from "lucide-react";
import { useTapeStore } from "@/store/useTapeStore";
import { soundEngine } from "@/lib/sound-engine";

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface DustMote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
}

export function AmbientDesk({ children }: { children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [guestSeated, setGuestSeated] = useState(false);

  const {
    rainEnabled,
    rainVolume,
    toggleRain,
    setRainVolume,
    setAudioUnlocked,
  } = useTapeStore();

  // Trigger ambient stranger walking in to sit & drink coffee shortly after entering
  useEffect(() => {
    const timer = setTimeout(() => {
      setGuestSeated(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Sync Rain MP3 with store
  useEffect(() => {
    if (rainEnabled) {
      soundEngine.startRain(rainVolume);
    } else {
      soundEngine.stopRain();
    }
  }, [rainEnabled, rainVolume]);

  useEffect(() => {
    soundEngine.setRainVolume(rainVolume);
  }, [rainVolume]);

  useEffect(() => {
    return () => {
      soundEngine.stopRain();
    };
  }, []);

  // Canvas: Rain streaks outside cafe window + warm dust motes inside
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let animId = 0;
    const drops: RainDrop[] = [];
    const motes: DustMote[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 65; i++) {
      drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: Math.random() * 18 + 10,
        speed: Math.random() * 6 + 7,
        alpha: Math.random() * 0.14 + 0.04,
      });
    }

    for (let i = 0; i < 28; i++) {
      motes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.5,
        vx: (Math.random() - 0.35) * 0.2,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.3 + 0.08,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rain streaks outside window (more visible when rain is enabled)
      const rainOpacityMultiplier = rainEnabled ? 1.5 : 0.45;
      ctx.lineWidth = 1;
      for (const d of drops) {
        d.x -= 1.2;
        d.y += d.speed;
        if (d.y > canvas.height) {
          d.y = -d.len;
          d.x = Math.random() * (canvas.width + 120);
        }

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2.5, d.y + d.len);
        ctx.strokeStyle = `rgba(254, 243, 199, ${d.alpha * rainOpacityMultiplier})`;
        ctx.stroke();
      }

      // Floating warm dust motes inside cafe
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < 0) m.x = canvas.width;
        if (m.x > canvas.width) m.x = 0;
        if (m.y < 0) m.y = canvas.height;
        if (m.y > canvas.height) m.y = 0;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${m.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [rainEnabled]);

  const handleToggleRain = async () => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    soundEngine.playToggleSwitch();
    toggleRain();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-midnight-void flex flex-col justify-between">
      {/* Cafe Night Interior & Rainy Window Bokeh Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(circle at 16% 14%, rgba(245, 158, 11, 0.24) 0%, rgba(217, 119, 6, 0.09) 30%, rgba(16, 13, 11, 0.94) 64%, #080706 100%),
            radial-gradient(circle at 82% 24%, rgba(239, 68, 68, 0.08) 0%, transparent 25%),
            radial-gradient(circle at 72% 18%, rgba(245, 158, 11, 0.1) 0%, transparent 22%),
            repeating-linear-gradient(92deg, rgba(41, 35, 30, 0.14) 0px, rgba(41, 35, 30, 0.14) 2px, transparent 2px, transparent 22px)
          `,
        }}
      />

      {/* Cafe Window Mullions (subtle background frame) */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden md:block fixed inset-x-0 top-0 h-[55vh] z-0 opacity-20 border-b border-amber-lamp/20"
      >
        <div className="w-full h-full max-w-6xl mx-auto border-x border-amber-lamp/15 flex justify-between">
          <div className="w-1/3 border-r border-amber-lamp/10 h-full" />
          <div className="w-1/3 border-l border-amber-lamp/10 h-full" />
        </div>
      </div>

      {/* Rain Streaks & Warm Dust Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-10 opacity-80"
      />

      {/* Top Header with Warm Yellow Neon Sign */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 pt-4 pb-2 flex items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col">
          {/* Warm Yellow Neon Sign */}
          <div className="inline-flex items-center gap-2.5">
            <h1
              className="font-hand text-2xl sm:text-3xl text-amber-300 tracking-wide"
              style={{
                textShadow:
                  "0 0 8px rgba(245, 158, 11, 0.75), 0 0 22px rgba(217, 119, 6, 0.45)",
              }}
            >
              Tiệm Băng Nửa Đêm
            </h1>
            <span
              className="hidden sm:inline-block px-2 py-0.5 rounded border border-amber-400/60 text-[10px] font-lcd tracking-widest text-amber-300 uppercase"
              style={{
                boxShadow:
                  "0 0 10px rgba(245, 158, 11, 0.35), inset 0 0 6px rgba(245, 158, 11, 0.25)",
              }}
            >
              OPEN 24H
            </span>
          </div>
          <p className="text-xs sm:text-sm text-amber-200/60 mt-0.5">
            Quán nhỏ đêm mưa • Thả nỗi buồn vào cuộn băng, nghe người lạ ủi an.
          </p>
        </div>

        {/* Rain Ambience Controls */}
        <div className="flex items-center gap-2.5 bg-wood-desk-base/90 border border-amber-lamp/30 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-sm shrink-0">
          <button
            type="button"
            onClick={handleToggleRain}
            aria-label="Mưa đêm"
            aria-pressed={rainEnabled}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
              rainEnabled
                ? "text-amber-glow"
                : "text-stone-400 hover:text-tea-steam"
            }`}
          >
            <CloudRain className="w-4 h-4" />
            <span className="hidden sm:inline">
              {rainEnabled ? "Mưa đêm: Bật" : "Mưa đêm: Tắt"}
            </span>
          </button>

          {rainEnabled && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-stone-700/80">
              {rainVolume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-stone-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-glow/80" />
              )}
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={rainVolume}
                onChange={(e) => setRainVolume(parseFloat(e.target.value))}
                aria-label="Âm lượng mưa đêm"
                className="w-16 sm:w-20 accent-amber-500 h-1 bg-stone-700 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Cafe Stage: Anonymous Guest Silhouette (Left) + Cassette Deck (Center) + Coffee Cup (Right) */}
      <main className="relative z-20 flex-1 flex items-center justify-center px-3 py-4 sm:py-6">
        <div className="relative w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10">
          {/* Left Corner Table: Anonymous Rainy-Night Guest Silhouette (Desktop POV) */}
          <aside
            aria-label="Góc bàn người lạ ghé quán"
            className="hidden xl:flex flex-col items-center justify-end self-end pb-6 w-48 select-none"
          >
            <div className="relative w-44 h-44 flex flex-col items-center justify-end">
              {/* Warm corner table lamp glow */}
              <div className="absolute top-6 right-4 w-24 h-24 rounded-full bg-amber-glow/15 blur-xl" />

              {/* Animated Silhouette of Stranger Walking In & Sipping Coffee */}
              <AnimatePresence>
                {guestSeated && (
                  <motion.div
                    initial={{ opacity: 0, x: -45 }}
                    animate={{ opacity: 0.72, x: 0 }}
                    transition={{ duration: 1.8, ease: "easeOut" }}
                    className="relative z-10 flex items-end gap-2"
                  >
                    {/* Minimalist Stranger Silhouette SVG */}
                    <svg
                      viewBox="0 0 80 100"
                      className="w-20 h-24 text-stone-900 drop-shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                      aria-hidden="true"
                    >
                      {/* Head */}
                      <circle cx="34" cy="24" r="11" fill="currentColor" />
                      {/* Shoulders & Coat */}
                      <path
                        d="M14 78 C14 48, 22 40, 34 40 C46 40, 54 48, 56 78 Z"
                        fill="currentColor"
                      />
                      {/* Arm lifting coffee cup */}
                      <motion.path
                        d="M44 52 L60 44 L58 50 L44 58 Z"
                        fill="currentColor"
                        animate={{ rotate: [0, -6, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 5,
                          ease: "easeInOut",
                          repeatDelay: 2,
                        }}
                        style={{ originX: "44px", originY: "54px" }}
                      />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Corner Wooden Cafe Table */}
              <div className="w-36 h-2 rounded-full bg-stone-800/90 border-t border-amber-lamp/25 shadow-lg z-20" />
              <div className="w-2 h-10 bg-stone-900/90 z-10" />
            </div>

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: guestSeated ? 0.7 : 0 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="mt-2 text-center text-[11px] font-hand text-amber-200/55 leading-snug"
            >
              Có người lạ vừa ghé tiệm
              <br />
              uống cà phê tránh mưa...
            </motion.span>
          </aside>

          {/* Center: Skeuomorphic Cassette Deck */}
          {children}

          {/* Right: Steaming Ceramic Coffee/Tea Cup (Desktop POV) */}
          <aside
            aria-label="Tách cà phê nóng trên bàn"
            className="hidden xl:flex flex-col items-center justify-end self-end pb-6 w-36 select-none"
          >
            <div className="relative w-24 h-28 flex flex-col items-center justify-end">
              {/* Animated Steam Wisps */}
              <div className="flex gap-2 mb-1 opacity-70">
                <span
                  className="w-1.5 h-7 rounded-full bg-gradient-to-t from-tea-steam/35 to-transparent blur-[2px] animate-bounce"
                  style={{ animationDuration: "3.2s" }}
                />
                <span
                  className="w-2 h-10 rounded-full bg-gradient-to-t from-tea-steam/40 to-transparent blur-[3px] animate-bounce"
                  style={{ animationDuration: "2.6s", animationDelay: "0.5s" }}
                />
                <span
                  className="w-1.5 h-6 rounded-full bg-gradient-to-t from-tea-steam/30 to-transparent blur-[2px] animate-bounce"
                  style={{ animationDuration: "3.8s", animationDelay: "1s" }}
                />
              </div>

              {/* Cup Body */}
              <div className="relative w-16 h-14 rounded-b-2xl rounded-t-sm bg-gradient-to-b from-stone-700 via-stone-800 to-stone-900 border border-amber-lamp/20 shadow-[0_12px_25px_rgba(0,0,0,0.85)] flex items-start justify-center overflow-hidden">
                <div className="w-14 h-2.5 mt-1 rounded-full bg-gradient-to-r from-amber-950 via-amber-700/80 to-amber-950 opacity-90" />
              </div>
              <div className="absolute right-1.5 bottom-4 w-4 h-7 rounded-r-full border-2 border-stone-700 border-l-0" />
              <div className="w-22 h-2.5 -mt-1 rounded-full bg-gradient-to-r from-stone-900 via-stone-700 to-stone-900 border-t border-stone-600/40 shadow-md" />
            </div>
            <span className="mt-2 text-[11px] font-hand text-amber-200/45 tracking-wider">
              Cà phê sữa nóng
            </span>
          </aside>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="relative z-20 text-center pb-4 px-4 text-[11px] text-stone-500">
        Ẩn danh hoàn toàn • Không chat qua lại • Mọi cuộn băng tự tan biến sau 24 giờ
      </footer>
    </div>
  );
}
