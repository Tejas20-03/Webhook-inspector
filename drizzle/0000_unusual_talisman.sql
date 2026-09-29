CREATE TABLE "endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner" text,
	"response_status" integer DEFAULT 200 NOT NULL,
	"response_body" text DEFAULT '' NOT NULL,
	"response_content_type" text DEFAULT 'application/json' NOT NULL,
	"response_delay_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "endpoints_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "replays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"target_url" text NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"response_snippet" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"query" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"body_encoding" text DEFAULT 'utf8' NOT NULL,
	"body_size" integer DEFAULT 0 NOT NULL,
	"content_type" text,
	"ip" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;