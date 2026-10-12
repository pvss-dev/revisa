-- Create disciplines and preserve every existing topic relationship.
CREATE TABLE "disciplines" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "disciplines_user_idx" ON "disciplines"("user_id");
CREATE UNIQUE INDEX "disciplines_user_id_name_key" ON "disciplines"("user_id", "name");

ALTER TABLE "disciplines"
    ADD CONSTRAINT "disciplines_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disciplines"
    ADD CONSTRAINT "disciplines_color_index_check" CHECK ("color_index" BETWEEN 0 AND 4);

WITH existing_disciplines AS (
    SELECT
        "user_id",
        MIN(BTRIM("subject")) AS "name",
        ROW_NUMBER() OVER (PARTITION BY "user_id" ORDER BY LOWER(BTRIM("subject"))) - 1 AS "position"
    FROM "topics"
    WHERE BTRIM("subject") <> ''
    GROUP BY "user_id", LOWER(BTRIM("subject"))
)
INSERT INTO "disciplines" ("user_id", "name", "color_index", "created_at", "updated_at")
SELECT "user_id", "name", MOD("position", 5)::INTEGER, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM existing_disciplines;

ALTER TABLE "topics" ADD COLUMN "discipline_id" INTEGER;

UPDATE "topics" AS topic
SET "discipline_id" = discipline."id"
FROM "disciplines" AS discipline
WHERE discipline."user_id" = topic."user_id"
  AND LOWER(discipline."name") = LOWER(BTRIM(topic."subject"));

ALTER TABLE "topics" ALTER COLUMN "discipline_id" SET NOT NULL;
CREATE INDEX "topics_discipline_idx" ON "topics"("discipline_id");

ALTER TABLE "topics"
    ADD CONSTRAINT "topics_discipline_id_fkey"
    FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topics" DROP COLUMN "subject";
