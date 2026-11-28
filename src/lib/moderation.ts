import { fetchAudioBytesFromR2 } from "./r2";
import { getSupabaseAdmin } from "./supabase";
import { logTapeEvent } from "./events";
import { generatePsychSupport } from "./psych-rag";
import type { RagSupportPayload, SeverityTier, TapeStatus } from "@/types/tape";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const PII_REGEX_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  {
    label: "PHONE_VN",
    regex: /(?:\+?84|0)(?:[\s.\-]*\d){8,10}\b/g,
  },
  {
    label: "URL",
    regex: /(?:https?:\/\/|www\.)[^\s]+/gi,
  },
  {
    label: "SOCIAL_HANDLE",
    regex: /\b(?:zalo|telegram|tele|facebook|fb\.com|ig|tiktok)\b\s*[:@]?\s*[a-z0-9._-]{3,}/gi,
  },
];

export function scanTextForPii(text: string): string[] {
  const hits: string[] = [];
  for (const { label, regex } of PII_REGEX_PATTERNS) {
    if (regex.test(text)) {
      hits.push(label);
    }
    regex.lastIndex = 0;
  }
  return hits;
}

export interface ModerationOutcome {
  status: TapeStatus;
  severity: SeverityTier;
  rejectReason: string | null;
  ragSupport: RagSupportPayload | null;
}

type Verdict = "PASS" | "HEAVY_DISTRESS" | "CRISIS" | "REJECT";
const VALID_VERDICTS = new Set<Verdict>([
  "PASS",
  "HEAVY_DISTRESS",
  "CRISIS",
  "REJECT",
]);

interface GeminiModerationJson {
  transcript?: string;
  verdict?: string;
  reason?: string;
  category?: string;
  distressKeywords?: string[];
  confidenceScore?: number;
}

/**
 * Pipeline kiểm duyệt AI + Psych-RAG:
 * - Chỉ kích hoạt ACTIVE khi có kết quả kiểm duyệt hợp lệ từ Gemini + PII Regex.
 * - Nếu thiếu cấu hình, không tải được audio, hoặc Gemini lỗi -> giữ nguyên PENDING_REVIEW (chưa phát hành).
 */
export async function runModerationPipeline(params: {
  targetId: string;
  targetType: "TAPE" | "REPLY";
  audioPath: string;
  actorHash: string;
}): Promise<ModerationOutcome> {
  const supabase = getSupabaseAdmin();
  const apiKey = process.env.GEMINI_API_KEY;

  let transcript = "";
  let validatedVerdict: Verdict | null = null;
  let rejectReason: string | null = null;
  let toxicityScore = 0;
  let distressKeywords: string[] = [];

  if (apiKey) {
    const audioFile = await fetchAudioBytesFromR2(params.audioPath);
    if (audioFile) {
      try {
        const base64Audio = Buffer.from(audioFile.bytes).toString("base64");
        const prompt = `Bạn là Người Gác Đêm tại "Tiệm Băng Nửa Đêm". Hãy nghe đoạn ghi âm tiếng Việt đính kèm, bóc băng chính xác (transcript) và phân loại an toàn.

QUY TẮC CẤM (REJECT):
1. PII: Số điện thoại, link mạng xã hội (Facebook, Zalo, Telegram, TikTok), địa chỉ nhà, STK ngân hàng.
2. TOXICITY: Chửi bới xúc phạm người khác, phân biệt vùng miền, thù ghét, đe dọa.
3. SOLICITATION: Gạ gẫm hẹn hò, mại dâm, cờ bạc, đa cấp, vay nợ.

PHÂN LOẠI MỨC ĐỘ:
- PASS: Tâm sự, than thở áp lực, buồn bã thông thường, lời ủi an chân thành.
- HEAVY_DISTRESS: Kiệt sức tinh thần nặng, bế tắc sâu sắc, khóc nức nở, cảm giác vô vọng (nhưng chưa có ý định tự hại).
- CRISIS: Có dấu hiệu hoặc ý định tự làm đau bản thân, tự tử.
- REJECT: Vi phạm PII, TOXICITY hoặc SOLICITATION.

Trả về DUY NHẤT JSON hợp lệ:
{
  "transcript": "nội dung nghe được",
  "verdict": "PASS" | "HEAVY_DISTRESS" | "CRISIS" | "REJECT",
  "reason": "lý do ngắn gọn bằng tiếng Việt nếu REJECT, ngược lại rỗng",
  "category": "NONE" | "PII" | "TOXICITY" | "SOLICITATION" | "HEAVY_DEPRESSION" | "SELF_HARM",
  "distressKeywords": ["từ khóa tâm lý nếu có"],
  "confidenceScore": 0.9
}`;

        let res: Response | null = null;
        for (const model of ["gemini-3-flash-preview", "gemini-3.1-flash-lite"]) {
          const attempt = await fetch(
            `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      { text: prompt },
                      {
                        inlineData: {
                          mimeType: audioFile.contentType.split(";")[0],
                          data: base64Audio,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.1,
                },
              }),
            }
          );
          res = attempt;
          if (attempt.ok) break;
        }

        if (res && res.ok) {
          const json = (await res.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText) as GeminiModerationJson;
            if (
              typeof parsed.transcript === "string" &&
              typeof parsed.verdict === "string" &&
              VALID_VERDICTS.has(parsed.verdict as Verdict)
            ) {
              transcript = parsed.transcript;
              validatedVerdict = parsed.verdict as Verdict;
              rejectReason = parsed.reason || null;
              toxicityScore =
                typeof parsed.confidenceScore === "number"
                  ? parsed.confidenceScore
                  : 0;
              distressKeywords = Array.isArray(parsed.distressKeywords)
                ? parsed.distressKeywords
                : [];
            }
          }
        }
      } catch {
        // Keep validatedVerdict = null so audio stays PENDING_REVIEW
      }
    }
  }

  // Deterministic Regex PII double-check
  const piiHits = scanTextForPii(transcript);
  if (piiHits.length > 0) {
    validatedVerdict = "REJECT";
    rejectReason =
      "Cuộn băng có chứa thông tin liên hệ cá nhân (số điện thoại hoặc liên kết). Để giữ an toàn ẩn danh, tiệm xin phép không phát hành cuộn băng này.";
  }

  // Never activate without a validated moderation decision
  if (!validatedVerdict) {
    await supabase.from("moderation_logs").insert({
      target_id: params.targetId,
      target_type: params.targetType,
      transcript: transcript || null,
      pii_detected: null,
      toxicity_score: 0,
      verdict: "UNAVAILABLE",
      reject_reason: "Moderation service unavailable; kept in PENDING_REVIEW.",
    });

    return {
      status: "PENDING_REVIEW",
      severity: "NORMAL",
      rejectReason: null,
      ragSupport: null,
    };
  }

  let finalStatus: TapeStatus = "ACTIVE";
  let severity: SeverityTier = "NORMAL";
  let ragSupport: RagSupportPayload | null = null;

  if (validatedVerdict === "REJECT") {
    finalStatus = "REJECTED";
    rejectReason =
      rejectReason ||
      "Nội dung cuộn băng chưa phù hợp với quy tắc an toàn của Tiệm Băng Nửa Đêm.";
  } else if (validatedVerdict === "HEAVY_DISTRESS") {
    severity = "HEAVY_DISTRESS";
    finalStatus = "ACTIVE";
    if (params.targetType === "TAPE") {
      ragSupport = await generatePsychSupport({
        transcript,
        distressKeywords,
        severity: "HEAVY_DISTRESS",
      });
    }
  } else if (validatedVerdict === "CRISIS") {
    severity = "CRISIS";
    // CRISIS tapes are NEVER picked in pick_random_tape (guarded by severity != 'CRISIS')
    finalStatus = "ACTIVE";
    if (params.targetType === "TAPE") {
      ragSupport = await generatePsychSupport({
        transcript,
        distressKeywords,
        severity: "CRISIS",
      });
    }
  }

  // Record moderation log
  const { error: logErr } = await supabase.from("moderation_logs").insert({
    target_id: params.targetId,
    target_type: params.targetType,
    transcript: transcript || null,
    pii_detected: piiHits.length > 0 ? piiHits : null,
    toxicity_score: toxicityScore,
    verdict: validatedVerdict,
    reject_reason: rejectReason,
  });

  if (logErr) {
    throw new Error(`Không thể lưu log kiểm duyệt: ${logErr.message}`);
  }

  // Update target table & verify persistence
  if (params.targetType === "TAPE") {
    const { error: updateErr } = await supabase
      .from("tapes")
      .update({
        status: finalStatus,
        severity,
        reject_reason: rejectReason,
        rag_support_payload: ragSupport,
      })
      .eq("id", params.targetId);

    if (updateErr) {
      throw new Error(`Không thể cập nhật trạng thái băng: ${updateErr.message}`);
    }
  } else {
    const { error: updateErr } = await supabase
      .from("tape_replies")
      .update({ status: finalStatus })
      .eq("id", params.targetId);

    if (updateErr) {
      throw new Error(`Không thể cập nhật trạng thái hồi âm: ${updateErr.message}`);
    }
  }

  // Audit event
  await logTapeEvent({
    tapeId: params.targetId,
    actorHash: params.actorHash,
    eventType:
      finalStatus === "REJECTED"
        ? "MOD_REJECT"
        : ragSupport
        ? "RAG_TRIGGERED"
        : "MOD_PASS",
    metadata: { targetType: params.targetType, severity, piiHits },
  });

  return {
    status: finalStatus,
    severity,
    rejectReason,
    ragSupport,
  };
}
