import crypto from "node:crypto";

export type VerifyResult = { valid: boolean; reason: string };

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Stripe: `Stripe-Signature: t=<unix ts>,v1=<hex hmac-sha256>[,v0=...]`
 * computed over `${t}.${rawBody}`. https://docs.stripe.com/webhooks#verify-manually
 */
export function verifyStripeSignature(
  header: string | undefined,
  rawBody: string,
  secret: string,
  toleranceSeconds = 300
): VerifyResult {
  if (!header) return { valid: false, reason: "Missing Stripe-Signature header" };

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) {
    return { valid: false, reason: "Malformed header — expected t=...,v1=..." };
  }

  const tsNum = Number(t);
  if (!Number.isFinite(tsNum)) {
    return { valid: false, reason: "Invalid timestamp in signature" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const matches = timingSafeEqualHex(expected, v1);
  const ageSeconds = Math.abs(Date.now() / 1000 - tsNum);

  if (!matches) {
    return {
      valid: false,
      reason: "Signature does not match — wrong secret, or the body was modified after signing",
    };
  }
  if (ageSeconds > toleranceSeconds) {
    return {
      valid: false,
      reason: `Signature matches, but the timestamp is ${Math.round(ageSeconds)}s old (tolerance is ${toleranceSeconds}s)`,
    };
  }
  return { valid: true, reason: "Signature valid" };
}

/**
 * GitHub: `X-Hub-Signature-256: sha256=<hex hmac-sha256 of raw body>`.
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export function verifyGithubSignature(
  header: string | undefined,
  rawBody: string,
  secret: string
): VerifyResult {
  if (!header) return { valid: false, reason: "Missing X-Hub-Signature-256 header" };
  if (!header.startsWith("sha256=")) {
    return { valid: false, reason: "Malformed header — expected sha256=..." };
  }

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const matches = timingSafeEqualUtf8(expected, header);

  return matches
    ? { valid: true, reason: "Signature valid" }
    : {
        valid: false,
        reason: "Signature does not match — wrong secret, or the body was modified after signing",
      };
}

/**
 * Twilio: `X-Twilio-Signature: <base64 hmac-sha1>` over the full webhook URL
 * with sorted form-param key+value pairs appended.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function verifyTwilioSignature(
  header: string | undefined,
  fullUrl: string,
  formParams: Record<string, string>,
  authToken: string
): VerifyResult {
  if (!header) return { valid: false, reason: "Missing X-Twilio-Signature header" };

  let data = fullUrl;
  for (const key of Object.keys(formParams).sort()) {
    data += key + formParams[key];
  }

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf8"))
    .digest("base64");
  const matches = timingSafeEqualUtf8(expected, header);

  return matches
    ? { valid: true, reason: "Signature valid" }
    : {
        valid: false,
        reason:
          "Signature does not match — check the auth token, and that the URL matches exactly what's configured in Twilio (scheme, host, and trailing slash all matter)",
      };
}
