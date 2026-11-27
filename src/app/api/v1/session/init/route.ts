import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  let activeTapesCount = 0;
  let hasUnreadReply = false;
  let totalTeaCount = 0;
  let snapshotValid = false;

  try {
    const supabase = getSupabaseAdmin();
    const { data: tapes, error: tapesErr } = await supabase
      .from("tapes")
      .select("id, tea_count")
      .eq("creator_hash", actor.userHash)
      .gt("expires_at", new Date().toISOString());

    if (tapesErr) {
      throw tapesErr;
    }

    if (tapes && tapes.length > 0) {
      activeTapesCount = tapes.length;
      totalTeaCount = tapes.reduce((sum, t) => sum + (t.tea_count ?? 0), 0);
      const tapeIds = tapes.map((t) => t.id);

      const { count, error: repliesErr } = await supabase
        .from("tape_replies")
        .select("id", { count: "exact", head: true })
        .in("tape_id", tapeIds)
        .eq("status", "ACTIVE")
        .eq("is_listened", false);

      if (repliesErr) {
        throw repliesErr;
      }

      hasUnreadReply = (count ?? 0) > 0;
    }

    snapshotValid = true;
  } catch {
    snapshotValid = false;
  }

  const res = NextResponse.json({
    status: "success",
    token: actor.token,
    snapshotValid,
    activeTapesCount,
    hasUnreadReply,
    totalTeaCount,
  });

  return attachSessionCookie(res, actor.token);
}
