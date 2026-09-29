import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";

export const endpoints = pgTable("endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  owner: text("owner"), // anonymous cookie id for now, real user id later
  responseStatus: integer("response_status").notNull().default(200),
  responseBody: text("response_body").notNull().default(""),
  responseContentType: text("response_content_type")
    .notNull()
    .default("application/json"),
  responseDelayMs: integer("response_delay_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpointId: uuid("endpoint_id")
    .notNull()
    .references(() => endpoints.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  path: text("path").notNull(),
  query: jsonb("query").notNull().default({}),
  headers: jsonb("headers").notNull().default({}),
  // raw body, stored as-is (base64 for binary content, utf8 for text)
  body: text("body").notNull().default(""),
  bodyEncoding: text("body_encoding").notNull().default("utf8"), // "utf8" | "base64"
  bodySize: integer("body_size").notNull().default(0),
  contentType: text("content_type"),
  ip: text("ip"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(), // e.g. "ip:1.2.3.4" or "slug:abc123"
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })]
);

export const replays = pgTable("replays", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  responseSnippet: text("response_snippet"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
