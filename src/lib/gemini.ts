const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Trả về danh sách Gemini API key (hỗ trợ GEMINI_API_KEYS phân cách dấu phẩy để xoay vòng khi hết quota).
 */
export function getGeminiApiKeys(): string[] {
  const rawList = [
    ...(process.env.GEMINI_API_KEYS || "").split(","),
    process.env.GEMINI_API_KEY || "",
  ]
    .map((k) => k.trim())
    .filter(Boolean);

  return Array.from(new Set(rawList));
}

/**
 * Gọi Gemini generateContent có xoay vòng API key (khi gặp 429/403) và fallback qua danh sách model.
 */
export async function callGeminiGenerateContent(params: {
  models: string[];
  body: Record<string, unknown>;
}): Promise<Response | null> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return null;

  let lastResponse: Response | null = null;

  for (const model of params.models) {
    for (const key of keys) {
      try {
        const res = await fetch(
          `${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params.body),
          }
        );
        lastResponse = res;
        if (res.ok) return res;
        // Retry next key on rate limit / quota exhaustion; otherwise try next model
        if (res.status !== 429 && res.status !== 403) {
          break;
        }
      } catch {
        // Try next key/model
      }
    }
  }

  return lastResponse;
}

/**
 * Tạo vector embedding 768 chiều bằng gemini-embedding-001 có xoay vòng key.
 */
export async function embedTextWithGemini(text: string): Promise<number[] | null> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return null;

  for (const key of keys) {
    try {
      const res = await fetch(
        `${GEMINI_API_BASE}/models/gemini-embedding-001:embedContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
            outputDimensionality: 768,
          }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { embedding?: { values?: number[] } };
        return data.embedding?.values ?? null;
      }
      if (res.status !== 429 && res.status !== 403) {
        return null;
      }
    } catch {
      // Try next key
    }
  }

  return null;
}
