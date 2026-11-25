import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAudioPlaybackUrl } from "@/lib/r2";
import { logTapeEvent } from "@/lib/events";
import { TAPE_TAGS } from "@/types/tape";

const VALID_TAGS = new Set<string>(TAPE_TAGS.map((t) => t.id));

export async function POST(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  // Cumulative discovery rate limits: max 15 picks/1h AND max 5 picks/10m
  const [hourly, burst] = await Promise.all([
    checkRateLimit("pickHourly", actor.userHash),
    checkRateLimit("pickBurst", actor.userHash),
  ]);

  if (!hourly.allowed || !burst.allowed) {
    const retry = Math.max(hourly.retryAfterSeconds, burst.retryAfterSeconds);
    return NextResponse.json(
      {
        error:
          "Bạn đã nhặt khá nhiều cuộn băng trong chốc lát. Hãy nghỉ ngơi nghe tiếng mưa một chút nhé.",
      },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }

  let tagFilter: string | null = null;
  try {
    const body = (await request.json()) as { tagFilter?: string };
    if (body.tagFilter && body.tagFilter !== "ALL" && VALID_TAGS.has(body.tagFilter)) {
      tagFilter = body.tagFilter;
    }
  } catch {
    // Allow empty body -> pick from ALL tags
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("pick_random_tape", {
      p_user_hash: actor.userHash,
      p_tag: tagFilter,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const picked = Array.isArray(data) ? data[0] : null;
    if (!picked) {
      return NextResponse.json(
        {
          error:
            "Đêm nay tạm thời chưa có cuộn băng nào khác trôi dạt tới. Bạn thử lại sau ít phút hoặc bỏ lọc nhãn nhé.",
        },
        { status: 404 }
      );
    }

    const audioUrl = await resolveAudioPlaybackUrl(picked.audio_path);
    const remainingMs = Math.max(
      0,
      new Date(picked.expires_at).getTime() - Date.now()
    );
    const remainingHours = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));
    const tagMeta = TAPE_TAGS.find((t) => t.id === picked.tag);

    await logTapeEvent({
      tapeId: picked.id,
      eventType: "PICKED",
      actorHash: actor.userHash,
      metadata: { tag: picked.tag },
    });

    const res = NextResponse.json({
      tape: {
        id: picked.id,
        tag: picked.tag,
        tagDisplayName: tagMeta?.label ?? picked.tag,
        durationSeconds: picked.duration_seconds,
        audioUrl,
        listenCount: picked.listen_count,
        teaCount: picked.tea_count,
        hasReply: picked.has_reply,
        remainingHours,
      },
    });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không thể nhặt cuộn băng lúc này.",
      },
      { status: 500 }
    );
  }
}
