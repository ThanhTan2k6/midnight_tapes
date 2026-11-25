"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Coffee,
  Headphones,
  Heart,
  HeartHandshake,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import {
  fetchMyMailbox,
  getLocalTapeLogs,
  thankReply,
  type LocalTapeLogEntry,
  type MailboxTapeItem,
} from "@/lib/api-client";
import { soundEngine } from "@/lib/sound-engine";
import { TAPE_TAGS, type RagSupportPayload } from "@/types/tape";
import { PsychSupportCard } from "./PsychSupportCard";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MailboxPanel() {
  const [tapes, setTapes] = useState<MailboxTapeItem[]>([]);
  const [localExpired, setLocalExpired] = useState<LocalTapeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [activeSupport, setActiveSupport] = useState<RagSupportPayload | null>(
    null
  );
  const [playingReplyId, setPlayingReplyId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadMailbox = async () => {
    setLoading(true);
    setError(null);
    const localLogs = getLocalTapeLogs();
    try {
      const serverTapes = await fetchMyMailbox();
      setTapes(serverTapes);
      setNowMs(Date.now());

      const serverIds = new Set(serverTapes.map((t) => t.id));
      const expiredOnes = localLogs.filter((l) => !serverIds.has(l.id));
      setLocalExpired(expiredOnes);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Chưa kết nối được máy chủ (đang hiển thị nhật ký cục bộ)."
      );
      setLocalExpired(localLogs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const localLogs = getLocalTapeLogs();

    fetchMyMailbox()
      .then((serverTapes) => {
        if (!active) return;
        setTapes(serverTapes);
        setNowMs(Date.now());
        const serverIds = new Set(serverTapes.map((t) => t.id));
        setLocalExpired(localLogs.filter((l) => !serverIds.has(l.id)));
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Chưa kết nối được máy chủ (đang hiển thị nhật ký cục bộ)."
        );
        setLocalExpired(localLogs);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleTogglePlayReply = async (replyId: string, url: string) => {
    await soundEngine.unlock();
    if (playingReplyId === replyId) {
      soundEngine.playPauseStop();
      audioRef.current?.pause();
      setPlayingReplyId(null);
      return;
    }

    soundEngine.playPlayEngage();
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingReplyId(null);
    setPlayingReplyId(replyId);
    void audio.play().catch(() => setPlayingReplyId(null));
  };

  const handleThank = async (replyId: string) => {
    await soundEngine.unlock();
    soundEngine.playTeaChime();
    try {
      await thankReply(replyId);
      setTapes((prev) =>
        prev.map((t) =>
          t.reply?.id === replyId
            ? { ...t, reply: { ...t.reply, isThanked: true } }
            : t
        )
      );
    } catch {
      // Ignore transient error
    }
  };

  if (activeSupport) {
    return (
      <PsychSupportCard
        payload={activeSupport}
        onClose={() => setActiveSupport(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-amber-200/80">
          Nhật ký cuộn băng 24h của bạn
        </span>
        <button
          type="button"
          onClick={() => void loadMailbox()}
          className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-amber-300/80 bg-stone-950/70 border border-amber-700/30 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}

      {!loading && tapes.length === 0 && localExpired.length === 0 && (
        <div className="text-center py-8 text-xs text-stone-400">
          Bạn chưa thả cuộn băng nào trong 24 giờ qua.
        </div>
      )}

      {tapes.map((t) => {
        const tagMeta = TAPE_TAGS.find((m) => m.id === t.tag);
        const remainingH = Math.max(
          1,
          Math.ceil(
            (new Date(t.expiresAt).getTime() - nowMs) / (1000 * 60 * 60)
          )
        );

        return (
          <div
            key={t.id}
            className="rounded-xl bg-stone-950/85 border border-stone-800 p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-hand text-sm text-amber-200">
                {tagMeta?.shortTag || t.tag} • {formatDuration(t.durationSeconds)}
              </span>
              <span className="text-[10px] font-lcd tracking-wider px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-300">
                {t.status === "ACTIVE"
                  ? t.severity === "CRISIS"
                    ? "GÁC ĐÊM GIỮ KÍN"
                    : `CÒN ~${remainingH}H`
                  : t.status === "REJECTED"
                  ? "TỪ CHỐI"
                  : "ĐANG DUYỆT"}
              </span>
            </div>

            {t.status === "REJECTED" && t.rejectReason && (
              <p className="text-[11px] text-red-300/90 bg-red-950/40 border border-red-800/40 rounded px-2.5 py-1.5">
                {t.rejectReason}
              </p>
            )}

            {t.status === "ACTIVE" && (
              <div className="flex items-center gap-4 text-[11px] text-stone-400">
                <span className="inline-flex items-center gap-1">
                  <Headphones className="w-3 h-3 text-amber-400/80" />
                  {t.listenCount} lượt nghe
                </span>
                <span className="inline-flex items-center gap-1">
                  <Coffee className="w-3 h-3 text-amber-400/80" />
                  {t.teaCount} tách trà ấm
                </span>
              </div>
            )}

            {t.ragSupport && (
              <button
                type="button"
                onClick={() => setActiveSupport(t.ragSupport)}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/15 border border-amber-400/35 text-xs text-amber-200 hover:bg-amber-500/25 cursor-pointer"
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Mở Lá thư ủi an từ Gác Đêm</span>
              </button>
            )}

            {t.reply && (
              <div className="mt-1 rounded-lg bg-amber-950/30 border border-amber-700/35 p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-200">
                    Có một lời ủi an gửi tới bạn ({formatDuration(t.reply.durationSeconds)})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleTogglePlayReply(t.reply!.id, t.reply!.audioUrl)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-stone-950 text-xs font-semibold hover:bg-amber-500 cursor-pointer"
                  >
                    {playingReplyId === t.reply.id ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Dừng</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Nghe hồi âm</span>
                      </>
                    )}
                  </button>
                </div>

                {t.reply.isThanked ? (
                  <div className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Bạn đã gửi lời Cảm ơn tới người lạ này.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleThank(t.reply!.id)}
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-stone-900 border border-amber-500/40 text-xs text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <span>Gửi lời Cảm ơn</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Local fallback for expired tapes within 48h */}
      {localExpired.map((item) => {
        const tagMeta = TAPE_TAGS.find((m) => m.id === item.tag);
        return (
          <div
            key={item.id}
            className="rounded-xl bg-stone-950/50 border border-stone-800/60 p-2.5 flex items-center justify-between text-xs text-stone-500"
          >
            <span className="font-hand">
              {tagMeta?.shortTag || item.tag} • {formatDuration(item.durationSeconds)}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px]">
              <Clock className="w-3 h-3" />
              Đã tan biến sau 24h
            </span>
          </div>
        );
      })}
    </div>
  );
}
