import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAudioPresignedUploadUrl } from "@/lib/r2";
import { logTapeEvent } from "@/lib/events";
import { AUDIO_CONSTRAINTS } from "@/types/tape";

const ALLOWED_MIME_PREFIXES = ["audio/webm", "audio/mp4", "audio/ogg"];

function extensionFromMime(contentType: string): string {
  if (contentType.startsWith("audio/mp4")) return "mp4";
  if (contentType.startsWith("audio/ogg")) return "ogg";
  return "webm";
}

export async function POST(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  const userLimit = await checkRateLimit("createTape", actor.userHash);
  const ipLimit = await checkRateLimit("createTapeIp", actor.ipHash);
  if (!userLimit.allowed || !ipLimit.allowed) {
    const retry = Math.max(
      userLimit.retryAfterSeconds,
      ipLimit.retryAfterSeconds
    );
    return NextResponse.json(
      {
        error: "Bạn đã thả tối đa số cuộn băng cho phép trong 24 giờ qua.",
      },
      { status: 429, headers: { "Retry-After": String(retry) } }
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
      { error: "Dung lượng cuộn băng vượt quá giới hạn 3MB." },
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

  const tapeId = randomUUID();
  const ext = extensionFromMime(baseMime);
  const audioPath = `tapes/${tapeId}.${ext}`;

  try {
    const uploadUrl = await createAudioPresignedUploadUrl({
      objectKey: audioPath,
      contentType: baseMime,
      contentLength: fileSizeBytes,
    });

    await logTapeEvent({
      tapeId,
      eventType: "UPLOAD_URL_ISSUED",
      actorHash: actor.userHash,
      metadata: { durationSeconds, fileSizeBytes, baseMime },
    });

    const res = NextResponse.json({
      tapeId,
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
            : "Không thể khởi tạo đường dẫn tải lên.",
      },
      { status: 500 }
    );
  }
}
