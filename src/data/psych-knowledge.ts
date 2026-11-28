import type { RagSupportPayload } from "@/types/tape";

export interface PsychKnowledgeChunk {
  topic: string;
  title: string;
  content: string;
  exerciseType: RagSupportPayload["exerciseType"];
  keywords: string[];
}

export const VIETNAM_CRISIS_HOTLINES: RagSupportPayload["hotlines"] = [
  {
    name: "Đường dây nóng Ngày Mai (13:00–20:30, Thứ 4 – CN)",
    number: "0963061414",
  },
  {
    name: "Tổng đài Quốc gia 111 (24/24, Bảo vệ Trẻ em & Thanh thiếu niên)",
    number: "111",
  },
];

export const PSYCH_KNOWLEDGE_BASE: PsychKnowledgeChunk[] = [
  {
    topic: "PANIC_BREATHING",
    title: "Kỹ thuật điều hòa nhịp thở 4-7-8 khi tim đập nhanh và ngột ngạt",
    exerciseType: "BREATHING_478",
    keywords: ["khó thở", "hoảng", "sợ", "run", "ngột ngạt", "tim đập", "lo âu", "áp lực"],
    content:
      "Khi cơ thể căng thẳng tột độ, hệ thần kinh giao cảm kích hoạt phản ứng chiến-hay-chạy. Hít vào êm qua mũi 4 giây, giữ hơi nhẹ nhàng 7 giây, rồi thở ra chậm rãi qua miệng 8 giây (lặp lại 4 chu kỳ) giúp kích hoạt dây thần kinh phế vị, làm chậm nhịp tim và gửi tín hiệu an toàn về não bộ.",
  },
  {
    topic: "GROUNDING_OVERWHELM",
    title: "Bài tập tiếp đất 5-4-3-2-1 khi suy nghĩ quay cuồng",
    exerciseType: "GROUNDING_54321",
    keywords: ["rối", "quay cuồng", "bế tắc", "không thoát", "suy nghĩ", "mất ngủ", "chông chênh"],
    content:
      "Kỹ thuật tiếp đất 5-4-3-2-1 kéo tâm trí khỏi vòng xoáy suy nghĩ về lại hiện tại: gọi tên 5 vật bạn đang nhìn thấy quanh phòng, chạm vào 4 bề mặt có kết cấu khác nhau (mặt bàn, áo, ly nước), lắng nghe 3 âm thanh nhỏ nhất lúc này, nhận biết 2 mùi hương thoảng qua, và cảm nhận 1 vị trong miệng hoặc hơi ấm của lòng bàn tay.",
  },
  {
    topic: "BURNOUT_FATIGUE",
    title: "Nâng đỡ khi kiệt sức vì cơm áo gạo tiền và kỳ vọng",
    exerciseType: "BREATHING_478",
    keywords: ["kiệt sức", "mệt", "nợ", "tiền", "công việc", "thất nghiệp", "gia đình", "vô dụng"],
    content:
      "Trong Sơ cứu tâm lý (Psychological First Aid), sự kiệt sức kéo dài thường khiến ta đánh đồng giá trị bản thân với năng suất hay thu nhập hiện tại. Đêm nay bạn không cần giải quyết toàn bộ tương lai ngay lập tức; chỉ cần cho phép bản thân hạ vai xuống, uống một ngụm nước ấm và nghỉ ngơi qua đêm nay đã là đủ.",
  },
  {
    topic: "LONELINESS_GRIEF",
    title: "Xoa dịu cảm giác cô đơn và đổ vỡ trong đêm",
    exerciseType: "GROUNDING_54321",
    keywords: ["cô đơn", "một mình", "chia tay", "bỏ rơi", "khóc", "buồn", "không ai hiểu"],
    content:
      "Nỗi đau bị từ chối hay cảm giác lẻ loi lúc nửa đêm thường khuếch đại suy nghĩ rằng sẽ mãi không có ai lắng nghe mình. Thực tế cảm xúc này là sóng chứ không phải trạng thái vĩnh viễn. Việc bạn cất tiếng nói ra thành lời vào cuộn băng đã là một bước tự chăm sóc dũng cảm.",
  },
  {
    topic: "CRISIS_DEESCALATION",
    title: "Đồng hành khẩn cấp khi có ý nghĩ tự làm đau bản thân",
    exerciseType: "HOTLINE_ONLY",
    keywords: ["tự tử", "chết", "kết thúc", "biến mất", "tự hại", "không muốn sống", "rạch tay"],
    content:
      "Khi nỗi đau vượt quá sức chịu đựng khiến con người muốn dừng lại mọi thứ, đó là dấu hiệu bạn cần được một người thật sự có chuyên môn lắng nghe ngay lúc này chứ không phải gánh một mình. Hãy tạm hoãn mọi quyết định trong đêm nay, giữ khoảng cách với vật sắc nhọn, và gọi ngay cho người thân tin cậy hoặc tổng đài miễn phí 096 306 1414 / 111.",
  },
];

const REPLY_PFA_HINTS: Record<string, string> = {
  FINANCE:
    "Gợi ý Sơ cứu tâm lý: Tránh dạy bảo cách kiếm tiền; hãy công nhận sự cố gắng của họ trước áp lực mưu sinh.",
  QUARTER_LIFE:
    "Gợi ý Sơ cứu tâm lý: Đừng vội so sánh hay thúc ép; hãy nhắc họ rằng sự chênh vênh ở tuổi 20s là bình thường.",
  FAMILY:
    "Gợi ý Sơ cứu tâm lý: Lắng nghe không phán xét; tránh đổ lỗi cho họ hay gia đình khi chưa rõ câu chuyện.",
  LONELY:
    "Gợi ý Sơ cứu tâm lý: Sự hiện diện ấm áp quan trọng hơn lời khuyên; hãy để họ thấy đêm nay có người đang lắng nghe.",
  LOVE:
    "Gợi ý Sơ cứu tâm lý: Tránh nói 'có gì đâu mà buồn' hay 'quên đi'; hãy công nhận nỗi buồn chia xa là có thật.",
};

export function getReplyPfaHint(tag?: string): string {
  return (
    (tag && REPLY_PFA_HINTS[tag]) ||
    "Gợi ý Sơ cứu tâm lý: Lắng nghe dịu dàng, công nhận cảm xúc và tránh phán xét hay dạy đời."
  );
}
