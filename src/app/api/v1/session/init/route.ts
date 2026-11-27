import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  let activeTapesCount = 0;
  let hasUnreadReply = false;
  let totalTeaCount = 0;

  try {
    const supabase = getSupabaseAdmin();
    const { data: tapes } = await supabase
      .from("tapes")
      .select("id, tea_count")
      .eq("creator_hash", actor.userHash)
      .gt("expires_at", new Date().toISOString());

    if (tapes && tapes.length > 0) {
      activeTapesCount = tapes.length;
      totalTeaCount = tapes.reduce((sum, t) => sum + (t.tea_count ?? 0), 0);
      const tapeIds = tapes.map((t) => t.id);

      const { count } = await supabase
        .from("tape_replies")
        .select("id", { count: "exact", head: true })
        .in("tape_id", tapeIds)
        .eq("status", "ACTIVE")
        .eq("is_listened", false);

      hasUnreadReply = (count ?? 0) > 0;
    }
  } catch {
    // Graceful fallback if Supabase env is not yet configured in local preview
  }

  const res = NextResponse.json({
    status: "success",
    token: actor.token,
    activeTapesCount,
    hasUnreadReply,
    totalTeaCount,
  });

  return attachSessionCookie(res, actor.token);
}
