# Webhook Inspector

A public URL that captures anything sent to it, so you can inspect, replay, and verify signatures on webhooks from Stripe, GitHub, Twilio, or anything else — without deploying to check what a payload looks like.

## Features

- **Instant endpoint, no signup** — get an unguessable URL like `/h/k3x9a2mq7w` immediately.
- **Full capture** — any HTTP method, headers, query params, the exact raw body (not re-serialized, so signatures still verify), IP, and timestamp.
- **Live feed** — new requests appear in the dashboard within about a second, via Server-Sent Events.
- **Detail view** — pretty JSON, raw body, headers, and a one-click "copy as cURL".
- **Replay** — resend any captured request to a target URL and see the status, timing, and response.
- **Diff** — pick two captured requests and see a side-by-side, line-aligned diff of headers and body.
- **Signature verification** — paste a secret and check whether Stripe, GitHub, or Twilio's signature on a request is valid, and if not, why.
- **Configurable responses** — set the status code, body, content-type, and an artificial delay an endpoint returns, to test a sender's retry behavior.

## Stack

Next.js (App Router) · TypeScript · Postgres (Neon) via Drizzle · Tailwind

Real-time and rate limiting run on Postgres rather than Redis — see [Design notes](#design-notes) for why.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (and CRON_SECRET before deploying)
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an endpoint, and send it something:

```bash
curl -X POST http://localhost:3000/h/<slug> \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'
```

## Design notes

**Real-time feed without Redis.** The original design called for Server-Sent Events backed by Redis pub/sub — the "right" architecture for scaling across multiple serverless instances, since in-memory pub/sub doesn't survive a request landing on a different function instance than the one holding a live connection. This project instead has each SSE connection poll Postgres directly for new rows (`app/api/endpoints/[slug]/stream/route.ts`), about once a second. That trades a small amount of latency for zero extra infrastructure, and — importantly — it's *correct* in a way in-memory pub/sub would not be on a platform like Vercel. Swapping in Redis later means replacing the polling loop in that one route; nothing else changes.

**SSRF hardening on replay.** Replay lets a user supply an arbitrary URL that the server will fetch, which is a classic SSRF vector — without safeguards, someone could point it at `169.254.169.254` (cloud metadata) or an internal service. `lib/ssrf.ts` and `lib/replay.ts` handle this by:
- resolving the hostname and rejecting it if *any* resolved address falls outside the public "unicast" range (blocks private, loopback, link-local, carrier-grade NAT, multicast, and reserved ranges, via `ipaddr.js`),
- connecting to that exact resolved IP via a pinned `lookup` function instead of letting the HTTP client re-resolve the hostname — the second resolution is what a DNS-rebinding attack relies on,
- not following redirects (a redirect is an easy way to bypass every check above),
- and capping response size and request duration.

**Raw bytes, not re-parsed.** The ingest route reads the body via `arrayBuffer()`, never `.json()`, and stores it as-is (UTF-8 or base64 for binary content). Signature schemes are computed over the exact bytes that were sent; re-serializing JSON changes whitespace and silently breaks verification.

**Abuse prevention.** Body size is capped at 1MB. Ingest is rate-limited per-IP and per-slug; replay is rate-limited per-IP — both via a Postgres-backed fixed-window counter (`lib/rate-limit.ts`), which is simpler to reason about than a sliding window and accurate enough for this. Anonymous endpoints expire after 24 hours, and requests older than 24 hours are pruned regardless, via a cron-triggered cleanup route (`app/api/cron/cleanup/route.ts`, wired up in `vercel.json`).

## Known limitations

- The fixed-window rate limiter allows a short burst at window boundaries (e.g. near the top of a minute) — a sliding-window or token-bucket limiter would tighten this, at the cost of more complexity.
- Twilio signature verification reconstructs the full URL from the `Host` and `X-Forwarded-Proto` headers captured at ingest time; if that doesn't exactly match the URL configured in Twilio's console (scheme, trailing slash), verification will report a mismatch even with the correct auth token.
