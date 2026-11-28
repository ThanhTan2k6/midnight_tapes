import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const [{ count: activeTapes }, { count: unlistenedTapes }] =
      await Promise.all([
        supabase
          .from("tapes")
          .select("id", { count: "exact", head: true })
          .eq("status", "ACTIVE")
          .neq("severity", "CRISIS")
          .gt("expires_at", nowIso),
        supabase
          .from("tapes")
          .select("id", { count: "exact", head: true })
          .eq("status", "ACTIVE")
          .neq("severity", "CRISIS")
          .eq("listen_count", 0)
          .gt("expires_at", nowIso),
      ]);

    return NextResponse.json({
      activeTapes: activeTapes ?? 0,
      unlistenedTapes: unlistenedTapes ?? 0,
    });
  } catch {
    return NextResponse.json({
      activeTapes: 0,
      unlistenedTapes: 0,
    });
  }
}
