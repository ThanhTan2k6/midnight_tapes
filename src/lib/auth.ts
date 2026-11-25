import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { extractClientIp, hashClientIp, hashSessionToken } from "./crypto";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SESSION_COOKIE_NAME = "mt_session";

export interface AnonymousActor {
  token: string;
  userHash: string;
  ipHash: string;
  isNew: boolean;
}

/**
 * Xác định danh tính ẩn danh (Zero-Login) từ header `X-Anonymous-Token` hoặc HttpOnly cookie `mt_session`.
 * Nếu chưa có hoặc không hợp lệ, tự động cấp UUIDv4 mới.
 */
export function resolveAnonymousActor(request: NextRequest): AnonymousActor {
  const headerToken = request.headers.get("x-anonymous-token")?.trim();
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();

  const candidate = headerToken || cookieToken;
  const isValid = candidate ? UUID_V4_REGEX.test(candidate) : false;

  const token = isValid && candidate ? candidate : randomUUID();
  const ip = extractClientIp(request.headers);

  return {
    token,
    userHash: hashSessionToken(token),
    ipHash: hashClientIp(ip),
    isNew: !isValid,
  };
}

/**
 * Gắn HttpOnly cookie cho phiên ẩn danh để giữ ổn định khi F5 hoặc chuyển mạng Wi-Fi <-> 4G.
 */
export function attachSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });
  return response;
}
