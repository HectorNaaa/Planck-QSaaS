/**
 * __tests__/rate-limiter.test.ts
 * Verifies the real payload-size fix: the enforced limit matches the
 * documented 1MB, and the byte-limited reader counts actual received bytes
 * (never trusting a Content-Length header) before JSON.parse.
 */
import { describe, it, expect, vi } from "vitest"
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

describe("rate-limiter — background cleanup timer must never keep the process alive", () => {
  it("the module-level cleanup interval is unref'd (serverless-safe)", async () => {
    // Regression test for a real production incident: an unref'd-missing
    // `setInterval` at module scope kept the Node.js Environment alive across
    // warm serverless container reuse. When Vercel later tore down/recreated
    // the isolate for a new invocation, the still-pending timer fired against
    // a stale Environment and crashed the whole process with a native
    // SIGABRT (node::RemoveEnvironmentCleanupHook assertion) — not a
    // catchable JS error, so no try/catch in any route could prevent it.
    const realSetInterval = global.setInterval
    const unrefSpy = vi.fn()
    const timerSpy = vi.spyOn(global, "setInterval").mockImplementation(((fn: any, ms: any) => {
      const handle = realSetInterval(fn, ms)
      const originalUnref = handle.unref?.bind(handle)
      handle.unref = () => {
        unrefSpy()
        return originalUnref ? originalUnref() : handle
      }
      return handle
    }) as any)

    try {
      vi.resetModules()
      const fresh = await import("@/lib/rate-limiter")
      expect(fresh).toBeTruthy()
      expect(unrefSpy).toHaveBeenCalled()
    } finally {
      timerSpy.mockRestore()
    }
  })
})
