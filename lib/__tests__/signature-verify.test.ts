import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyStripeSignature,
  verifyGithubSignature,
  verifyTwilioSignature,
} from "@/lib/signature-verify";

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ id: "evt_test", object: "event" });

  function sign(t: number, payload: string) {
    return crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  }

  it("accepts a correctly signed, fresh request", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${sign(t, body)}`;
    expect(verifyStripeSignature(header, body, secret)).toEqual({
      valid: true,
      reason: "Signature valid",
    });
  });

  it("rejects a wrong secret", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${sign(t, body)}`;
    const result = verifyStripeSignature(header, body, "whsec_wrong");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not match/);
  });

  it("rejects a tampered body", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${sign(t, body)}`;
    const result = verifyStripeSignature(header, body + "x", secret);
    expect(result.valid).toBe(false);
  });

  it("rejects a stale timestamp even with a valid signature", () => {
    const t = Math.floor(Date.now() / 1000) - 3600; // 1 hour old
    const header = `t=${t},v1=${sign(t, body)}`;
    const result = verifyStripeSignature(header, body, secret, 300);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/timestamp/);
  });

  it("rejects a missing header", () => {
    expect(verifyStripeSignature(undefined, body, secret).valid).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(verifyStripeSignature("garbage", body, secret).valid).toBe(false);
  });
});

describe("verifyGithubSignature", () => {
  const secret = "github_secret_123";
  const body = JSON.stringify({ action: "opened" });

  function sign(payload: string) {
    return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  }

  it("accepts a correctly signed request", () => {
    expect(verifyGithubSignature(sign(body), body, secret)).toEqual({
      valid: true,
      reason: "Signature valid",
    });
  });

  it("rejects a wrong secret", () => {
    expect(verifyGithubSignature(sign(body), body, "wrong").valid).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifyGithubSignature(sign(body), body + "x", secret).valid).toBe(false);
  });

  it("rejects a header without the sha256= prefix", () => {
    const raw = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyGithubSignature(raw, body, secret).valid).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyGithubSignature(undefined, body, secret).valid).toBe(false);
  });
});

describe("verifyTwilioSignature", () => {
  const authToken = "twilio_auth_token_abc";
  const url = "https://example.com/h/abc123";
  const params = { From: "+15551234567", To: "+15559876543", Body: "hi" };

  function sign(targetUrl: string, formParams: Record<string, string>) {
    let data = targetUrl;
    for (const key of Object.keys(formParams).sort()) data += key + formParams[key];
    return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
  }

  it("accepts a correctly signed request", () => {
    expect(verifyTwilioSignature(sign(url, params), url, params, authToken)).toEqual({
      valid: true,
      reason: "Signature valid",
    });
  });

  it("rejects a wrong auth token", () => {
    expect(verifyTwilioSignature(sign(url, params), url, params, "wrong").valid).toBe(false);
  });

  it("rejects a mismatched URL (e.g. http captured vs https configured)", () => {
    const httpUrl = url.replace("https://", "http://");
    expect(verifyTwilioSignature(sign(url, params), httpUrl, params, authToken).valid).toBe(false);
  });

  it("rejects tampered form params", () => {
    const tampered = { ...params, Body: "bye" };
    expect(verifyTwilioSignature(sign(url, params), url, tampered, authToken).valid).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyTwilioSignature(undefined, url, params, authToken).valid).toBe(false);
  });
});
