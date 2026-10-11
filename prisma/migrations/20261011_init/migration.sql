-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "review_offsets" INTEGER[] DEFAULT ARRAY[7, 21, 60, 100]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token_hash" CHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lesson_date" DATE,
    "practice_date" DATE NOT NULL,
    "priority" TEXT NOT NULL,
    "source_key" TEXT,
    "review_offsets" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_attempts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "stage" SMALLINT NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "completed_at" DATE,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "exam_date" DATE,
    "question_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "exam_id" INTEGER NOT NULL,
    "question_number" INTEGER NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("exam_id","question_number")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "topics_user_practice_idx" ON "topics"("user_id", "practice_date");

-- CreateIndex
CREATE UNIQUE INDEX "topics_user_id_source_key_key" ON "topics"("user_id", "source_key");

-- CreateIndex
CREATE INDEX "review_attempts_user_idx" ON "review_attempts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_attempts_topic_id_stage_key" ON "review_attempts"("topic_id", "stage");

-- CreateIndex
CREATE INDEX "exams_user_idx" ON "exams"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints for values that also have application-level validation.
ALTER TABLE "topics" ADD CONSTRAINT "topics_priority_check" CHECK ("priority" IN ('Alta', 'Média', 'Baixa'));
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_stage_check" CHECK ("stage" BETWEEN 0 AND 4);
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_total_check" CHECK ("total" > 0);
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_correct_check" CHECK ("correct" >= 0 AND "correct" <= "total");
ALTER TABLE "exams" ADD CONSTRAINT "exams_question_count_check" CHECK ("question_count" BETWEEN 1 AND 300);
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_number_check" CHECK ("question_number" > 0);
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_result_check" CHECK ("result" IN ('correct', 'wrong'));
