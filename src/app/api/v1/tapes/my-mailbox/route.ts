import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAudioPlaybackUrl } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  try {
    const supabase = getSupabaseAdmin();
    const { data: tapes, error } = await supabase
      .from("tapes")
      .select(
        "id, tag, status, reject_reason, duration_seconds, listen_count, tea_count, severity, rag_support_payload, has_reply, created_at, expires_at"
      )
      .eq("creator_hash", actor.userHash)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tapeIds = (tapes || []).map((t) => t.id);
    const repliesByTape = new Map<
      string,
      {
        id: string;
        audioUrl: string;
        durationSeconds: number;
        isThanked: boolean;
        createdAt: string;
      }
    >();

    if (tapeIds.length > 0) {
      const { data: replies } = await supabase
        .from("tape_replies")
        .select("id, tape_id, audio_path, duration_seconds, is_thanked, created_at")
        .in("tape_id", tapeIds)
        .eq("status", "ACTIVE")
        .gt("expires_at", new Date().toISOString());

      if (replies && replies.length > 0) {
        // Mark as listened when mailbox is fetched
        await supabase
          .from("tape_replies")
          .update({ is_listened: true })
          .in(
            "id",
            replies.map((r) => r.id)
          );

        await Promise.all(
          replies.map(async (r) => {
            const audioUrl = await resolveAudioPlaybackUrl(r.audio_path);
            repliesByTape.set(r.tape_id, {
              id: r.id,
              audioUrl,
              durationSeconds: r.duration_seconds,
              isThanked: r.is_thanked,
              createdAt: r.created_at,
            });
          })
        );
      }
    }

    const formatted = (tapes || []).map((t) => ({
      id: t.id,
      tag: t.tag,
      status: t.status,
      rejectReason: t.reject_reason,
      durationSeconds: t.duration_seconds,
      listenCount: t.listen_count,
      teaCount: t.tea_count,
      severity: t.severity,
      ragSupport: t.rag_support_payload,
      reply: repliesByTape.get(t.id) ?? null,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
    }));

    const res = NextResponse.json({ tapes: formatted });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không thể tải nhật ký cuộn băng.",
      },
      { status: 500 }
    );
  }
}
