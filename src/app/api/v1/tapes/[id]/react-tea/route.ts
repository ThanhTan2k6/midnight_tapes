import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logTapeEvent } from "@/lib/events";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = resolveAnonymousActor(request);
  const { id: tapeId } = await context.params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: tape } = await supabase
      .from("tapes")
      .select("id, creator_hash, tea_count, status, expires_at")
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
        { error: "Không thể tự gửi tách trà cho cuộn băng của chính mình." },
        { status: 403 }
      );
    }

    const { error: insertError } = await supabase
      .from("tape_reactions")
      .insert({
        tape_id: tapeId,
        sender_hash: actor.userHash,
      });

    if (insertError) {
      // Unique constraint (already sent tea) -> return idempotent success
      if (insertError.code === "23505") {
        const res = NextResponse.json({
          status: "success",
          teaCount: tape.tea_count,
          message: "Bạn đã gửi tách trà ấm cho cuộn băng này rồi.",
        });
        return attachSessionCookie(res, actor.token);
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const newTeaCount = (tape.tea_count ?? 0) + 1;
    await supabase
      .from("tapes")
      .update({ tea_count: newTeaCount })
      .eq("id", tapeId);

    await logTapeEvent({
      tapeId,
      eventType: "TEA_SENT",
      actorHash: actor.userHash,
    });

    const res = NextResponse.json({
      status: "success",
      teaCount: newTeaCount,
      message: "Tách trà ấm đã được trao đi trong tĩnh lặng.",
    });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không thể gửi tách trà lúc này.",
      },
      { status: 500 }
    );
  }
}
