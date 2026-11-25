import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createAudioPresignedUploadUrl } from "@/lib/r2";
import { AUDIO_CONSTRAINTS } from "@/types/tape";

const ALLOWED_MIME_PREFIXES = ["audio/webm", "audio/mp4", "audio/ogg"];

function extensionFromMime(contentType: string): string {
  if (contentType.startsWith("audio/mp4")) return "mp4";
  if (contentType.startsWith("audio/ogg")) return "ogg";
  return "webm";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = resolveAnonymousActor(request);
  const { id: tapeId } = await context.params;

  const limit = await checkRateLimit("replyTape", actor.userHash);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Bạn đã gửi tối đa số lời hồi âm cho phép trong 24 giờ qua." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: {
    contentType?: string;
    fileSizeBytes?: number;
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

  const contentType = (body.contentType || "").toLowerCase().trim();
  const baseMime = contentType.split(";")[0];
  const fileSizeBytes = Number(body.fileSizeBytes);
  const durationSeconds = Number(body.durationSeconds);

  if (!ALLOWED_MIME_PREFIXES.includes(baseMime)) {
    return NextResponse.json(
      { error: "Định dạng âm thanh không được hỗ trợ." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > AUDIO_CONSTRAINTS.MAX_FILE_SIZE_BYTES
  ) {
    return NextResponse.json(
      { error: "Dung lượng lời hồi âm vượt quá 3MB." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < AUDIO_CONSTRAINTS.MIN_DURATION_SECONDS ||
    durationSeconds > AUDIO_CONSTRAINTS.MAX_REPLY_DURATION_SECONDS
  ) {
    return NextResponse.json(
      { error: "Thời lượng lời hồi âm phải từ 5 giây đến 3 phút." },
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
        { error: "Cuộn băng này đã nhận được một lời ủi an từ người lạ khác rồi." },
        { status: 409 }
      );
    }

    const replyId = randomUUID();
    const ext = extensionFromMime(baseMime);
    const audioPath = `replies/${replyId}.${ext}`;

    const uploadUrl = await createAudioPresignedUploadUrl({
      objectKey: audioPath,
      contentType: baseMime,
      contentLength: fileSizeBytes,
    });

    const res = NextResponse.json({
      replyId,
      uploadUrl,
      audioPath,
      expiresIn: 300,
    });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Không thể khởi tạo đường dẫn gửi hồi âm.",
      },
      { status: 500 }
    );
  }
}
