"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Coffee,
  Disc3,
  Eject,
  Headphones,
  Inbox,
  Loader2,
  Mic,
  Pause,
  Play,
  Send,
  Square,
} from "lucide-react";
import { useTapeStore } from "@/store/useTapeStore";
import { soundEngine } from "@/lib/sound-engine";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  pickRandomTape,
  reactTeaToTape,
  uploadAndPublishReply,
  uploadAndPublishTape,
  type PickedTapeItem,
} from "@/lib/api-client";
import {
  AUDIO_CONSTRAINTS,
  TAPE_TAGS,
  type RagSupportPayload,
  type TapeTag,
} from "@/types/tape";
import { CassetteTape } from "./CassetteTape";
import { MechanicalButton } from "./MechanicalButton";
import { VUMeter } from "./VUMeter";
import { MailboxPanel } from "./MailboxPanel";
import { PsychSupportCard } from "./PsychSupportCard";

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function CassetteDeck() {
  const {
    mode,
    status,
    elapsedSeconds,
    recordedDuration,
    selectedTag,
    voiceMaskEnabled,
    hasUnreadReply,
    setMode,
    setStatus,
    setElapsedSeconds,
    tickSecond,
    setSelectedTag,
    toggleVoiceMask,
    setAudioUnlocked,
    setHasUnreadReply,
    triggerDoorEvent,
    resetTape,
  } = useTapeStore();

  const {
    recording,
    audioLevel,
    micError,
    clearMicError,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    startPlayback,
    pausePlayback,
    stopPlayback,
    clearRecording,
  } = useAudioRecorder(mode === "RECORD" ? voiceMaskEnabled : false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [psychSupport, setPsychSupport] = useState<RagSupportPayload | null>(
    null
  );

  // Listen Mode state
  const [listenFilter, setListenFilter] = useState<TapeTag | "ALL">("ALL");
  const [pickedTape, setPickedTape] = useState<PickedTapeItem | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [listenProgressRatio, setListenProgressRatio] = useState(0);
  const [teaSentForPicked, setTeaSentForPicked] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyElapsed, setReplyElapsed] = useState(0);
  const [replyRecordedDuration, setReplyRecordedDuration] = useState(0);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const submissionTokenRef = useRef(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4200);
  };

  // Cleanup remote audio on unmount
  useEffect(() => {
    return () => {
      remoteAudioRef.current?.pause();
      remoteAudioRef.current = null;
    };
  }, []);

  // Timer tick for recording / playback
  useEffect(() => {
    if (status !== "RECORDING" && status !== "PLAYING") {
      soundEngine.stopTapeHiss();
      return;
    }

    soundEngine.startTapeHiss();
    const timer = setInterval(() => {
      if (isReplying && status === "RECORDING") {
        setReplyElapsed((prev) => {
          const next = prev + 1;
          setReplyRecordedDuration(next);
          if (next >= AUDIO_CONSTRAINTS.MAX_REPLY_DURATION_SECONDS) {
            stopRecording();
            setStatus("RECORDED");
          }
          return next;
        });
      } else {
        tickSecond();
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      soundEngine.stopTapeHiss();
    };
  }, [status, tickSecond, isReplying, stopRecording, setStatus]);

  // Auto-stop MediaRecorder when 7-minute limit (420s) is reached
  useEffect(() => {
    if (
      mode === "RECORD" &&
      status === "RECORDED" &&
      recordedDuration >= AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS
    ) {
      stopRecording();
    }
  }, [mode, status, recordedDuration, stopRecording]);

  const unlockAndRun = async (fn: () => void | Promise<void>) => {
    await soundEngine.unlock();
    setAudioUnlocked(true);
    await fn();
  };

  const stopRemoteAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.currentTime = 0;
    }
  };

  const handleRec = () =>
    unlockAndRun(async () => {
      if (isSubmitting || (mode !== "RECORD" && !isReplying)) return;
      submissionTokenRef.current += 1;
      soundEngine.playRecClick();
      clearMicError();

      if (status === "PAUSED_REC") {
        resumeRecording();
        setStatus("RECORDING");
        return;
      }

      if (status === "IDLE" || status === "RECORDED") {
        if (isReplying) {
          setReplyElapsed(0);
          setReplyRecordedDuration(0);
        } else {
          resetTape();
        }
        const started = await startRecording();
        if (started) {
          setStatus("RECORDING");
        }
      }
    });

  const handlePause = () =>
    unlockAndRun(() => {
      soundEngine.playPauseStop();
      if (status === "RECORDING") {
        pauseRecording();
        setStatus("PAUSED_REC");
      } else if (status === "PLAYING") {
        if (mode === "RECORD" || isReplying) {
          pausePlayback();
        } else {
          remoteAudioRef.current?.pause();
        }
        setStatus("PAUSED_PLAY");
      }
    });

  const handlePlay = () =>
    unlockAndRun(async () => {
      soundEngine.playPlayEngage();

      if (mode === "RECORD" || isReplying) {
        if (status === "RECORDING" || status === "PAUSED_REC") {
          showToast("Hãy bấm STOP trước khi nghe lại cuộn băng nhé.");
          return;
        }
        if (!recording?.url) {
          showToast("Hãy bấm REC để thu âm trước khi nghe lại nhé.");
          return;
        }
        if (status === "RECORDED" || status === "IDLE") {
          setElapsedSeconds(0);
        }
        const ok = await startPlayback(() => {
          setElapsedSeconds(0);
          setStatus("RECORDED");
        });
        if (ok) {
          setStatus("PLAYING");
        }
        return;
      }

      // Listen Mode remote audio playback
      if (!pickedTape) {
        showToast("Hãy bấm 'Nhặt một cuộn băng' trước nhé.");
        return;
      }

      if (!remoteAudioRef.current || remoteAudioRef.current.src !== pickedTape.audioUrl) {
        remoteAudioRef.current?.pause();
        const audio = new Audio(pickedTape.audioUrl);
        audio.onended = () => {
          setElapsedSeconds(0);
          setStatus("IDLE");
          setListenProgressRatio(1);
        };
        remoteAudioRef.current = audio;
      }

      try {
        await remoteAudioRef.current.play();
        setStatus("PLAYING");
      } catch {
        showToast("Không thể phát cuộn băng này lúc này.");
      }
    });

  const handleStop = () =>
    unlockAndRun(() => {
      soundEngine.playPauseStop();
      if (status === "RECORDING" || status === "PAUSED_REC") {
        stopRecording();
        setElapsedSeconds(0);
        if (isReplying) {
          setStatus(replyRecordedDuration > 0 ? "RECORDED" : "IDLE");
        } else {
          setStatus(recordedDuration > 0 ? "RECORDED" : "IDLE");
        }
      } else if (status === "PLAYING" || status === "PAUSED_PLAY") {
        if (mode === "RECORD" || isReplying) {
          stopPlayback();
        } else {
          stopRemoteAudio();
        }
        setElapsedSeconds(0);
        setStatus(
          (mode === "RECORD" && recordedDuration > 0) ||
            (isReplying && replyRecordedDuration > 0)
            ? "RECORDED"
            : "IDLE"
        );
      }
    });

  const handlePickTape = () =>
    unlockAndRun(async () => {
      soundEngine.playEjectSnap();
      stopRecording();
      stopRemoteAudio();
      clearRecording();
      setIsReplying(false);
      setReplyElapsed(0);
      setReplyRecordedDuration(0);
      setTeaSentForPicked(false);
      setListenProgressRatio(0);
      setStatus("EJECTING");
      setIsPicking(true);

      try {
        const tape = await pickRandomTape(listenFilter);
        setPickedTape(tape);
        resetTape();
        triggerDoorEvent();
        showToast(`Đã nhặt cuộn băng #${tape.tagDisplayName}. Bấm PLAY để nghe.`);
      } catch (err) {
        setPickedTape(null);
        resetTape();
        showToast(
          err instanceof Error
            ? err.message
            : "Chưa có cuộn băng nào khác trôi dạt tới."
        );
      } finally {
        setIsPicking(false);
      }
    });

  const handleEject = () =>
    unlockAndRun(() => {
      if (mode === "LISTEN" && !isReplying) {
        void handlePickTape();
        return;
      }

      soundEngine.playEjectSnap();
      stopRecording();
      clearRecording();
      setIsReplying(false);
      setReplyElapsed(0);
      setReplyRecordedDuration(0);
      setStatus("EJECTING");
      setTimeout(() => {
        resetTape();
        showToast("Đã nhả cuộn băng khỏi khay máy.");
      }, 480);
    });

  const handleSwitchMode = (nextMode: "RECORD" | "LISTEN" | "MAILBOX") =>
    unlockAndRun(() => {
      if (isSubmitting || mode === nextMode) return;
      submissionTokenRef.current += 1;
      soundEngine.playToggleSwitch();
      stopRecording();
      stopRemoteAudio();
      clearRecording();
      setIsReplying(false);
      setPsychSupport(null);
      if (nextMode === "MAILBOX") {
        setHasUnreadReply(false);
      }
      setMode(nextMode);
    });

  const handleToggleVoiceMask = () =>
    unlockAndRun(() => {
      soundEngine.playToggleSwitch();
      toggleVoiceMask();
      if (status === "RECORDED") {
        showToast(
          "Công tắc Màn che giọng ấm sẽ áp dụng khi bạn bấm REC thu băng mới."
        );
      }
    });

  const handleSendTea = () =>
    unlockAndRun(async () => {
      if (!pickedTape || teaSentForPicked) return;
      soundEngine.playTeaChime();
      try {
        const res = await reactTeaToTape(pickedTape.id);
        setTeaSentForPicked(true);
        setPickedTape((prev) =>
          prev ? { ...prev, teaCount: res.teaCount } : prev
        );
        showToast(res.message);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Không thể gửi tách trà lúc này."
        );
      }
    });

  const handleReleaseToNight = () =>
    unlockAndRun(async () => {
      if (
        !recording ||
        recordedDuration < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS
      ) {
        showToast("Cuộn băng cần tối thiểu 5 giây để thả vào màn đêm.");
        return;
      }
      if (recording.sizeBytes > AUDIO_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
        showToast("Dung lượng băng vượt quá 3MB, vui lòng thu ngắn lại chút nhé.");
        return;
      }

      const token = ++submissionTokenRef.current;
      setIsSubmitting(true);
      try {
        const result = await uploadAndPublishTape({
          blob: recording.blob,
          durationSeconds: recordedDuration,
          tag: selectedTag,
          isVoiceMasked: voiceMaskEnabled,
        });

        soundEngine.playEjectSnap();
        setStatus("EJECTING");

        setTimeout(() => {
          if (submissionTokenRef.current !== token) return;
          clearRecording();
          resetTape();
          if (result.ragSupport) {
            setPsychSupport(result.ragSupport);
          } else {
            showToast(result.message);
          }
        }, 480);
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Chưa kết nối được máy chủ (hãy cấu hình .env.local)."
        );
      } finally {
        setIsSubmitting(false);
      }
    });

  const handleSendVoiceReply = () =>
    unlockAndRun(async () => {
      if (
        !pickedTape ||
        !recording ||
        replyRecordedDuration < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS
      ) {
        showToast("Lời ủi an cần tối thiểu 5 giây.");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await uploadAndPublishReply({
          tapeId: pickedTape.id,
          blob: recording.blob,
          durationSeconds: replyRecordedDuration,
        });
        soundEngine.playEjectSnap();
        clearRecording();
        setIsReplying(false);
        setReplyElapsed(0);
        setReplyRecordedDuration(0);
        setPickedTape((prev) => (prev ? { ...prev, hasReply: true } : prev));
        resetTape();
        showToast(res.message);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Không thể gửi lời ủi an lúc này."
        );
      } finally {
        setIsSubmitting(false);
      }
    });

  const displayElapsed = isReplying ? replyElapsed : elapsedSeconds;
  const maxLimit = isReplying
    ? AUDIO_CONSTRAINTS.MAX_REPLY_DURATION_SECONDS
    : mode === "RECORD"
    ? AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS
    : pickedTape?.durationSeconds ?? 180;

  const progress = maxLimit > 0 ? displayElapsed / maxLimit : 0;
  const isSpinning = status === "RECORDING" || status === "PLAYING";
  const mechanicalCounter = String(displayElapsed).padStart(3, "0");
  const liveListenRatio =
    mode === "LISTEN" && pickedTape && pickedTape.durationSeconds > 0
      ? elapsedSeconds / pickedTape.durationSeconds
      : 0;
  const canReplyOrTea =
    Boolean(pickedTape) &&
    Math.max(listenProgressRatio, liveListenRatio) >= 0.7;

  return (
    <section
      aria-label="Máy phát và ghi băng Cassette"
      className="w-full max-w-[430px] sm:max-w-[540px] rounded-2xl bg-gradient-to-b from-stone-800 via-stone-900 to-stone-950 border border-stone-700/80 shadow-[0_25px_60px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.14)] p-4 sm:p-6 flex flex-col gap-4"
    >
      {/* Top Brushed Metal Mode Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-800">
        <div className="flex items-center gap-1 bg-stone-950/90 p-1 rounded-lg border border-stone-800">
          <button
            type="button"
            onClick={() => handleSwitchMode("RECORD")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
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
            onClick={() => handleSwitchMode("LISTEN")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === "LISTEN"
                ? "bg-amber-lamp/20 text-amber-glow border border-amber-lamp/40 shadow-sm"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Lắng nghe</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode("MAILBOX")}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === "MAILBOX"
                ? "bg-amber-lamp/20 text-amber-glow border border-amber-lamp/40 shadow-sm"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Hộp thư</span>
            {hasUnreadReply && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* REC LED Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-stone-950/80 border border-stone-800 shrink-0">
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

      {/* MAILBOX MODE */}
      {mode === "MAILBOX" ? (
        <MailboxPanel />
      ) : psychSupport ? (
        <PsychSupportCard
          payload={psychSupport}
          onClose={() => setPsychSupport(null)}
        />
      ) : (
        <>
          {/* Cassette Acrylic Bay */}
          <div className="relative rounded-xl bg-stone-950/95 border border-stone-800 p-3 sm:p-4 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95)]">
            <CassetteTape
              spinning={isSpinning}
              ejecting={status === "EJECTING"}
              progress={progress}
              tag={
                mode === "RECORD"
                  ? selectedTag
                  : pickedTape?.tag ?? (listenFilter === "ALL" ? "LONELY" : listenFilter)
              }
              durationLabel={
                isReplying
                  ? `${formatClock(displayElapsed)} / 03:00`
                  : mode === "RECORD"
                  ? `${formatClock(displayElapsed)} / 07:00`
                  : pickedTape
                  ? `${formatClock(displayElapsed)} / ${formatClock(pickedTape.durationSeconds)}`
                  : "00:00 / 00:00"
              }
              subtitle={
                isReplying
                  ? "Đang thu lời ủi an gửi người lạ..."
                  : mode === "RECORD"
                  ? recording
                    ? `Đã thu ${formatClock(recordedDuration)} • ${formatFileSize(recording.sizeBytes)}`
                    : undefined
                  : pickedTape
                  ? `Còn ${pickedTape.remainingHours} giờ trước khi tan biến`
                  : "Bấm 'Nhặt cuộn băng' để nghe câu chuyện ngẫu nhiên"
              }
            />
          </div>

          {/* Telemetry Row: Mechanical Counter + VU Meter + Voice Mask Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">
                Bộ đếm (Giây)
              </span>
              <div className="flex items-baseline gap-1.5 bg-stone-950 border border-stone-800 rounded px-2.5 py-1 shadow-inner">
                <span className="font-lcd text-2xl text-amber-glow tracking-widest">
                  {mechanicalCounter}
                </span>
                <span className="font-lcd text-sm text-stone-500">
                  / {String(maxLimit).padStart(3, "0")}
                </span>
              </div>
            </div>

            <VUMeter
              active={isSpinning}
              mode={isReplying ? "RECORD" : mode}
              level={mode === "RECORD" || isReplying ? audioLevel : undefined}
            />

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

          {/* Tag Selector (Record: pick tag for tape; Listen: filter tag) */}
          {!isReplying && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {mode === "LISTEN" && (
                <button
                  type="button"
                  onClick={() =>
                    unlockAndRun(() => {
                      soundEngine.playToggleSwitch();
                      setListenFilter("ALL");
                    })
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-hand transition-all cursor-pointer border ${
                    listenFilter === "ALL"
                      ? "bg-sticker-parchment text-stone-900 border-amber-500 shadow-sm"
                      : "bg-stone-900/70 text-stone-400 border-stone-800 hover:text-stone-200"
                  }`}
                >
                  Tất cả
                </button>
              )}
              {TAPE_TAGS.map((tag) => {
                const active =
                  mode === "RECORD"
                    ? selectedTag === tag.id
                    : listenFilter === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      unlockAndRun(() => {
                        soundEngine.playToggleSwitch();
                        if (mode === "RECORD") {
                          setSelectedTag(tag.id);
                        } else {
                          setListenFilter(tag.id);
                        }
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
            {(mode === "RECORD" || isReplying) && (
              <MechanicalButton
                variant="rec"
                label="REC"
                disabled={isSubmitting}
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
          <div className="pt-1 flex flex-col gap-2">
            {mode === "RECORD" ? (
              <button
                type="button"
                onClick={handleReleaseToNight}
                disabled={
                  isSubmitting ||
                  !recording ||
                  recordedDuration < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS ||
                  status === "RECORDING" ||
                  status === "PAUSED_REC"
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 text-stone-950 font-semibold text-sm shadow-[0_4px_15px_rgba(217,119,6,0.3)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting ? "Đang thả vào màn đêm..." : "Thả vào màn đêm"}
                </span>
              </button>
            ) : isReplying ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopRecording();
                    clearRecording();
                    setIsReplying(false);
                    setReplyElapsed(0);
                    setReplyRecordedDuration(0);
                    resetTape();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-medium hover:bg-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSendVoiceReply}
                  disabled={
                    isSubmitting ||
                    !recording ||
                    replyRecordedDuration < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS ||
                    status === "RECORDING" ||
                    status === "PAUSED_REC"
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 text-stone-950 font-semibold text-sm hover:brightness-110 disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmitting ? "Đang gửi lời ủi an..." : "Gửi lời ủi an"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={isPicking}
                  onClick={handlePickTape}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPicking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-glow" />
                  ) : (
                    <Disc3 className="w-4 h-4 text-amber-glow" />
                  )}
                  <span>
                    {pickedTape ? "Đổi cuộn băng khác" : "Nhặt một cuộn băng"}
                  </span>
                </button>

                {pickedTape && (
                  <>
                    <button
                      type="button"
                      disabled={!canReplyOrTea || teaSentForPicked}
                      onClick={handleSendTea}
                      title={
                        canReplyOrTea
                          ? "Gửi một tách trà ấm"
                          : "Hãy nghe ít nhất 70% cuộn băng để gửi phản hồi"
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-lamp/20 hover:bg-amber-lamp/30 text-amber-glow border border-amber-lamp/40 text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Coffee className="w-4 h-4" />
                      <span>
                        {teaSentForPicked ? "Đã gửi trà ấm" : "Gửi tách trà ấm"}
                      </span>
                    </button>

                    {!pickedTape.hasReply && (
                      <button
                        type="button"
                        disabled={!canReplyOrTea}
                        onClick={() => {
                          stopRemoteAudio();
                          resetTape();
                          setIsReplying(true);
                          showToast("Bấm REC để thu lời ủi an (tối đa 3 phút).");
                        }}
                        title={
                          canReplyOrTea
                            ? "Thu âm lời ủi an"
                            : "Hãy nghe ít nhất 70% cuộn băng để hồi đáp"
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-700/80 hover:bg-amber-600 text-stone-950 text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Hồi đáp</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Microphone Error Banner */}
      {micError && (
        <div
          role="alert"
          className="text-center text-xs text-red-200 bg-red-950/60 border border-red-700/50 rounded-lg px-3 py-2"
        >
          {micError}
        </div>
      )}

      {/* Gentle Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="text-center text-xs text-amber-200/90 bg-stone-950/90 border border-amber-lamp/30 rounded-lg px-3 py-2"
        >
          {toastMsg}
        </div>
      )}
    </section>
  );
}
