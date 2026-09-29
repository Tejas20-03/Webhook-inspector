import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const okCount = new Counter("ok_responses");
const rateLimitedCount = new Counter("rate_limited_responses");

// The ingest route rate-limits at 120 req/min per IP and 300 req/min per
// slug (see lib/rate-limit.ts). Run from a single machine, every request
// shares one IP, so the per-IP limit is the one this test actually exercises.
// 15 req/s for 30s intentionally exceeds that, to measure both the
// endpoint's raw handling latency AND confirm the rate limiter engages
// under sustained load rather than just trusting the code.
export const options = {
  scenarios: {
    ingest: {
      executor: "constant-arrival-rate",
      rate: 15,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 30,
      maxVUs: 60,
    },
  },
  thresholds: {
    // allowed requests should stay fast even under load
    "http_req_duration{status:200}": ["p(95)<500"],
  },
};

export function setup() {
  const res = http.post(`${BASE_URL}/api/endpoints`);
  const slug = JSON.parse(res.body).slug;
  return { slug };
}

export default function ingest(data) {
  // k6 automatically tags http_req_duration with the response's `status`,
  // which is what the p(95)<500 threshold above filters on.
  const res = http.post(
    `${BASE_URL}/h/${data.slug}`,
    JSON.stringify({ event: "load.test", ts: Date.now() }),
    { headers: { "content-type": "application/json" } }
  );

  if (res.status === 200) okCount.add(1);
  if (res.status === 429) rateLimitedCount.add(1);

  check(res, {
    "status is 200 or 429 (never a server error)": (r) => r.status === 200 || r.status === 429,
  });
}
