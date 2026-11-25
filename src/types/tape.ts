export type TapeTag =
  | "FINANCE"
  | "QUARTER_LIFE"
  | "FAMILY"
  | "LONELY"
  | "LOVE";

export type TapeStatus = "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "EXPIRED";

export type SeverityTier = "NORMAL" | "HEAVY_DISTRESS" | "CRISIS";

export interface RagSupportPayload {
  letter: string;
  exerciseType: "BREATHING_478" | "GROUNDING_54321" | "HOTLINE_ONLY";
  hotlines: { name: string; number: string }[];
}

export interface TapeTagMeta {
  id: TapeTag;
  label: string;
  shortTag: string;
}

export const TAPE_TAGS: TapeTagMeta[] = [
  { id: "FINANCE", label: "Cơm áo gạo tiền", shortTag: "#CơmÁoGạoTiền" },
  { id: "QUARTER_LIFE", label: "Chông chênh tuổi 20s", shortTag: "#ChôngChênh" },
  { id: "FAMILY", label: "Gia đình & Người lớn", shortTag: "#GiaĐình" },
  { id: "LONELY", label: "Một mình (Cô đơn)", shortTag: "#MộtMình" },
  { id: "LOVE", label: "Chuyện tình dở dang", shortTag: "#ChuyệnTình" },
];

export const AUDIO_CONSTRAINTS = {
  MIN_DURATION_SECONDS: 5,
  MAX_TAPE_DURATION_SECONDS: 420, // 7 phút
  MAX_REPLY_DURATION_SECONDS: 180, // 3 phút
  MAX_FILE_SIZE_BYTES: 3 * 1024 * 1024, // 3MB
} as const;
