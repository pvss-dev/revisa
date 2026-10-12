-- Store Google OAuth credentials encrypted by the application.
CREATE TABLE "google_calendar_connections" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "google_email" TEXT,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- One local row per calculated review stage prevents duplicate Google events.
CREATE TABLE "google_calendar_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "stage" SMALLINT NOT NULL,
    "event_id" TEXT NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_events_pkey" PRIMARY KEY ("id")
);

-- Failed operations remain durable and can be retried from the profile screen.
CREATE TABLE "calendar_sync_jobs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "topic_id" INTEGER,
    "dedupe_key" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_calendar_connections_user_id_key" ON "google_calendar_connections"("user_id");
CREATE UNIQUE INDEX "google_calendar_events_topic_id_stage_key" ON "google_calendar_events"("topic_id", "stage");
CREATE UNIQUE INDEX "google_calendar_events_user_id_event_id_key" ON "google_calendar_events"("user_id", "event_id");
CREATE INDEX "google_calendar_events_user_idx" ON "google_calendar_events"("user_id");
CREATE UNIQUE INDEX "calendar_sync_jobs_dedupe_key_key" ON "calendar_sync_jobs"("dedupe_key");
CREATE INDEX "calendar_sync_jobs_pending_idx" ON "calendar_sync_jobs"("user_id", "status", "next_attempt_at");

ALTER TABLE "google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_calendar_events"
    ADD CONSTRAINT "google_calendar_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_calendar_events"
    ADD CONSTRAINT "google_calendar_events_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_sync_jobs"
    ADD CONSTRAINT "calendar_sync_jobs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_calendar_events"
    ADD CONSTRAINT "google_calendar_events_stage_check" CHECK ("stage" BETWEEN 0 AND 20);

ALTER TABLE "calendar_sync_jobs"
    ADD CONSTRAINT "calendar_sync_jobs_status_check" CHECK ("status" IN ('pending', 'processing', 'failed'));

ALTER TABLE "calendar_sync_jobs"
    ADD CONSTRAINT "calendar_sync_jobs_operation_check" CHECK ("operation" IN ('upsert_topic', 'delete_events', 'full_sync'));
