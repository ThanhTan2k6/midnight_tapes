"use client";

import type {
  RagSupportPayload,
  SeverityTier,
  TapeStatus,
  TapeTag,
} from "@/types/tape";

const TOKEN_STORAGE_KEY = "mt_anonymous_token";
const LOCAL_LOG_KEY = "mt_sent_tapes_log_v1";

export interface LocalTapeLogEntry {
  id: string;
  tag: TapeTag;
  durationSeconds: number;
  status: TapeStatus | "EXPIRED";
  rejectReason?: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface MailboxTapeItem {
  id: string;
  tag: TapeTag;
  status: TapeStatus;
  rejectReason: string | null;
  durationSeconds: number;
  listenCount: number;
  teaCount: number;
  severity: SeverityTier;
  ragSupport: RagSupportPayload | null;
  reply: {
    id: string;
    audioUrl: string;
    durationSeconds: number;
    isThanked: boolean;
    createdAt: string;
  } | null;
  createdAt: string;
  expiresAt: string;
}

export interface PickedTapeItem {
  id: string;
  tag: TapeTag;
  tagDisplayName: string;
  durationSeconds: number;
  audioUrl: string;
  listenCount: number;
  teaCount: number;
  hasReply: boolean;
  remainingHours: number;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage quota errors
  }
}

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { "X-Anonymous-Token": token } : {};
}

export function getLocalTapeLogs(): LocalTapeLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalTapeLogEntry[];
    // Retain local log entries up to 48h so user sees "Đã tan biến sau 24h" message
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return parsed.filter((item) => new Date(item.createdAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

export function saveLocalTapeLog(entry: LocalTapeLogEntry): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalTapeLogs().filter((i) => i.id !== entry.id);
    const updated = [entry, ...current].slice(0, 12);
    window.localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export async function initSession(): Promise<{
  token: string;
  activeTapesCount: number;
  hasUnreadReply: boolean;
  totalTeaCount: number;
} | null> {
  try {
    const res = await fetch("/api/v1/session/init", {
      method: "POST",
      headers: { ...authHeaders() },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token: string;
      activeTapesCount: number;
      hasUnreadReply: boolean;
      totalTeaCount: number;
    };
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  } catch {
    return null;
  }
}

export async function uploadAndPublishTape(params: {
  blob: Blob;
  durationSeconds: number;
  tag: TapeTag;
  isVoiceMasked: boolean;
}): Promise<{
  id: string;
  status: TapeStatus;
  severity: SeverityTier;
  rejectReason: string | null;
  ragSupport: RagSupportPayload | null;
  message: string;
  expiresAt: string;
}> {
  const contentType = (params.blob.type || "audio/webm").split(";")[0];

  // 1. Get Presigned R2 PUT URL
  const preRes = await fetch("/api/v1/tapes/presigned-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      contentType,
      fileSizeBytes: params.blob.size,
      durationSeconds: params.durationSeconds,
    }),
  });

  const preJson = await preRes.json();
  if (!preRes.ok) {
    throw new Error(preJson.error || "Không thể khởi tạo tải lên.");
  }

  // 2. Upload binary directly to Cloudflare R2
  const putRes = await fetch(preJson.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: params.blob,
  });

  if (!putRes.ok) {
    throw new Error("Tải file âm thanh lên kho lưu trữ thất bại.");
  }

  // 3. Publish & run AI Moderation + Psych-RAG
  const pubRes = await fetch("/api/v1/tapes/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      tapeId: preJson.tapeId,
      audioPath: preJson.audioPath,
      durationSeconds: params.durationSeconds,
      tag: params.tag,
      isVoiceMasked: params.isVoiceMasked,
    }),
  });

  const pubJson = await pubRes.json();
  if (!pubRes.ok) {
    throw new Error(pubJson.error || "Không thể phát hành cuộn băng.");
  }

  saveLocalTapeLog({
    id: pubJson.id,
    tag: params.tag,
    durationSeconds: params.durationSeconds,
    status: pubJson.status,
    rejectReason: pubJson.rejectReason,
    createdAt: new Date().toISOString(),
    expiresAt: pubJson.expiresAt,
  });

  return pubJson;
}

export async function pickRandomTape(
  tagFilter: TapeTag | "ALL" = "ALL"
): Promise<PickedTapeItem> {
  const res = await fetch("/api/v1/tapes/pick", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ tagFilter }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Chưa có cuộn băng nào lúc này.");
  }
  return json.tape;
}

export async function reactTeaToTape(tapeId: string): Promise<{
  teaCount: number;
  message: string;
}> {
  const res = await fetch(`/api/v1/tapes/${tapeId}/react-tea`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Không thể gửi tách trà lúc này.");
  }
  return json;
}

export async function uploadAndPublishReply(params: {
  tapeId: string;
  blob: Blob;
  durationSeconds: number;
}): Promise<{ replyId: string; status: string; message: string }> {
  const contentType = (params.blob.type || "audio/webm").split(";")[0];

  const preRes = await fetch(
    `/api/v1/tapes/${params.tapeId}/reply/presigned-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        contentType,
        fileSizeBytes: params.blob.size,
        durationSeconds: params.durationSeconds,
      }),
    }
  );
  const preJson = await preRes.json();
  if (!preRes.ok) {
    throw new Error(preJson.error || "Không thể khởi tạo gửi hồi âm.");
  }

  const putRes = await fetch(preJson.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: params.blob,
  });
  if (!putRes.ok) {
    throw new Error("Tải lời hồi âm lên thất bại.");
  }

  const pubRes = await fetch(`/api/v1/tapes/${params.tapeId}/reply/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      replyId: preJson.replyId,
      audioPath: preJson.audioPath,
      durationSeconds: params.durationSeconds,
    }),
  });
  const pubJson = await pubRes.json();
  if (!pubRes.ok) {
    throw new Error(pubJson.message || pubJson.error || "Không thể gửi hồi âm.");
  }
  return pubJson;
}

export async function fetchMyMailbox(): Promise<MailboxTapeItem[]> {
  const res = await fetch("/api/v1/tapes/my-mailbox", {
    headers: { ...authHeaders() },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Không thể tải nhật ký Gác Đêm.");
  }
  return json.tapes || [];
}

export async function thankReply(replyId: string): Promise<string> {
  const res = await fetch(`/api/v1/tapes/replies/${replyId}/thank`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Không thể gửi lời cảm ơn.");
  }
  return json.message;
}
