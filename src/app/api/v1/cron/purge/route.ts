import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { deleteAudioObjects } from "@/lib/r2";

const PURGE_BATCH_SIZE = 500;

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Worker dọn dẹp 24h chủ động theo batch (bounded batches):
 * 1. Lấy từng batch tối đa 500 cuộn băng hết hạn
 * 2. Xóa vật lý file audio trên R2 (cả tape và reply liên quan)
 * 3. Redact transcript & pii_detected trong moderation_logs (dừng ngay nếu lỗi)
 * 4. Ghi PURGED_24H vào tape_events & xóa đúng các batch IDs đã dọn xong
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    let totalPurgedTapes = 0;
    let totalR2Deleted = 0;

    while (true) {
      const { data: expiredTapes, error: fetchErr } = await supabase
        .from("tapes")
        .select("id, audio_path, status, listen_count")
        .lt("expires_at", nowIso)
        .limit(PURGE_BATCH_SIZE);

      if (fetchErr) {
        return NextResponse.json(
          { error: `Failed to query expired tapes: ${fetchErr.message}` },
          { status: 500 }
        );
      }

      const batchTapes = expiredTapes || [];
      if (batchTapes.length === 0) break;

      const batchTapeIds = batchTapes.map((t) => t.id);

      const { data: batchReplies, error: replyFetchErr } = await supabase
        .from("tape_replies")
        .select("id, audio_path")
        .in("tape_id", batchTapeIds);

      if (replyFetchErr) {
        return NextResponse.json(
          { error: `Failed to query expired replies: ${replyFetchErr.message}` },
          { status: 500 }
        );
      }

      const replyRows = batchReplies || [];
      const objectKeys = [
        ...batchTapes.map((t) => t.audio_path),
        ...replyRows.map((r) => r.audio_path),
      ].filter(Boolean);

      if (objectKeys.length > 0) {
        totalR2Deleted += await deleteAudioObjects(objectKeys);
      }

      const targetIds = [...batchTapeIds, ...replyRows.map((r) => r.id)];

      // Redact sensitive moderation fields & abort before deleting tapes if this fails
      const { error: redactErr } = await supabase
        .from("moderation_logs")
        .update({ transcript: null, pii_detected: null })
        .in("target_id", targetIds);

      if (redactErr) {
        return NextResponse.json(
          {
            error: `Moderation redaction failed; tapes preserved for retry: ${redactErr.message}`,
          },
          { status: 500 }
        );
      }

      const { error: eventErr } = await supabase.from("tape_events").insert(
        batchTapes.map((t) => ({
          tape_id: t.id,
          event_type: "PURGED_24H",
          metadata: { status: t.status, listen_count: t.listen_count },
        }))
      );

      if (eventErr) {
        return NextResponse.json(
          { error: `Failed to record PURGED_24H events: ${eventErr.message}` },
          { status: 500 }
        );
      }

      // Delete ONLY the exact batch IDs whose R2 cleanup & redaction succeeded
      const { error: deleteErr } = await supabase
        .from("tapes")
        .delete()
        .in("id", batchTapeIds);

      if (deleteErr) {
        return NextResponse.json(
          { error: `Failed to delete purged batch: ${deleteErr.message}` },
          { status: 500 }
        );
      }

      totalPurgedTapes += batchTapes.length;

      if (batchTapes.length < PURGE_BATCH_SIZE) {
        break;
      }
    }

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [{ error: modCleanErr }, { error: evtCleanErr }] = await Promise.all([
      supabase.from("moderation_logs").delete().lt("created_at", sevenDaysAgo),
      supabase.from("tape_events").delete().lt("created_at", sevenDaysAgo),
    ]);

    if (modCleanErr || evtCleanErr) {
      return NextResponse.json(
        {
          error:
            modCleanErr?.message ||
            evtCleanErr?.message ||
            "Failed to purge 7-day logs.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      purgedTapes: totalPurgedTapes,
      r2DeletedCount: totalR2Deleted,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Cron purge failed.",
      },
      { status: 500 }
    );
  }
}
