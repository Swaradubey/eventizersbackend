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
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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



