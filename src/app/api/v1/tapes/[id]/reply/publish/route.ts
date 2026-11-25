import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logTapeEvent } from "@/lib/events";
import { runModerationPipeline } from "@/lib/moderation";
import { AUDIO_CONSTRAINTS } from "@/types/tape";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = resolveAnonymousActor(request);
  const { id: tapeId } = await context.params;

  let body: {
    replyId?: string;
    audioPath?: string;
    durationSeconds?: number;
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

  if (!audioPath.startsWith("replies/")) {
    return NextResponse.json(
      { error: "Đường dẫn audio hồi âm không hợp lệ." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS ||
    durationSeconds > AUDIO_CONSTRAINTS.MAX_REPLY_DURATION_SECONDS
  ) {
    return NextResponse.json(
      { error: "Thời lượng hồi âm phải từ 5 giây đến 3 phút." },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: tape } = await supabase
      .from("tapes")
      .select("id, creator_hash, has_reply, status, expires_at")
      .eq("id", tapeId)
      .single();

    if (!tape || tape.status !== "ACTIVE" || new Date(tape.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: "Cuộn băng không tồn tại hoặc đã tan biến." },
        { status: 404 }
      );
    }

    if (tape.creator_hash === actor.userHash) {
      return NextResponse.json(
        { error: "Không thể tự hồi âm cho cuộn băng của chính mình." },
        { status: 403 }
      );
    }

    if (tape.has_reply) {
      return NextResponse.json(
        { error: "Cuộn băng này đã nhận được lời hồi âm rồi." },
        { status: 409 }
      );
    }

    const { data: reply, error: insertError } = await supabase
      .from("tape_replies")
      .insert({
        ...(body.replyId ? { id: body.replyId } : {}),
        tape_id: tapeId,
        sender_hash: actor.userHash,
        ip_hash: actor.ipHash,
        audio_path: audioPath,
        duration_seconds: durationSeconds,
        status: "PENDING_REVIEW",
        expires_at: tape.expires_at,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Cuộn băng này đã có người khác hồi âm trước đó." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await logTapeEvent({
      tapeId,
      eventType: "REPLY_SENT",
      actorHash: actor.userHash,
      metadata: { replyId: reply.id, durationSeconds },
    });

    const outcome = await runModerationPipeline({
      targetId: reply.id,
      targetType: "REPLY",
      audioPath,
      actorHash: actor.userHash,
    });

    if (outcome.status === "REJECTED") {
      // Remove rejected reply so the original tape can still receive a valid reply
      await supabase.from("tape_replies").delete().eq("id", reply.id);
      return NextResponse.json(
        {
          replyId: reply.id,
          status: "REJECTED",
          message:
            outcome.rejectReason ||
            "Lời hồi âm chưa phù hợp với quy tắc an toàn.",
        },
        { status: 400 }
      );
    }

    if (outcome.status === "PENDING_REVIEW") {
      return NextResponse.json(
        {
          replyId: reply.id,
          status: "PENDING_REVIEW",
          message: "Lời ủi an đã được tiếp nhận và đang chờ kiểm duyệt.",
        },
        { status: 202 }
      );
    }

    const { error: updateTapeErr } = await supabase
      .from("tapes")
      .update({
        has_reply: true,
        reserved_by_hash: null,
        reserved_until: null,
      })
      .eq("id", tapeId);

    if (updateTapeErr) {
      return NextResponse.json(
        { error: `Không thể đồng bộ trạng thái hồi âm: ${updateTapeErr.message}` },
        { status: 500 }
      );
    }

    const res = NextResponse.json(
      {
        replyId: reply.id,
        status: outcome.status,
        message: "Lời ủi an đã được gửi tới người ban đầu.",
      },
      { status: 201 }
    );
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không thể gửi hồi âm lúc này.",
      },
      { status: 500 }
    );
  }
}
