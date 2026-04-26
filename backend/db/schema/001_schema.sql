-- ========================
-- Community Resource Finder
-- Database Schema
-- ========================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
-- Supports optional accounts (ASH) and admin accounts (FEE)
-- DAV never needs to touch this table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    google_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CATEGORIES TABLE
-- The 6 core categories from the SESMag plan
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. RESOURCES TABLE
-- All community resource listings
-- Populated via Google Places API seeder + admin additions
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50) DEFAULT 'NJ',
    zip_code VARCHAR(10) NOT NULL,
    phone_number VARCHAR(20),
    hours_of_operation TEXT,
    website VARCHAR(255),
    requirements TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP,
    google_place_id VARCHAR(255) UNIQUE,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. SAVED RESOURCES TABLE
-- ASH's bookmarks — links users to resources they saved
CREATE TABLE IF NOT EXISTS saved_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, resource_id)
);

-- 5. RESOURCE AUDIT LOG TABLE
-- Tracks every change FEE (admin) makes to a listing
CREATE TABLE IF NOT EXISTS resource_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'verified', 'deleted')),
    changes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. RESOURCE SUBMISSIONS TABLE
-- Public suggestions submitted when data is missing
CREATE TABLE IF NOT EXISTS resource_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitter_name VARCHAR(120),
    submitter_contact VARCHAR(255),
    zip_or_city VARCHAR(120) NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    resource_name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    phone_number VARCHAR(20),
    website VARCHAR(255),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- SEED CATEGORIES
-- ========================
INSERT INTO categories (name, icon, description) VALUES
    ('Food', 'food', 'Food banks, soup kitchens, meal programs, and grocery assistance'),
    ('Health', 'health', 'Free clinics, mental health services, dental care, and medical assistance'),
    ('Jobs', 'jobs', 'Job training, employment services, resume help, and career counseling'),
    ('Housing', 'housing', 'Shelters, rental assistance, transitional housing, and eviction prevention'),
    ('Legal', 'legal', 'Free legal aid, tenant rights, immigration help, and public defenders'),
    ('Government', 'government', 'Government benefit programs, SNAP, Medicaid, and social services')
ON CONFLICT (name) DO NOTHING;

-- ========================
-- INDEXES FOR PERFORMANCE
-- ========================
CREATE INDEX IF NOT EXISTS idx_resources_zip_code ON resources(zip_code);
CREATE INDEX IF NOT EXISTS idx_resources_category_id ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_is_verified ON resources(is_verified);
CREATE INDEX IF NOT EXISTS idx_saved_resources_user_id ON saved_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON resource_audit_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_submissions_status ON resource_submissions(status);
