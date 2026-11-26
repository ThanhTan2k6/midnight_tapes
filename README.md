# Midnight Tapes

> *Record a 7-minute anonymous voice confession, release it into the night, and receive a single warm voice reply from a stranger.*  
> **Category:** Interactive Ambient Web App / Ephemeral Audio Social Experience  
> **Stack:** Next.js (App Router), React 19, TypeScript, Web Audio API, Supabase (`pgvector`), Cloudflare R2, Whisper + Gemini 2.5 Flash

---

## 1. Overview

**Midnight Tapes** is an atmospheric, skeuomorphic web application inspired by *"The Stranger Effect"*. Users record anonymous voice notes on a virtual cassette tape (up to 7 minutes) and release them into the midnight queue. A random stranger can pick up the tape, listen, send a virtual cup of warm tea, and leave one heartfelt voice reply—before everything self-destructs after 24 hours.

### Core Design Principles
1. **Single-Turn Exchange (No Back-and-Forth Chat):** No text chat or endless threads—each tape receives at most one voice reply from a stranger.
2. **Zero-Login Anonymity:** No accounts, profiles, or OAuth required. Sessions use an anonymous `session_uuid` paired with hashed IP rate-limiting.
3. **24-Hour Ephemeral Lifecycle:** All tapes, replies, and audio objects are automatically purged after 24 hours via `pg_cron` and storage cleanup.
4. **3-Tier AI Moderation & Crisis RAG:** Audio is transcribed and screened for PII, spam, and harmful content; severe distress triggers a `pgvector` psychological support RAG flow with grounding exercises and helpline resources.

---

## 2. Technical Architecture & Highlights

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router), React 19, Tailwind CSS | Responsive Desktop Wooden Desk & Mobile Walkman views |
| **Animation** | Framer Motion, HTML5 Canvas / SVG | Smooth 60fps spinning cassette reels & tactile mechanics |
| **Audio DSP** | Web Audio API + MediaRecorder | 7-minute recording (Pause/Resume), warm pitch-shift voice masking, real-time VU meter |
| **Audio Format** | `.webm` / `.opus` (`.mp4` fallback for iOS) | Lightweight compression (~240KB/min) |
| **Database** | PostgreSQL (Supabase) + `pgvector` + `pg_cron` | Metadata, fair-matching queue, vector RAG, automated 24h TTL purge |
| **Object Storage** | Cloudflare R2 | Zero-egress S3-compatible audio storage with presigned upload URLs |
| **AI & Moderation** | Whisper + Gemini 2.5 Flash + `pgvector` | Speech-to-text moderation & crisis support retrieval |

---

## 3. Specifications & Documentation

Detailed engineering specifications are maintained in [`specs/`](./specs/) and [`PROJECT_RULES.md`](./PROJECT_RULES.md):

- [`PROJECT_RULES.md`](./PROJECT_RULES.md) — TypeScript, Web Audio, and AudioWorklet standards
- [`specs/functional-spec.md`](./specs/functional-spec.md) — User journeys and business rules
- [`specs/system-design.md`](./specs/system-design.md) — PostgreSQL schema, fair matching algorithm, 24h TTL
- [`specs/ui-ux-design-system.md`](./specs/ui-ux-design-system.md) — Skeuomorphic cassette UI & ambient sound design
- [`specs/api-spec.md`](./specs/api-spec.md) — REST endpoints and presigned audio upload flows
- [`specs/ai-moderation-spec.md`](./specs/ai-moderation-spec.md) — Whisper + Gemini 2.5 Flash moderation & crisis RAG pipeline
- [`specs/implementation-roadmap.md`](./specs/implementation-roadmap.md) — Phased implementation roadmap (Phase 0–6)

---

## 4. Local Development

```bash
# 1. Clone repository
git clone https://github.com/ThanhTan2k6/midnight_tapes.git
cd midnight_tapes

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Add Supabase, Cloudflare R2, and Gemini API keys

# 4. Run development server
npm run dev
```

---

## 5. Author

- **Author:** Thanh Tan ([@ThanhTan2k6](https://github.com/ThanhTan2k6)) — *Full-Stack & AI Systems Developer*
