-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Role enum if not exists
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role "Role" DEFAULT 'USER';

-- Insert mock user 9999 if not exists
INSERT INTO users (id, name, email, password_hash)
VALUES (9999, 'Hexerve', 'hexerve@gmail.com', '$2a$10$w/XkZzYp4dFh21y3lQ2v3O/mKeeSjT.a/Xv4XoD2K2aFq4DkWzJyK')
ON CONFLICT (id) DO NOTHING;

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(100),
  venue VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  cover_image VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create guests table
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'invited',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create TicketTierStatus enum if not exists
DO $$ BEGIN
    CREATE TYPE "TicketTierStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'SOLD_OUT', 'EXPIRED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create TicketOrderStatus enum if not exists
DO $$ BEGIN
    CREATE TYPE "TicketOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CheckInMethod enum if not exists
DO $$ BEGIN
    CREATE TYPE "CheckInMethod" AS ENUM ('QR', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id VARCHAR(255) PRIMARY KEY,
  event_id UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  main_text TEXT,
  message TEXT,
  accent_color VARCHAR(50) DEFAULT '#5B5FEF',
  background_color VARCHAR(50) DEFAULT '#F6F9FC',
  text_color VARCHAR(50) DEFAULT '#1A1118',
  title_size INTEGER DEFAULT 48,
  font_weight VARCHAR(50) DEFAULT 'normal',
  font_family VARCHAR(50) DEFAULT 'sans-serif',
  text_alignment VARCHAR(50) DEFAULT 'center',
  image_url VARCHAR(500),
  button_text VARCHAR(100) DEFAULT 'RSVP Now',
  button_color VARCHAR(50) DEFAULT '#5B5FEF',
  button_radius INTEGER DEFAULT 8,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket_tiers table
CREATE TABLE IF NOT EXISTS ticket_tiers (
  id VARCHAR(255) PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  capacity INTEGER NOT NULL,
  min_per_order INTEGER DEFAULT 1,
  max_per_order INTEGER,
  sales_start_at TIMESTAMP,
  sales_end_at TIMESTAMP,
  status "TicketTierStatus" DEFAULT 'ACTIVE',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket_orders table
CREATE TABLE IF NOT EXISTS ticket_orders (
  id VARCHAR(255) PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  user_id INTEGER REFERENCES users(id),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  status "TicketOrderStatus" DEFAULT 'PENDING',
  subtotal NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_reference VARCHAR(255),
  stripe_session_id VARCHAR(500) UNIQUE,
  payment_intent_id VARCHAR(500),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add stripe_session_id and payment_intent_id to ticket_orders if they don't exist
-- (for databases where the table was already created without these columns)
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(500) UNIQUE;
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(500);

-- Create ticket_order_items table
CREATE TABLE IF NOT EXISTS ticket_order_items (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  ticket_tier_id VARCHAR(255) NOT NULL REFERENCES ticket_tiers(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create check_ins table
CREATE TABLE IF NOT EXISTS check_ins (
  id VARCHAR(255) PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  ticket_id VARCHAR(255),
  checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checked_in_by_id VARCHAR(255),
  method "CheckInMethod" DEFAULT 'MANUAL',
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  device_info TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_event_guest UNIQUE (event_id, guest_id),
  CONSTRAINT uq_event_ticket UNIQUE (event_id, ticket_id)
);




-- Create MessageStatus enum if not exists
DO $$ BEGIN
    CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SENT', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create MessageRecipientType enum if not exists
DO $$ BEGIN
    CREATE TYPE "MessageRecipientType" AS ENUM ('ALL_GUESTS', 'ATTENDING', 'DECLINED', 'PENDING', 'SELECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status "MessageStatus" DEFAULT 'SENT',
  recipient_type "MessageRecipientType" NOT NULL,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create message_recipients table
CREATE TABLE IF NOT EXISTS message_recipients (
  id VARCHAR(255) PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_guest UNIQUE (message_id, guest_id)
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Create indexes for message_recipients
CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_guest_id ON message_recipients(guest_id);

-- Create SubscriptionUsage table if not exists
CREATE TABLE IF NOT EXISTS "SubscriptionUsage" (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "eventsCreated" INTEGER DEFAULT 0,
  "guestsThisMonth" INTEGER DEFAULT 0,
  "messagesSent" INTEGER DEFAULT 0,
  "eventsLimit" INTEGER DEFAULT 10,
  "guestsLimit" INTEGER DEFAULT 25,
  "messagesLimit" INTEGER DEFAULT 100,
  month TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add subscription billing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'FREE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'PAID';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expiry_date TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');

-- Create payment_methods table if not exists
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  brand VARCHAR(50) NOT NULL,
  last4 VARCHAR(4) NOT NULL,
  expiry_month VARCHAR(2) NOT NULL,
  expiry_year VARCHAR(4) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create invoices table if not exists
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(255) PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  pdf_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add stripe_customer_id to users table for Stripe integration
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Create indexes for users table for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_billing_status ON users(billing_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Extend AuditLog table with optional fields if they don't exist
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userEmail" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "metadata" JSONB;



-- ============================================================
-- Admin Settings Tables (added 2026-07-08)
-- These tables back the Settings & Admin Settings pages.
-- ============================================================

-- Create admin_profiles table
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
CREATE UNIQUE INDEX IF NOT EXISTS "admin_profiles_user_id_key" ON "admin_profiles"("user_id");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_profiles_user_id_fkey') THEN
        ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create admin_notification_settings table
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
CREATE UNIQUE INDEX IF NOT EXISTS "admin_notification_settings_user_id_key" ON "admin_notification_settings"("user_id");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_notification_settings_user_id_fkey') THEN
        ALTER TABLE "admin_notification_settings" ADD CONSTRAINT "admin_notification_settings_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create admin_security_settings table
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
CREATE UNIQUE INDEX IF NOT EXISTS "admin_security_settings_user_id_key" ON "admin_security_settings"("user_id");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_security_settings_user_id_fkey') THEN
        ALTER TABLE "admin_security_settings" ADD CONSTRAINT "admin_security_settings_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create admin_team_members table
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
CREATE UNIQUE INDEX IF NOT EXISTS "admin_team_members_email_key" ON "admin_team_members"("email");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_team_members_invited_by_id_fkey') THEN
        ALTER TABLE "admin_team_members" ADD CONSTRAINT "admin_team_members_invited_by_id_fkey"
            FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create admin_preferences table
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
CREATE UNIQUE INDEX IF NOT EXISTS "admin_preferences_user_id_key" ON "admin_preferences"("user_id");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_preferences_user_id_fkey') THEN
        ALTER TABLE "admin_preferences" ADD CONSTRAINT "admin_preferences_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create templates table if not exists
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT FALSE
);

