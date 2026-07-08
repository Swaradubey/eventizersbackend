-- CreateTable: admin_profiles
CREATE TABLE IF NOT EXISTS "admin_profiles" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "profile_image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_notification_settings
CREATE TABLE IF NOT EXISTS "admin_notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rsvp_responses" BOOLEAN NOT NULL DEFAULT true,
    "event_reminders" BOOLEAN NOT NULL DEFAULT true,
    "security_alerts" BOOLEAN NOT NULL DEFAULT true,
    "weekly_summary" BOOLEAN NOT NULL DEFAULT false,
    "product_updates" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_security_settings
CREATE TABLE IF NOT EXISTS "admin_security_settings" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "two_factor_auth" BOOLEAN NOT NULL DEFAULT false,
    "public_profile" BOOLEAN NOT NULL DEFAULT true,
    "data_sharing" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_team_members
CREATE TABLE IF NOT EXISTS "admin_team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "invited_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_preferences
CREATE TABLE IF NOT EXISTS "admin_preferences" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "date_format" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "time_format" TEXT NOT NULL DEFAULT '24h',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: admin_profiles.user_id
CREATE UNIQUE INDEX IF NOT EXISTS "admin_profiles_user_id_key" ON "admin_profiles"("user_id");

-- CreateUniqueIndex: admin_notification_settings.user_id
CREATE UNIQUE INDEX IF NOT EXISTS "admin_notification_settings_user_id_key" ON "admin_notification_settings"("user_id");

-- CreateUniqueIndex: admin_security_settings.user_id
CREATE UNIQUE INDEX IF NOT EXISTS "admin_security_settings_user_id_key" ON "admin_security_settings"("user_id");

-- CreateUniqueIndex: admin_team_members.email
CREATE UNIQUE INDEX IF NOT EXISTS "admin_team_members_email_key" ON "admin_team_members"("email");

-- CreateUniqueIndex: admin_preferences.user_id
CREATE UNIQUE INDEX IF NOT EXISTS "admin_preferences_user_id_key" ON "admin_preferences"("user_id");

-- AddForeignKey: admin_profiles -> users
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: admin_notification_settings -> users
ALTER TABLE "admin_notification_settings" ADD CONSTRAINT "admin_notification_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: admin_security_settings -> users
ALTER TABLE "admin_security_settings" ADD CONSTRAINT "admin_security_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: admin_team_members -> users
ALTER TABLE "admin_team_members" ADD CONSTRAINT "admin_team_members_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: admin_preferences -> users
ALTER TABLE "admin_preferences" ADD CONSTRAINT "admin_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
