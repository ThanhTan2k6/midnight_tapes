"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bug,
  CloudRain,
  Disc3,
  Inbox,
  Info,
  Mic,
  Send,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useTapeStore } from "@/store/useTapeStore";
import { soundEngine } from "@/lib/sound-engine";
import { initSession } from "@/lib/api-client";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
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
  const [onlineCount, setOnlineCount] = useState(1);
  const [activeTapesCount, setActiveTapesCount] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<
    "BUG_AUDIO_UI" | "BUG_RECORD_PLAY" | "SUGGESTION"
  >("BUG_AUDIO_UI");
  const [reportMessage, setReportMessage] = useState("");
  const [reportContact, setReportContact] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const prevUnreadRef = useRef(false);
  const prevTeaCountRef = useRef<number | null>(null);
  const pollSeqRef = useRef(0);

  // 1. Supabase Realtime Presence: detect real visitors entering in another tab/device
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const myKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest-${Math.random().toString(36).slice(2)}`;

    let initialSynced = false;
    const channel = supabase.channel("midnight-cafe-room", {
      config: { presence: { key: myKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Math.max(1, Object.keys(state).length);
        setOnlineCount(count);
        initialSynced = true;
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (!initialSynced || key === myKey) return;
        triggerDoorEvent();
        soundEngine.playDoorBell();
        setNotificationText("Có người lạ vừa đẩy cửa kính bước vào tiệm...");
        setTimeout(() => {
          setNotificationText((prev) =>
            prev === "Có người lạ vừa đẩy cửa kính bước vào tiệm..."
              ? null
              : prev
          );
        }, 4200);
      })
      .subscribe(async (subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          await channel.track({ joinedAt: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [triggerDoorEvent]);

  // 2. Poll mailbox + live active tapes stats every 25s & on tab focus
  useEffect(() => {
    let active = true;

    const checkUpdates = async () => {
      const seq = ++pollSeqRef.current;

      const [info, statsRes] = await Promise.all([
        initSession(),
        fetch("/api/v1/stats", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (!active || seq !== pollSeqRef.current) return;

      if (statsRes && typeof statsRes.activeTapes === "number") {
        setActiveTapesCount(statsRes.activeTapes);
      }

      if (!info || !info.snapshotValid) return;

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

  // 3. Midnight Rain Ambience (Auto-start + unlock on first user gesture)
  useEffect(() => {
    let cleanupGestureListener: (() => void) | null = null;

    if (rainEnabled) {
      const attachGestureListeners = () => {
        if (cleanupGestureListener) return;
        const resumeOnGesture = () => {
          if (!useTapeStore.getState().rainEnabled) {
            cleanupGestureListener?.();
            cleanupGestureListener = null;
            return;
          }
          // Call startRain synchronously inside touchend/click/keydown for iOS Safari & mobile WebViews
          void soundEngine.unlock();
          soundEngine.startRain(
            useTapeStore.getState().rainVolume,
            undefined,
            () => {
              setAudioUnlocked(true);
              cleanupGestureListener?.();
              cleanupGestureListener = null;
            }
          );
        };

        window.addEventListener("touchend", resumeOnGesture, { passive: true });
        window.addEventListener("click", resumeOnGesture, { passive: true });
        window.addEventListener("keydown", resumeOnGesture);
        cleanupGestureListener = () => {
          window.removeEventListener("touchend", resumeOnGesture);
          window.removeEventListener("click", resumeOnGesture);
          window.removeEventListener("keydown", resumeOnGesture);
        };
      };

      soundEngine.startRain(
        rainVolume,
        attachGestureListeners,
        () => setAudioUnlocked(true)
      );
    } else {
      soundEngine.stopRain();
    }

    return () => {
      cleanupGestureListener?.();
    };
  }, [rainEnabled, rainVolume, setAudioUnlocked]);

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

  const handleOpenListenFromStats = async () => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    soundEngine.playPlayEngage();
    setMode("LISTEN");
    setDeckOpen(true);
  };

  const handleOpenDeckMode = async (targetMode: "RECORD" | "LISTEN") => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    soundEngine.playPlayEngage();
    setMode(targetMode);
    setDeckOpen(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reportMessage.trim();
    if (trimmed.length < 5) {
      setReportStatus({
        type: "err",
        text: "Vui lòng mô tả ngắn gọn (tối thiểu 5 ký tự).",
      });
      return;
    }
    setReportSubmitting(true);
    setReportStatus(null);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: reportCategory,
          message: trimmed,
          contact: reportContact.trim(),
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setReportStatus({
          type: "err",
          text: json.error || "Không thể gửi phản hồi lúc này.",
        });
      } else {
        setReportStatus({
          type: "ok",
          text: json.message || "Đã gửi phản hồi thành công!",
        });
        setReportMessage("");
        setReportContact("");
      }
    } catch {
      setReportStatus({
        type: "err",
        text: "Mất kết nối máy chủ, bạn thử lại sau nhé.",
      });
    } finally {
      setReportSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (reportOpen) {
        setReportOpen(false);
      } else if (infoOpen) {
        setInfoOpen(false);
      } else if (deckOpen) {
        soundEngine.playToggleSwitch();
        setDeckOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reportOpen, infoOpen, deckOpen, setDeckOpen]);

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

      {/* Backdrop Blur Overlay when Foreground CassetteDeck is Open */}
      <AnimatePresence>
        {deckOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-20 bg-black/45 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* Top Glassmorphic Status, Live Counter & Rain Controls */}
      <AnimatePresence>
        {!deckOpen && (
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="relative z-30 w-full max-w-6xl mx-auto px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 pointer-events-none"
          >
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="bg-[#0e1118]/75 backdrop-blur-md border border-amber-400/20 rounded-2xl px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)] flex items-center gap-3">
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

          {/* Live Presence & Active Tapes Counter Pill */}
          <button
            type="button"
            onClick={handleOpenListenFromStats}
            aria-label="Thống kê người đang trong tiệm và số cuộn băng đang trôi"
            className="bg-[#0e1118]/75 hover:bg-[#151a24]/85 backdrop-blur-md border border-amber-400/20 hover:border-amber-400/45 rounded-2xl px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)] flex items-center gap-3 text-xs text-stone-300 cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                <strong>{onlineCount}</strong> đang trong tiệm
              </span>
            </span>
            <span className="text-stone-600">•</span>
            <span className="inline-flex items-center gap-1.5 text-amber-200">
              <Disc3 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong>{activeTapesCount}</strong> cuộn băng đang trôi
              </span>
            </span>
          </button>
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

          {/* Guide & License Info Button */}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="Hướng dẫn sử dụng và thông tin giấy phép"
            title="Hướng dẫn & Quyền riêng tư"
            className="bg-[#0e1118]/75 hover:bg-[#151a24]/85 backdrop-blur-md border border-amber-400/20 hover:border-amber-400/45 rounded-2xl p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)] text-stone-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Bug Report & Feedback Button */}
          <button
            type="button"
            onClick={() => {
              setReportStatus(null);
              setReportOpen(true);
            }}
            aria-label="Báo lỗi hoặc góp ý"
            title="Báo lỗi / Góp ý"
            className="bg-[#0e1118]/75 hover:bg-[#151a24]/85 backdrop-blur-md border border-amber-400/20 hover:border-amber-400/45 rounded-2xl p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)] text-stone-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <Bug className="w-4 h-4" />
          </button>
        </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Incoming Visitor / Reply / Tea Toast Notification Banner */}
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
              {notificationText.includes("Hộp thư") ||
              notificationText.includes("tách trà") ? (
                <button
                  type="button"
                  onClick={handleOpenMailboxFromAlert}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-400/45 text-[11px] font-medium text-amber-200 hover:bg-amber-500/35 cursor-pointer"
                >
                  Mở Hộp thư
                </button>
              ) : null}
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
        {/* Close-Up Foreground Cassette Deck (Layer 2) — Mobile & Desktop */}
        <AnimatePresence>
          {deckOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 22 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex w-full flex-col items-center pointer-events-auto"
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

        {/* Dual Primary CTAs at bottom when viewing outside rainy cafe scene */}
        {!deckOpen && (
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 flex items-center justify-center gap-2.5 sm:gap-3 px-4 pointer-events-auto">
            <button
              type="button"
              onClick={() => void handleOpenDeckMode("RECORD")}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-amber-500/90 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-semibold shadow-[0_12px_32px_rgba(245,158,11,0.35)] cursor-pointer active:scale-95 transition-all"
            >
              <Mic className="w-4 h-4" />
              <span>Thu cuộn băng mới</span>
            </button>
            <button
              type="button"
              onClick={() => void handleOpenDeckMode("LISTEN")}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-[#0e1118]/85 hover:bg-[#171c27]/95 border border-amber-400/40 text-amber-200 text-xs sm:text-sm font-medium shadow-[0_12px_32px_rgba(0,0,0,0.75)] backdrop-blur-md cursor-pointer active:scale-95 transition-all"
            >
              <Disc3 className="w-4 h-4 text-amber-400" />
              <span>Nhặt băng nghe thử</span>
            </button>
          </div>
        )}
      </main>

      {/* Guide, Privacy & License Modal */}
      <AnimatePresence>
        {infoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInfoOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-[#10131b]/95 border border-amber-400/25 p-5 text-stone-200 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-amber-200">
                    TIỆM BĂNG NỬA ĐÊM — HƯỚNG DẪN &amp; QUY ĐỊNH
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    Góc trú mưa ẩn danh bằng giọng nói
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  aria-label="Đóng hướng dẫn"
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <section className="flex flex-col gap-1.5 text-xs text-stone-300 leading-relaxed">
                <h3 className="font-semibold text-amber-300/90">
                  1. Cách sử dụng
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-stone-300/90">
                  <li>
                    <strong>Thu &amp; Thả băng:</strong> Chọn nhãn cảm xúc, bấm{" "}
                    <strong>REC</strong> để thu tâm sự (5 giây – 7 phút). Có thể bật{" "}
                    <em>Đổi giọng ẩn danh</em> trước khi thả vào màn đêm.
                  </li>
                  <li>
                    <strong>Nhặt băng &amp; Ủi an:</strong> Chuyển sang mục Nghe để nhặt ngẫu nhiên 1 cuộn băng của người lạ, gửi <em>Tách trà ấm</em> hoặc thu âm lời hồi âm (tối đa 3 phút).
                  </li>
                  <li>
                    <strong>Hòm thư Gác Đêm:</strong> Kiểm tra lượt nghe, tách trà ấm, lời hồi âm từ người lạ hoặc mở <em>Thư từ Chủ tiệm</em> nếu vẫn thấy nặng lòng.
                  </li>
                </ul>
              </section>

              <section className="flex flex-col gap-1.5 text-xs text-stone-300 leading-relaxed">
                <h3 className="font-semibold text-amber-300/90">
                  2. Quyền riêng tư &amp; Tự hủy 24h
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-stone-300/90">
                  <li>
                    <strong>Ẩn danh hoàn toàn:</strong> Không yêu cầu đăng nhập, không thu thập tên, email hay số điện thoại.
                  </li>
                  <li>
                    <strong>Tự tan biến sau 24 giờ:</strong> Toàn bộ file âm thanh và cuộn băng được tự động xóa vĩnh viễn khỏi hệ thống sau 24h.
                  </li>
                  <li>
                    <strong>An toàn cộng đồng:</strong> Cấm chia sẻ thông tin cá nhân (SĐT, Zalo, link MXH), nội dung xúc phạm, gạ gẫm hoặc lừa đảo.
                  </li>
                </ul>
              </section>

              <section className="flex flex-col gap-1.5 text-xs text-stone-300 leading-relaxed">
                <h3 className="font-semibold text-amber-300/90">
                  3. Miễn trừ y tế &amp; Giấy phép (License)
                </h3>
                <p className="text-stone-300/90">
                  Tiệm Băng Nửa Đêm là không gian lắng nghe cộng đồng phi thương mại,{" "}
                  <strong>không thay thế</strong> chẩn đoán hay điều trị tâm lý/y khoa chuyên nghiệp. Nếu bạn đang trong tình huống khẩn cấp, hãy liên hệ{" "}
                  <strong>115</strong>, Tổng đài Quốc gia <strong>111</strong> (24/24) hoặc Đường dây nóng Ngày Mai{" "}
                  <strong>096 306 1414</strong>.
                </p>
                <p className="text-[11px] text-stone-400">
                  © {new Date().getFullYear()} Tiệm Băng Nửa Đêm • Nội dung âm thanh thuộc về người gửi ẩn danh và tự hủy sau 24h.
                </p>
              </section>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bug Report / Feedback Modal */}
      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setReportOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[#10131b]/95 border border-amber-400/25 p-5 text-stone-200 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex flex-col gap-3.5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-amber-400" />
                  <div>
                    <h2 className="text-sm font-semibold tracking-wide text-amber-200">
                      BÁO LỖI &amp; GÓP Ý
                    </h2>
                    <p className="text-[11px] text-stone-400">
                      Giúp Chủ tiệm vá lỗi nhanh hơn
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  aria-label="Đóng khung báo lỗi"
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "BUG_AUDIO_UI", label: "Lỗi giao diện / Âm thanh" },
                    { id: "BUG_RECORD_PLAY", label: "Lỗi thu âm / Phát băng" },
                    { id: "SUGGESTION", label: "Góp ý tính năng" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setReportCategory(
                          opt.id as
                            | "BUG_AUDIO_UI"
                            | "BUG_RECORD_PLAY"
                            | "SUGGESTION"
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer transition-colors ${
                        reportCategory === opt.id
                          ? "bg-amber-500/20 border-amber-400/60 text-amber-200"
                          : "bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={4}
                  maxLength={600}
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  placeholder="Mô tả lỗi bạn gặp (trên điện thoại/máy tính nào, bấm vào đâu bị lỗi...) hoặc góp ý cho Tiệm..."
                  className="w-full rounded-xl bg-stone-950/90 border border-stone-800 focus:border-amber-400/50 focus:outline-none p-3 text-xs text-stone-200 placeholder:text-stone-500 resize-none"
                />

                <input
                  type="text"
                  maxLength={120}
                  value={reportContact}
                  onChange={(e) => setReportContact(e.target.value)}
                  placeholder="Liên hệ lại (không bắt buộc: FB, Threads, Email...)"
                  className="w-full rounded-xl bg-stone-950/90 border border-stone-800 focus:border-amber-400/50 focus:outline-none px-3 py-2 text-xs text-stone-200 placeholder:text-stone-500"
                />

                {reportStatus && (
                  <p
                    className={`text-xs rounded-lg px-3 py-2 border ${
                      reportStatus.type === "ok"
                        ? "bg-emerald-950/50 border-emerald-700/50 text-emerald-300"
                        : "bg-red-950/50 border-red-700/50 text-red-300"
                    }`}
                  >
                    {reportStatus.text}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-xs text-stone-300 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting || reportMessage.trim().length < 5}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{reportSubmitting ? "Đang gửi..." : "Gửi phản hồi"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
