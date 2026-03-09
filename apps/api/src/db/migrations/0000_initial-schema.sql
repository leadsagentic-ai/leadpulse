CREATE TYPE "public"."plan_tier" AS ENUM('starter', 'growth', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role" AS ENUM('admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_freq" AS ENUM('realtime', 'hourly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('VALID', 'INVALID', 'RISKY', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."intent_type" AS ENUM('BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('pending', 'approved', 'discarded', 'pushed_crm');--> statement-breakpoint
CREATE TYPE "public"."phone_status" AS ENUM('VALID', 'INVALID', 'UNVERIFIED');--> statement-breakpoint
CREATE TYPE "public"."score_tier" AS ENUM('HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD');--> statement-breakpoint
CREATE TYPE "public"."crm_type" AS ENUM('hubspot', 'salesforce', 'zoho', 'pipedrive', 'webhook', 'make');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"plan_tier" "plan_tier" DEFAULT 'starter' NOT NULL,
	"workspace_id" uuid,
	"monthly_lead_quota" integer DEFAULT 200 NOT NULL,
	"leads_used_this_month" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_member_role" DEFAULT 'member' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"plan_tier" varchar(50) DEFAULT 'starter' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"keywords" text[] NOT NULL,
	"exclusion_keywords" text[] DEFAULT '{}' NOT NULL,
	"intent_filters" text[] DEFAULT '{}' NOT NULL,
	"platforms" text[] NOT NULL,
	"subreddit_targets" text[] DEFAULT '{}' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"min_engagement" integer DEFAULT 0 NOT NULL,
	"persona_filter" text,
	"geo_filter" text[] DEFAULT '{}' NOT NULL,
	"notification_freq" "notification_freq" DEFAULT 'daily' NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"post_url" text NOT NULL,
	"post_text" text NOT NULL,
	"post_published_at" timestamp with time zone NOT NULL,
	"post_engagement" integer DEFAULT 0 NOT NULL,
	"intent_type" "intent_type" NOT NULL,
	"intent_confidence" numeric(4, 3) NOT NULL,
	"intent_justification" text NOT NULL,
	"urgency_score" numeric(4, 3) DEFAULT '0' NOT NULL,
	"persona_match_score" numeric(4, 3) DEFAULT '0' NOT NULL,
	"name" varchar(255),
	"username" varchar(255) NOT NULL,
	"platform_profile_url" text NOT NULL,
	"job_title" varchar(255),
	"company" varchar(255),
	"company_domain" varchar(255),
	"location" varchar(255),
	"industry" varchar(255),
	"company_size" varchar(50),
	"email" varchar(255),
	"email_status" "email_status",
	"email_provider" varchar(100),
	"phone" varchar(50),
	"phone_status" "phone_status",
	"linkedin_url" text,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"score_tier" "score_tier" NOT NULL,
	"lead_status" "lead_status" DEFAULT 'pending' NOT NULL,
	"crm_pushed_at" timestamp with time zone,
	"crm_record_url" text,
	"compliance_gdpr_safe" boolean DEFAULT true NOT NULL,
	"compliance_dpdp_safe" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enriched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"crm_type" "crm_type" NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"webhook_url" text,
	"webhook_secret" text,
	"field_mappings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"integration_status" "integration_status" DEFAULT 'disconnected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"crm_record_id" varchar(255),
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "enrichment_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"cost_inr" numeric(8, 2) DEFAULT '0' NOT NULL,
	"response_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"lead_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"campaign_id" uuid,
	"name" varchar(255) NOT NULL,
	"conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subreddit_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subreddit_name" varchar(100) NOT NULL,
	"niche_tags" text[] DEFAULT '{}' NOT NULL,
	"avg_lead_score" integer DEFAULT 0 NOT NULL,
	"lead_volume_est" integer DEFAULT 0 NOT NULL,
	"quality_tier" varchar(20) NOT NULL,
	"last_analyzed_at" timestamp with time zone,
	CONSTRAINT "subreddit_intelligence_subreddit_name_unique" UNIQUE("subreddit_name")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"campaign_id" uuid,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"verification_type" varchar(50) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"result" varchar(50) NOT NULL,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_log" ADD CONSTRAINT "crm_sync_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_log" ADD CONSTRAINT "crm_sync_log_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_log" ADD CONSTRAINT "enrichment_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_rules" ADD CONSTRAINT "router_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_rules" ADD CONSTRAINT "router_rules_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_log" ADD CONSTRAINT "verification_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "wm_workspace_user_idx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "campaigns_user_id_idx" ON "campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_user_id_idx" ON "leads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leads_campaign_id_idx" ON "leads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "leads_score_idx" ON "leads" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("lead_status");--> statement-breakpoint
CREATE INDEX "leads_platform_idx" ON "leads" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "leads_intent_type_idx" ON "leads" USING btree ("intent_type");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "integrations_user_id_idx" ON "integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_user_timestamp_idx" ON "usage_events" USING btree ("user_id","timestamp");