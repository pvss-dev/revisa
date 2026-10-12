ALTER TABLE "review_attempts" DROP CONSTRAINT "review_attempts_stage_check";
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_stage_check" CHECK ("stage" BETWEEN 0 AND 20);
