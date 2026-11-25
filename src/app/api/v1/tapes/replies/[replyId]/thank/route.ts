import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logTapeEvent } from "@/lib/events";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ replyId: string }> }
) {
  const actor = resolveAnonymousActor(request);
  const { replyId } = await context.params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: reply } = await supabase
      .from("tape_replies")
      .select("id, tape_id, is_thanked, tapes!inner(creator_hash, expires_at)")
      .eq("id", replyId)
      .single();

    if (!reply) {
      return NextResponse.json(
        { error: "Không tìm thấy lời hồi âm." },
        { status: 404 }
      );
    }

    const tapeInfo = Array.isArray(reply.tapes) ? reply.tapes[0] : reply.tapes;
    if (
      !tapeInfo ||
      tapeInfo.creator_hash !== actor.userHash ||
      new Date(tapeInfo.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        { error: "Bạn không có quyền cảm ơn lời hồi âm này." },
        { status: 403 }
      );
    }

    if (!reply.is_thanked) {
      await supabase
        .from("tape_replies")
        .update({
          is_thanked: true,
          thanked_at: new Date().toISOString(),
        })
        .eq("id", replyId);

      await logTapeEvent({
        tapeId: reply.tape_id,
        eventType: "THANKED",
        actorHash: actor.userHash,
        metadata: { replyId },
      });
    }

    const res = NextResponse.json({
      status: "success",
      message: "Lời cảm ơn chân thành đã được gửi tới người lạ.",
    });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không thể gửi lời cảm ơn lúc này.",
      },
      { status: 500 }
    );
  }
}
