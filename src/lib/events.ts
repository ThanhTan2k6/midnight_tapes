import { getSupabaseAdmin } from "./supabase";

export type TapeEventType =
  | "UPLOAD_URL_ISSUED"
  | "PUBLISHED"
  | "MOD_PASS"
  | "MOD_REJECT"
  | "RAG_TRIGGERED"
  | "PICKED"
  | "TEA_SENT"
  | "REPLY_SENT"
  | "THANKED"
  | "PURGED_24H";

/**
 * Ghi vết vòng đời cuộn băng vào bảng `tape_events` (không chứa PII, giữ 7 ngày).
 */
export async function logTapeEvent(params: {
  tapeId: string;
  eventType: TapeEventType;
  actorHash?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("tape_events").insert({
      tape_id: params.tapeId,
      event_type: params.eventType,
      actor_hash: params.actorHash ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Audit logging never crashes primary user flows
  }
}
