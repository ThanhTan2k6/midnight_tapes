import {
  PSYCH_KNOWLEDGE_BASE,
  VIETNAM_CRISIS_HOTLINES,
  type PsychKnowledgeChunk,
} from "@/data/psych-knowledge";
import { getSupabaseAdmin } from "./supabase";
import {
  callGeminiGenerateContent,
  embedTextWithGemini,
  getGeminiApiKeys,
} from "./gemini";
import type { RagSupportPayload } from "@/types/tape";

function fallbackLocalRetrieval(
  query: string,
  severity: "HEAVY_DISTRESS" | "CRISIS"
): PsychKnowledgeChunk[] {
  if (severity === "CRISIS") {
    return [
      PSYCH_KNOWLEDGE_BASE[4],
      PSYCH_KNOWLEDGE_BASE[0],
      PSYCH_KNOWLEDGE_BASE[1],
    ];
  }

  const lower = query.toLowerCase();
  const scored = PSYCH_KNOWLEDGE_BASE.map((chunk) => {
    const hits = chunk.keywords.reduce(
      (acc, kw) => (lower.includes(kw) ? acc + 1 : acc),
      0
    );
    return { chunk, hits };
  }).sort((a, b) => b.hits - a.hits);

  return scored.slice(0, 3).map((s) => s.chunk);
}

/**
 * Pipeline RAG Sơ cứu tâm lý (Psychological First Aid):
 * 1. Embed nội dung tâm sự bằng gemini-embedding-001 (768d)
 * 2. Truy xuất Top-3 tri thức từ pgvector (fallback local nếu DB chưa seed)
 * 3. Tổng hợp "Lá thư ủi an từ Gác Đêm" bằng gemini-2.5-flash với ràng buộc an toàn y khoa
 */
export async function generatePsychSupport(params: {
  transcript: string;
  distressKeywords: string[];
  severity: "HEAVY_DISTRESS" | "CRISIS";
}): Promise<RagSupportPayload> {
  const query = `${params.distressKeywords.join(" ")} ${params.transcript.slice(0, 400)}`.trim();

  let retrievedChunks: Array<{
    title: string;
    content: string;
    exerciseType: RagSupportPayload["exerciseType"];
  }> = [];

  // 1. Try pgvector retrieval first
  const embedding = await embedTextWithGemini(query);
  if (embedding) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.rpc("match_psych_chunks", {
        query_embedding: `[${embedding.join(",")}]`,
        match_count: 3,
      });

      if (Array.isArray(data) && data.length > 0) {
        retrievedChunks = data.map((row) => ({
          title: String(row.title),
          content: String(row.content),
          exerciseType:
            (row.exercise_type as RagSupportPayload["exerciseType"]) ||
            "BREATHING_478",
        }));
      }
    } catch {
      // Fallback gracefully below
    }
  }

  // 2. Fallback to vetted local PFA chunks if pgvector is empty or unseeded
  if (retrievedChunks.length === 0) {
    retrievedChunks = fallbackLocalRetrieval(query, params.severity).map(
      (c) => ({
        title: c.title,
        content: c.content,
        exerciseType: c.exerciseType,
      })
    );
  }

  const chosenExercise: RagSupportPayload["exerciseType"] =
    params.severity === "CRISIS"
      ? "HOTLINE_ONLY"
      : retrievedChunks[0]?.exerciseType || "BREATHING_478";

  // 3. Synthesize empathetic grounded letter with Gemini key pool + fallback
  if (getGeminiApiKeys().length > 0) {
    try {
      const contextText = retrievedChunks
        .map((c, idx) => `[${idx + 1}] ${c.title}: ${c.content}`)
        .join("\n");

      const systemPrompt = `Bạn là Người Gác Đêm tại "Tiệm Băng Nửa Đêm". Hãy viết một "Lá thư ủi an" ngắn (110-160 chữ) bằng tiếng Việt ấm áp, chân thành, không phán xét, dựa trên các kiến thức Sơ cứu tâm lý sau:

${contextText}

RÀNG BUỘC AN TOÀN BẮT BUỘC:
- KHÔNG tự xưng là bác sĩ, chuyên gia trị liệu hay nhà tâm lý.
- KHÔNG chẩn đoán bệnh ("bạn bị trầm cảm", "bạn bị rối loạn...") và KHÔNG khuyên dùng thuốc.
- Phản chiếu sự lắng nghe dịu dàng, gợi ý nhẹ bài tập điều hòa cơ thể trong ngữ cảnh trên${params.severity === "CRISIS" ? " và nhấn mạnh họ không đơn độc, hãy gọi ngay tổng đài hỗ trợ bên dưới" : ""}.`;

      const res = await callGeminiGenerateContent({
        models: ["gemini-3-flash-preview", "gemini-3.1-flash-lite"],
        body: {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${systemPrompt}\n\nTâm sự của người dùng: "${params.transcript.slice(0, 1200)}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 320,
          },
        },
      });

      if (res && res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return {
            letter: text,
            exerciseType: chosenExercise,
            hotlines: VIETNAM_CRISIS_HOTLINES,
          };
        }
      }
    } catch {
      // Fall through to grounded deterministic letter
    }
  }

  // Deterministic empathetic fallback if GEMINI_API_KEY is missing or offline
  const fallbackLetter =
    params.severity === "CRISIS"
      ? "Đêm nay có thể thật dài và nặng nề với bạn, nhưng xin đừng gồng gánh một mình trong im lặng. Nỗi đau hiện tại không định nghĩa giá trị của bạn. Hãy tạm gác lại mọi quyết định nặng nề trong đêm nay, giữ khoảng cách với các vật có thể gây thương tích, và liên hệ người thân tin cậy hoặc gọi 115 nếu cần hỗ trợ khẩn cấp ban đêm. Nếu ở trong khung giờ hoạt động, bạn có thể gọi Đường dây nóng Ngày Mai 096 306 1414 (13:00–20:30, Thứ 4 – Chủ Nhật); với trẻ em và thanh thiếu niên cần hỗ trợ ngay ban đêm, Tổng đài Quốc gia 111 trực 24/24."
      : "Tiệm băng đã lắng nghe hết những điều nặng trĩu bạn vừa gửi gắm. Có những giai đoạn cuộc sống dồn nén khiến mình thấy kiệt sức và đơn độc, nhưng bạn không cần phải giải quyết tất cả ngay trong đêm nay. Hãy thử thả lỏng hai vai, nhấp một ngụm nước ấm và thực hành vài nhịp thở chậm 4-7-8 cùng Gác Đêm nhé.";

  return {
    letter: fallbackLetter,
    exerciseType: chosenExercise,
    hotlines: VIETNAM_CRISIS_HOTLINES,
  };
}
