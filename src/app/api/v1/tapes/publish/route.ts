import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logTapeEvent } from "@/lib/events";
import { runModerationPipeline } from "@/lib/moderation";
import { AUDIO_CONSTRAINTS, TAPE_TAGS, type TapeTag } from "@/types/tape";

const VALID_TAGS = new Set<string>(TAPE_TAGS.map((t) => t.id));

export async function POST(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  let body: {
    tapeId?: string;
    audioPath?: string;
    durationSeconds?: number;
    tag?: string;
    isVoiceMasked?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  const audioPath = body.audioPath?.trim() || "";
  const durationSeconds = Math.round(Number(body.durationSeconds));
  const tag = body.tag?.trim() || "";
  const isVoiceMasked = Boolean(body.isVoiceMasked);

  if (!audioPath.startsWith("tapes/")) {
    return NextResponse.json(
      { error: "Đường dẫn audio không hợp lệ." },
      { status: 400 }
    );
  }

  if (!VALID_TAGS.has(tag)) {
    return NextResponse.json(
      { error: "Nhãn cảm xúc không hợp lệ." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS ||
    durationSeconds > AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS
  ) {
    return NextResponse.json(
      { error: "Thời lượng cuộn băng phải từ 5 giây đến 7 phút." },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from("tapes")
      .insert({
        ...(body.tapeId ? { id: body.tapeId } : {}),
        creator_hash: actor.userHash,
        ip_hash: actor.ipHash,
        tag: tag as TapeTag,
        audio_path: audioPath,
        duration_seconds: durationSeconds,
        is_voice_masked: isVoiceMasked,
        status: "PENDING_REVIEW",
      })
      .select("id, expires_at")
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message || "Không thể lưu cuộn băng." },
        { status: 500 }
      );
    }

    await logTapeEvent({
      tapeId: inserted.id,
      eventType: "PUBLISHED",
      actorHash: actor.userHash,
      metadata: { tag, durationSeconds, isVoiceMasked },
    });

    // Run AI Moderation + Psych-RAG synchronously (1-3s) so client gets immediate feedback
    const outcome = await runModerationPipeline({
      targetId: inserted.id,
      targetType: "TAPE",
      audioPath,
      actorHash: actor.userHash,
    });

    const message =
      outcome.status === "REJECTED"
        ? outcome.rejectReason
        : outcome.status === "PENDING_REVIEW"
        ? "Cuộn băng đã được tiếp nhận và đang chờ kiểm duyệt an toàn trước khi hòa vào màn đêm."
        : outcome.ragSupport
        ? "Tiệm băng đã lắng nghe bạn và gửi kèm một lá thư từ Gác Đêm."
        : "Cuộn băng của bạn đã trôi vào màn đêm.";

    const res = NextResponse.json(
      {
        id: inserted.id,
        status: outcome.status,
        severity: outcome.severity,
        rejectReason: outcome.rejectReason,
        ragSupport: outcome.ragSupport,
        message,
        expiresAt: inserted.expires_at,
      },
      { status: 201 }
    );

    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Lỗi hệ thống khi phát hành băng.",
      },
      { status: 500 }
    );
  }
}
