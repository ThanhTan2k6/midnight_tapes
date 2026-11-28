import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, resolveAnonymousActor } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const VALID_CATEGORIES = new Set(["BUG_AUDIO_UI", "BUG_RECORD_PLAY", "SUGGESTION"]);

export async function POST(request: NextRequest) {
  const actor = resolveAnonymousActor(request);

  let body: {
    category?: string;
    message?: string;
    contact?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 }
    );
  }

  const category = VALID_CATEGORIES.has(body.category || "")
    ? (body.category as string)
    : "BUG_AUDIO_UI";
  const message = (body.message || "").trim();
  const contact = (body.contact || "").trim().slice(0, 120);
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 240);

  if (message.length < 5 || message.length > 600) {
    return NextResponse.json(
      { error: "Nội dung báo lỗi/góp ý cần từ 5 đến 600 ký tự." },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    // Try dedicated bug_reports table first; fallback to tape_events if migration 0004 hasn't been run yet
    const { error: insertErr } = await supabase.from("bug_reports").insert({
      actor_hash: actor.userHash,
      category,
      message,
      contact: contact || null,
      user_agent: userAgent || null,
    });

    if (insertErr) {
      const { error: fallbackErr } = await supabase.from("tape_events").insert({
        tape_id: "00000000-0000-0000-0000-000000000000",
        actor_hash: actor.userHash,
        event_type: "BUG_REPORT",
        metadata: {
          category,
          message,
          contact: contact || null,
          userAgent: userAgent || null,
        },
      });
      if (fallbackErr) {
        return NextResponse.json(
          { error: "Không thể lưu phản hồi lúc này." },
          { status: 500 }
        );
      }
    }

    const res = NextResponse.json({
      status: "ok",
      message: "Cảm ơn bạn đã báo lỗi/góp ý! Chủ tiệm đã ghi nhận.",
    });
    return attachSessionCookie(res, actor.token);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không thể gửi phản hồi lúc này.",
      },
      { status: 500 }
    );
  }
}
