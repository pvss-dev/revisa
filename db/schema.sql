CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS review_offsets INTEGER[] NOT NULL DEFAULT ARRAY[7,21,60,100];

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS topics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  lesson_date DATE,
  practice_date DATE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('Alta', 'Média', 'Baixa')),
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS review_offsets INTEGER[];
CREATE INDEX IF NOT EXISTS topics_user_practice_idx ON topics(user_id, practice_date);

CREATE TABLE IF NOT EXISTS review_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  stage SMALLINT NOT NULL CHECK (stage BETWEEN 0 AND 4),
  total INTEGER NOT NULL CHECK (total > 0),
  correct INTEGER NOT NULL CHECK (correct >= 0 AND correct <= total),
  completed_at DATE,
  imported BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id, stage)
);
CREATE INDEX IF NOT EXISTS review_attempts_user_idx ON review_attempts(user_id);

CREATE TABLE IF NOT EXISTS exams (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_date DATE,
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exams_user_idx ON exams(user_id);

CREATE TABLE IF NOT EXISTS exam_answers (
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL CHECK (question_number > 0),
  result TEXT NOT NULL CHECK (result IN ('correct', 'wrong')),
  PRIMARY KEY (exam_id, question_number)
);
