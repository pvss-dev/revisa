-- Google accounts can authenticate without a local password.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- The OpenID Connect subject is the stable Google account identifier.
ALTER TABLE "users" ADD COLUMN "google_subject" TEXT;

CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");
