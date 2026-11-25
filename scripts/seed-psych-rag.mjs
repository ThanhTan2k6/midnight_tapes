/**
 * Seed script: Tạo embedding gemini-embedding-001 (768d) cho kho tri thức Sơ cứu tâm lý
 * và nạp vào bảng `psych_knowledge_chunks` trên Supabase.
 *
 * Chạy: node scripts/seed-psych-rag.mjs
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const KNOWLEDGE_CHUNKS = [
  {
    topic: "PANIC_BREATHING",
    title: "Kỹ thuật điều hòa nhịp thở 4-7-8 khi tim đập nhanh và ngột ngạt",
    exercise_type: "BREATHING_478",
    content:
      "Khi cơ thể căng thẳng tột độ, hệ thần kinh giao cảm kích hoạt phản ứng chiến-hay-chạy. Hít vào êm qua mũi 4 giây, giữ hơi nhẹ nhàng 7 giây, rồi thở ra chậm rãi qua miệng 8 giây (lặp lại 4 chu kỳ) giúp kích hoạt dây thần kinh phế vị, làm chậm nhịp tim và gửi tín hiệu an toàn về não bộ.",
  },
  {
    topic: "GROUNDING_OVERWHELM",
    title: "Bài tập tiếp đất 5-4-3-2-1 khi suy nghĩ quay cuồng",
    exercise_type: "GROUNDING_54321",
    content:
      "Kỹ thuật tiếp đất 5-4-3-2-1 kéo tâm trí khỏi vòng xoáy suy nghĩ về lại hiện tại: gọi tên 5 vật bạn đang nhìn thấy quanh phòng, chạm vào 4 bề mặt có kết cấu khác nhau, lắng nghe 3 âm thanh nhỏ nhất lúc này, nhận biết 2 mùi hương thoảng qua, và cảm nhận 1 hơi ấm của lòng bàn tay.",
  },
  {
    topic: "BURNOUT_FATIGUE",
    title: "Nâng đỡ khi kiệt sức vì cơm áo gạo tiền và kỳ vọng",
    exercise_type: "BREATHING_478",
    content:
      "Trong Sơ cứu tâm lý (Psychological First Aid), sự kiệt sức kéo dài thường khiến ta đánh đồng giá trị bản thân với năng suất hay thu nhập hiện tại. Đêm nay bạn không cần giải quyết toàn bộ tương lai ngay lập tức; chỉ cần hạ vai xuống, uống ngụm nước ấm và nghỉ ngơi qua đêm nay đã là đủ.",
  },
  {
    topic: "LONELINESS_GRIEF",
    title: "Xoa dịu cảm giác cô đơn và đổ vỡ trong đêm",
    exercise_type: "GROUNDING_54321",
    content:
      "Nỗi đau bị từ chối hay cảm giác lẻ loi lúc nửa đêm thường khuếch đại suy nghĩ rằng sẽ mãi không có ai lắng nghe mình. Thực tế cảm xúc này là sóng chứ không phải trạng thái vĩnh viễn. Việc bạn cất tiếng nói ra thành lời vào cuộn băng đã là một bước tự chăm sóc dũng cảm.",
  },
  {
    topic: "CRISIS_DEESCALATION",
    title: "Đồng hành khẩn cấp khi có ý nghĩ tự làm đau bản thân",
    exercise_type: "HOTLINE_ONLY",
    content:
      "Khi nỗi đau vượt quá sức chịu đựng khiến con người muốn dừng lại mọi thứ, đó là dấu hiệu bạn cần được một người có chuyên môn lắng nghe ngay lúc này. Hãy tạm hoãn mọi quyết định trong đêm nay, giữ khoảng cách với vật sắc nhọn, và gọi ngay tổng đài miễn phí 096 306 1414 hoặc 111.",
  },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !serviceKey || !geminiKey) {
    console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY hoặc GEMINI_API_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  for (const chunk of KNOWLEDGE_CHUNKS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: `${chunk.title}\n${chunk.content}` }] },
          outputDimensionality: 768,
        }),
      }
    );

    if (!res.ok) {
      console.error("Embedding failed for:", chunk.topic, await res.text());
      continue;
    }

    const data = await res.json();
    const values = data.embedding?.values;
    if (!values) continue;

    const { error } = await supabase.from("psych_knowledge_chunks").insert({
      topic: chunk.topic,
      title: chunk.title,
      content: chunk.content,
      exercise_type: chunk.exercise_type,
      embedding: `[${values.join(",")}]`,
    });

    if (error) {
      console.error("Insert failed for:", chunk.topic, error.message);
    } else {
      console.log("Seeded chunk:", chunk.topic);
    }
  }
}

main();
