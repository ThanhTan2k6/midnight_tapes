"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  Coffee,
  Disc3,
  Eject,
  Headphones,
  Mic,
  Pause,
  Play,
  Send,
  Square,
} from "lucide-react";
import { useTapeStore } from "@/store/useTapeStore";
import { soundEngine } from "@/lib/sound-engine";
import { AUDIO_CONSTRAINTS, TAPE_TAGS } from "@/types/tape";
import { CassetteTape } from "./CassetteTape";
import { MechanicalButton } from "./MechanicalButton";
import { VUMeter } from "./VUMeter";

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function CassetteDeck() {
  const {
    mode,
    status,
    elapsedSeconds,
    recordedDuration,
    selectedTag,
    voiceMaskEnabled,
    activeListenDuration,
    activeListenTag,
    activeRemainingHours,
    setMode,
    setStatus,
    tickSecond,
    setSelectedTag,
    toggleVoiceMask,
    setAudioUnlocked,
    resetTape,
  } = useTapeStore();

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Timer tick for recording / playback
  useEffect(() => {
    if (status !== "RECORDING" && status !== "PLAYING") {
      soundEngine.stopTapeHiss();
      return;
    }

    soundEngine.startTapeHiss();
    const timer = setInterval(() => {
      tickSecond();
    }, 1000);

    return () => {
      clearInterval(timer);
      soundEngine.stopTapeHiss();
    };
  }, [status, tickSecond]);

  const unlockAndRun = async (fn: () => void) => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    fn();
  };

  const handleRec = () =>
    unlockAndRun(() => {
      if (mode !== "RECORD") return;
      soundEngine.playRecClick();
      if (status === "IDLE" || status === "PAUSED_REC" || status === "RECORDED") {
        if (status === "RECORDED") {
          resetTape();
        }
        setStatus("RECORDING");
      }
    });

  const handlePause = () =>
    unlockAndRun(() => {
      soundEngine.playPauseStop();
      if (status === "RECORDING") {
        setStatus("PAUSED_REC");
      } else if (status === "PLAYING") {
        setStatus("PAUSED_PLAY");
      }
    });

  const handlePlay = () =>
    unlockAndRun(() => {
      if (mode === "RECORD" && recordedDuration === 0) {
        showToast("Hãy bấm REC để thu âm trước khi nghe lại nhé.");
        return;
      }
      soundEngine.playPlayEngage();
      if (status === "PAUSED_PLAY" || status === "RECORDED" || status === "IDLE") {
        setStatus("PLAYING");
      }
    });

  const handleStop = () =>
    unlockAndRun(() => {
      soundEngine.playPauseStop();
      if (status === "RECORDING" || status === "PAUSED_REC") {
        setStatus(recordedDuration > 0 ? "RECORDED" : "IDLE");
      } else {
        setStatus(mode === "RECORD" && recordedDuration > 0 ? "RECORDED" : "IDLE");
      }
    });

  const handleEject = () =>
    unlockAndRun(() => {
      soundEngine.playEjectSnap();
      setStatus("EJECTING");
      setTimeout(() => {
        resetTape();
        if (mode === "LISTEN") {
          showToast("Đã đổi sang một cuộn băng mới từ màn đêm.");
        } else {
          showToast("Đã nhả cuộn băng khỏi khay máy.");
        }
      }, 480);
    });

  const handleToggleVoiceMask = () =>
    unlockAndRun(() => {
      soundEngine.playToggleSwitch();
      toggleVoiceMask();
    });

  const handleSendTea = () =>
    unlockAndRun(() => {
      soundEngine.playTeaChime();
      showToast("Đã gửi một tách trà ấm tới người lạ trong tĩnh lặng.");
    });

  const handleReleaseToNight = () =>
    unlockAndRun(() => {
      if (recordedDuration < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS) {
        showToast("Cuộn băng cần tối thiểu 5 giây để thả vào màn đêm.");
        return;
      }
      soundEngine.playEjectSnap();
      setStatus("EJECTING");
      setTimeout(() => {
        resetTape();
        showToast("Cuộn băng của bạn đã trôi vào màn đêm (Phase 3 sẽ nối Cloud).");
      }, 500);
    });

  const maxLimit =
    mode === "RECORD"
      ? AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS
      : activeListenDuration;
  const progress = maxLimit > 0 ? elapsedSeconds / maxLimit : 0;
  const isSpinning = status === "RECORDING" || status === "PLAYING";
  const mechanicalCounter = String(elapsedSeconds).padStart(3, "0");

  return (
    <section
      aria-label="Máy phát và ghi băng Cassette"
      className="w-full max-w-[430px] sm:max-w-[540px] rounded-2xl bg-gradient-to-b from-stone-800 via-stone-900 to-stone-950 border border-stone-700/80 shadow-[0_25px_60px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.14)] p-4 sm:p-6 flex flex-col gap-4"
    >
      {/* Top Brushed Metal Mode Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-800">
        <div className="flex items-center gap-1.5 bg-stone-950/90 p-1 rounded-lg border border-stone-800">
          <button
            type="button"
            onClick={() =>
              unlockAndRun(() => {
                soundEngine.playToggleSwitch();
                setMode("RECORD");
              })
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === "RECORD"
                ? "bg-amber-lamp/20 text-amber-glow border border-amber-lamp/40 shadow-sm"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Trút áp lực</span>
          </button>

          <button
            type="button"
            onClick={() =>
              unlockAndRun(() => {
                soundEngine.playToggleSwitch();
                setMode("LISTEN");
              })
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === "LISTEN"
                ? "bg-amber-lamp/20 text-amber-glow border border-amber-lamp/40 shadow-sm"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Lắng nghe</span>
          </button>
        </div>

        {/* REC LED Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-stone-950/80 border border-stone-800">
          <span
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              status === "RECORDING"
                ? "bg-led-rec-active shadow-[0_0_10px_#ef4444] animate-pulse"
                : status === "PAUSED_REC"
                ? "bg-amber-500 shadow-[0_0_6px_#f59e0b]"
                : "bg-stone-700"
            }`}
          />
          <span className="font-lcd text-xs tracking-wider text-stone-300">
            {status === "RECORDING"
              ? "REC"
              : status === "PAUSED_REC"
              ? "PAUSE"
              : status === "PLAYING"
              ? "PLAY"
              : "READY"}
          </span>
        </div>
      </div>

      {/* Cassette Acrylic Bay */}
      <div className="relative rounded-xl bg-stone-950/95 border border-stone-800 p-3 sm:p-4 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95)]">
        <CassetteTape
          spinning={isSpinning}
          ejecting={status === "EJECTING"}
          progress={progress}
          tag={mode === "RECORD" ? selectedTag : activeListenTag}
          durationLabel={
            mode === "RECORD"
              ? `${formatClock(elapsedSeconds)} / 07:00`
              : `${formatClock(elapsedSeconds)} / ${formatClock(activeListenDuration)}`
          }
          subtitle={
            mode === "RECORD"
              ? undefined
              : `Còn ${activeRemainingHours} giờ trước khi tan biến`
          }
        />
      </div>

      {/* Telemetry Row: Mechanical Counter + VU Meter + Voice Mask Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* LCD / Mechanical Counter */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">
            Bộ đếm (Giây)
          </span>
          <div className="flex items-baseline gap-1.5 bg-stone-950 border border-stone-800 rounded px-2.5 py-1 shadow-inner">
            <span className="font-lcd text-2xl text-amber-glow tracking-widest">
              {mechanicalCounter}
            </span>
            <span className="font-lcd text-sm text-stone-500">
              / {mode === "RECORD" ? "420" : String(activeListenDuration).padStart(3, "0")}
            </span>
          </div>
        </div>

        {/* Analog VU Meter */}
        <VUMeter active={isSpinning} mode={mode} />

        {/* Chrome Toggle Switch: Voice Mask */}
        {mode === "RECORD" && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">
              Màn che giọng ấm
            </span>
            <button
              type="button"
              onClick={handleToggleVoiceMask}
              aria-pressed={voiceMaskEnabled}
              className="relative flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-full px-2.5 py-1 cursor-pointer hover:border-amber-lamp/50 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  voiceMaskEnabled
                    ? "bg-amber-glow shadow-[0_0_8px_#f59e0b]"
                    : "bg-stone-700"
                }`}
              />
              <span className="text-xs font-medium text-stone-200">
                {voiceMaskEnabled ? "Đang bật" : "Đang tắt"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Tag Selector Stickers (Record Mode) */}
      {mode === "RECORD" && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {TAPE_TAGS.map((tag) => {
            const active = selectedTag === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  unlockAndRun(() => {
                    soundEngine.playToggleSwitch();
                    setSelectedTag(tag.id);
                  })
                }
                className={`px-2.5 py-1 rounded-md text-xs font-hand transition-all cursor-pointer border ${
                  active
                    ? "bg-sticker-parchment text-stone-900 border-amber-500 shadow-sm -rotate-1"
                    : "bg-stone-900/70 text-stone-400 border-stone-800 hover:text-stone-200"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Mechanical Transport Buttons */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-2 border-t border-stone-800/80">
        {mode === "RECORD" && (
          <MechanicalButton
            variant="rec"
            label="REC"
            active={status === "RECORDING"}
            onClick={handleRec}
            icon={
              <Circle
                className={`w-4 h-4 ${
                  status === "RECORDING"
                    ? "fill-red-400 text-red-400"
                    : "fill-red-500/80 text-red-400"
                }`}
              />
            }
          />
        )}

        <MechanicalButton
          label="PLAY"
          active={status === "PLAYING"}
          onClick={handlePlay}
          icon={<Play className="w-4 h-4 fill-current" />}
        />

        <MechanicalButton
          label="PAUSE"
          active={status === "PAUSED_REC" || status === "PAUSED_PLAY"}
          disabled={status !== "RECORDING" && status !== "PLAYING"}
          onClick={handlePause}
          icon={<Pause className="w-4 h-4 fill-current" />}
        />

        <MechanicalButton
          label="STOP"
          onClick={handleStop}
          icon={<Square className="w-3.5 h-3.5 fill-current" />}
        />

        <MechanicalButton
          variant="eject"
          label="EJECT"
          onClick={handleEject}
          icon={<Eject className="w-4 h-4" />}
        />
      </div>

      {/* Bottom Ritual Action Bar */}
      <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {mode === "RECORD" ? (
          <button
            type="button"
            onClick={handleReleaseToNight}
            disabled={recordedDuration < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 text-stone-950 font-semibold text-sm shadow-[0_4px_15px_rgba(217,119,6,0.3)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Thả vào màn đêm</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleEject}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-sm font-medium transition-colors cursor-pointer"
            >
              <Disc3 className="w-4 h-4 text-amber-glow" />
              <span>Nhặt cuộn băng khác</span>
            </button>
            <button
              type="button"
              onClick={handleSendTea}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-lamp/20 hover:bg-amber-lamp/30 text-amber-glow border border-amber-lamp/40 text-sm font-medium transition-colors cursor-pointer"
            >
              <Coffee className="w-4 h-4" />
              <span>Gửi tách trà ấm</span>
            </button>
          </>
        )}
      </div>

      {/* Gentle Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="text-center text-xs text-amber-200/90 bg-stone-950/90 border border-amber-lamp/30 rounded-lg px-3 py-2 animate-fade-in"
        >
          {toastMsg}
        </div>
      )}
    </section>
  );
}
