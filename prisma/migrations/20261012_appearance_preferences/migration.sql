ALTER TABLE "users" ADD COLUMN "appearance_theme" TEXT NOT NULL DEFAULT 'light';
ALTER TABLE "users" ADD COLUMN "accent_color" TEXT NOT NULL DEFAULT '#246D54';
ALTER TABLE "users" ADD CONSTRAINT "users_appearance_theme_check" CHECK ("appearance_theme" IN ('light', 'dark', 'auto'));
ALTER TABLE "users" ADD CONSTRAINT "users_accent_color_check" CHECK ("accent_color" ~ '^#[0-9A-F]{6}$');
