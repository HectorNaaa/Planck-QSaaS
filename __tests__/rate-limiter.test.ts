/**
 * __tests__/rate-limiter.test.ts
 * Verifies the real payload-size fix: the enforced limit matches the
 * documented 1MB, and the byte-limited reader counts actual received bytes
 * (never trusting a Content-Length header) before JSON.parse.
 */
import { describe, it, expect } from "vitest"
import { RATE_LIMITER_MAX_PAYLOAD_BYTES, readJsonWithByteLimit, validatePayloadSize } from "@/lib/rate-limiter"

describe("rate-limiter — real 1MB payload limit", () => {
  it("exports the documented 1MB limit (previously mismatched at 100MB)", () => {
    expect(RATE_LIMITER_MAX_PAYLOAD_BYTES).toBe(1024 * 1024)
  })

  it("validatePayloadSize rejects a payload over 1MB", () => {
    expect(validatePayloadSize({ data: "x".repeat(2 * 1024 * 1024) })).toBe(false)
  })

  it("readJsonWithByteLimit rejects a body exceeding the real byte limit", async () => {
    const bigBody = JSON.stringify({ data: "x".repeat(2 * 1024 * 1024) })
    const req = new Request("http://localhost/test", { method: "POST", body: bigBody })
    const result = await readJsonWithByteLimit(req, 1024 * 1024)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(413)
  })

  it("readJsonWithByteLimit accepts and parses a body within the limit", async () => {
    const req = new Request("http://localhost/test", { method: "POST", body: JSON.stringify({ hello: "world" }) })
    const result = await readJsonWithByteLimit(req, 1024 * 1024)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ hello: "world" })
  })

  it("returns 400 for malformed JSON within size limits (not a silent crash)", async () => {
    const req = new Request("http://localhost/test", { method: "POST", body: "{not valid json" })
    const result = await readJsonWithByteLimit(req, 1024 * 1024)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })
})
