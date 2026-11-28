import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePsychSupport } from "@/lib/psych-rag";
import { TAPE_TAGS, type RagSupportPayload } from "@/types/tape";

/**
 * Tạo hoặc trả về (đã cache) "Lá thư từ Chủ tiệm" (Psych-RAG) khi người gửi
 * vẫn thấy nặng lòng sau khi nghe hồi âm hoặc muốn nhận góc nhìn Sơ cứu tâm lý.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = resolveAnonymousActor(request);
  const { id: tapeId } = await context.params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: tape, error } = await supabase
      .from("tapes")
      .select("id, creator_hash, tag, severity, status, rag_support_payload")
      .eq("id", tapeId)
      .single();

    if (error || !tape) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộn băng này." },
        { status: 404 }
      );
    }

    if (tape.creator_hash !== actor.userHash) {
      return NextResponse.json(
        { error: "Bạn không có quyền mở thư của cuộn băng này." },
        { status: 403 }
      );
    }

    if (tape.rag_support_payload) {
      const res = NextResponse.json({
        ragSupport: tape.rag_support_payload as RagSupportPayload,
        cached: true,
      });
      return attachSessionCookie(res, actor.token);
    }

    const { data: log } = await supabase
      .from("moderation_logs")
      .select("transcript")
      .eq("target_id", tapeId)
      .eq("target_type", "TAPE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tagLabel =
      TAPE_TAGS.find((t) => t.id === tape.tag)?.label || tape.tag;
    const transcript =
      log?.transcript?.trim() || `Tâm sự đêm muộn về chủ đề: ${tagLabel}.`;

    const ragSupport = await generatePsychSupport({
      transcript,
      distressKeywords: [tagLabel, String(tape.tag)],
      severity: tape.severity === "CRISIS" ? "CRISIS" : "HEAVY_DISTRESS",
    });

    await supabase
      .from("tapes")
      .update({ rag_support_payload: ragSupport })
      .eq("id", tapeId);

    const res = NextResponse.json({ ragSupport, cached: false });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Không thể mở thư từ Chủ tiệm lúc này.",
      },
      { status: 500 }
    );
  }
}
