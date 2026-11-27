"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudRain, Inbox, Volume2, VolumeX, X } from "lucide-react";
import { useTapeStore } from "@/store/useTapeStore";
import { soundEngine } from "@/lib/sound-engine";
import { initSession } from "@/lib/api-client";
import { RainyStreetCanvas } from "./RainyStreetCanvas";
import { CassetteDeck } from "@/components/cassette/CassetteDeck";

export function AmbientScene() {
  const {
    status,
    deckOpen,
    rainEnabled,
    rainVolume,
    hasUnreadReply,
    setMode,
    setDeckOpen,
    toggleRain,
    setRainVolume,
    setAudioUnlocked,
    setHasUnreadReply,
    triggerDoorEvent,
  } = useTapeStore();

  const [notificationText, setNotificationText] = useState<string | null>(null);
  const prevUnreadRef = useRef(false);
  const prevTeaCountRef = useRef<number | null>(null);
  const pollSeqRef = useRef(0);

  useEffect(() => {
    let active = true;

    const checkUpdates = async () => {
      const seq = ++pollSeqRef.current;
      const info = await initSession();
      if (!active || seq !== pollSeqRef.current || !info || !info.snapshotValid) {
        return;
      }

      setHasUnreadReply(info.hasUnreadReply);

      if (info.hasUnreadReply && !prevUnreadRef.current) {
        setNotificationText(
          "Một người lạ vừa ghé qua và gửi lời ủi an vào Hộp thư của bạn."
        );
        triggerDoorEvent();
      } else if (
        prevTeaCountRef.current !== null &&
        info.totalTeaCount > prevTeaCountRef.current
      ) {
        setNotificationText(
          "Có người lạ vừa lắng nghe và gửi tặng bạn một tách trà ấm."
        );
        triggerDoorEvent();
      }

      prevUnreadRef.current = info.hasUnreadReply;
      prevTeaCountRef.current = info.totalTeaCount;
    };

    void checkUpdates();

    const interval = setInterval(() => {
      void checkUpdates();
    }, 25000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkUpdates();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [setHasUnreadReply, triggerDoorEvent]);

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

  const handleToggleRain = async () => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    soundEngine.playToggleSwitch();
    toggleRain();
  };

  const handleCloseDeck = async () => {
    await soundEngine.unlock();
    soundEngine.playToggleSwitch();
    setDeckOpen(false);
  };

  const handleOpenMailboxFromAlert = async () => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    soundEngine.playPlayEngage();
    setNotificationText(null);
    setHasUnreadReply(false);
    setMode("MAILBOX");
    setDeckOpen(true);
  };

  const statusText =
    status === "RECORDING"
      ? "Đang thu âm câu chuyện vào cuộn băng..."
      : status === "PLAYING"
      ? "Đang phát cuộn băng trong màn đêm..."
      : "Chạm vào đài cassette hoặc cửa kính để tương tác";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#090b10] flex flex-col justify-between">
      {/* LAYER 1: Fullscreen Cinematic Rainy Bar Canvas */}
      <motion.div
        animate={deckOpen ? { scale: 1.035 } : { scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="fixed inset-0 z-0 origin-center"
      >
        <RainyStreetCanvas />
      </motion.div>

      {/* Cinematic Vignette Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, transparent 54%, rgba(4, 6, 10, 0.78) 100%)",
        }}
      />

      {/* Subtle Film Grain Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-10 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Backdrop Blur Overlay on Desktop when Foreground CassetteDeck is Open */}
      <AnimatePresence>
        {deckOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden md:block fixed inset-0 z-20 bg-black/45 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* Top Glassmorphic Status & Rain Ambience Controls */}
      <header className="relative z-30 w-full max-w-6xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-2 sm:gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-[#0e1118]/75 backdrop-blur-md border border-amber-400/20 rounded-2xl px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)] flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              status === "RECORDING"
                ? "bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse"
                : "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
            }`}
          />
          <div>
            <h1 className="text-xs sm:text-sm font-semibold tracking-wide text-amber-100">
              TIỆM BĂNG NỬA ĐÊM
            </h1>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              {statusText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          {/* Quick Mailbox Notification Pill */}
          {hasUnreadReply && (
            <button
              type="button"
              onClick={handleOpenMailboxFromAlert}
              aria-label="Có hồi âm mới — Mở Hộp thư"
              className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 rounded-2xl px-3 py-2.5 text-xs font-medium text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)] cursor-pointer transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <Inbox className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Có hồi âm mới</span>
            </button>
          )}

          {/* Rain Ambience Controls */}
          <div className="flex items-center gap-2.5 bg-[#0e1118]/75 backdrop-blur-md border border-amber-400/20 rounded-2xl px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)]">
            <button
              type="button"
              onClick={handleToggleRain}
              aria-label="Mưa đêm"
              aria-pressed={rainEnabled}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                rainEnabled
                  ? "text-amber-300"
                  : "text-stone-300 hover:text-amber-100"
              }`}
            >
              <CloudRain className="w-4 h-4" />
              <span className="hidden sm:inline">
                {rainEnabled ? "Đang phát tiếng mưa" : "Bật tiếng mưa"}
              </span>
            </button>

            {rainEnabled && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-stone-700/80">
                {rainVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-stone-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-amber-300/80" />
                )}
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={rainVolume}
                  onChange={(e) => setRainVolume(parseFloat(e.target.value))}
                  aria-label="Âm lượng mưa đêm"
                  className="w-16 sm:w-20 accent-amber-400 h-1 bg-stone-700 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Incoming Reply / Tea Toast Notification Banner */}
      <AnimatePresence>
        {notificationText && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md bg-[#0e1118]/90 backdrop-blur-md border border-amber-400/40 rounded-2xl px-4 py-3 shadow-[0_15px_35px_rgba(0,0,0,0.75)] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <p className="text-xs text-amber-100 leading-snug">
                {notificationText}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenMailboxFromAlert}
                className="px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-400/45 text-[11px] font-medium text-amber-200 hover:bg-amber-500/35 cursor-pointer"
              >
                Mở Hộp thư
              </button>
              <button
                type="button"
                onClick={() => setNotificationText(null)}
                aria-label="Đóng thông báo"
                className="p-1 text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN STAGE */}
      <main className="relative z-30 flex-1 flex flex-col items-center justify-center px-3 py-2 pointer-events-none">
        {/* Desktop Close-Up Foreground Cassette Deck (Layer 2) */}
        <AnimatePresence>
          {deckOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 22 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="hidden md:flex w-full flex-col items-center pointer-events-auto"
            >
              <div className="w-full max-w-[540px] flex justify-end mb-2">
                <button
                  type="button"
                  onClick={handleCloseDeck}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0e1118]/85 border border-stone-700/80 text-xs text-stone-300 hover:text-amber-300 hover:border-amber-400/45 transition-colors cursor-pointer backdrop-blur-md"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Đặt máy xuống quầy</span>
                </button>
              </div>
              <CassetteDeck />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Walkman POV (< 768px): Directly visible over lightweight rain-on-glass */}
        <div className="flex md:hidden w-full justify-center pointer-events-auto">
          <CassetteDeck />
        </div>
      </main>
    </div>
  );
}
