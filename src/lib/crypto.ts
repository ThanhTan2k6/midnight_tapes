import { createHash } from "node:crypto";

function getRequiredSalt(envVarName: string, devFallback: string): string {
  const value = process.env[envVarName];
  if (value && value.trim().length > 0) {
    return value;
  }

  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return devFallback;
  }

  throw new Error(
    `Missing required environment variable ${envVarName} in ${process.env.NODE_ENV ?? "production"} environment.`
  );
}

/**
 * Băm session_uuid với SERVER_HASH_SALT để tạo creator_hash ẩn danh.
 * Không lưu UUID thô vào database.
 */
export function hashSessionToken(sessionUuid: string): string {
  const salt = getRequiredSalt("SERVER_HASH_SALT", "dev-local-session-salt");
  return createHash("sha256").update(`${sessionUuid}:${salt}`).digest("hex");
}

/**
 * Băm địa chỉ IP với IP_DAILY_SALT để chống spam (Rate Limiting).
 * Tuyệt đối không lưu IP thô và không dùng IP làm khóa mở hộp thư cá nhân.
 */
export function hashClientIp(ip: string): string {
  const salt = getRequiredSalt("IP_DAILY_SALT", "dev-local-ip-salt");
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

/**
 * Trích xuất IP an toàn từ request headers (Cloudflare / Vercel / Proxy).
 */
export function extractClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return headers.get("x-real-ip")?.trim() || "127.0.0.1";
}
