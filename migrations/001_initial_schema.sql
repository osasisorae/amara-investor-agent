-- ============================================
-- Amara Investor Agent - Initial Database Schema
-- Turso (libSQL) Migration
-- ============================================

-- Core lead record with stage tracking
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  stage TEXT NOT NULL DEFAULT 'outreach_sent',
  -- Stages: outreach_sent | qualifying | deal_room | kyc_intake | 
  --         pending_human_review | kyc_rejected | agreement_pending |
  --         agreement_signed | payment_pending | closed | disqualified
  full_name TEXT,
  phone TEXT,
  country TEXT,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  qualified_at INTEGER,
  kyc_submitted_at INTEGER,
  kyc_reviewed_at INTEGER,
  kyc_approved INTEGER DEFAULT 0, -- 0 = pending/rejected, 1 = approved
  approved_by TEXT,
  agreement_viewed_at INTEGER,
  agreement_signed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Full conversation history between Amara and investors
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'agent' | 'investor'
  content TEXT NOT NULL,
  metadata TEXT, -- JSON blob for additional data
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Index for fast message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Qualification answers captured during stage 3
CREATE TABLE IF NOT EXISTS qualification_answers (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0, -- 0 = fail, 1 = pass
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Index for qualification lookups
CREATE INDEX IF NOT EXISTS idx_qualification_lead_id ON qualification_answers(lead_id);

-- KYC documents uploaded by investors
CREATE TABLE IF NOT EXISTS kyc_documents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  doc_type TEXT NOT NULL, -- 'passport' | 'drivers_license' | 'proof_of_residence' | 'other'
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Index for KYC document retrieval
CREATE INDEX IF NOT EXISTS idx_kyc_documents_lead_id ON kyc_documents(lead_id);

-- Full audit trail for compliance
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  -- Event types: outreach_sent | qualification_started | qualification_passed |
  --             qualification_failed | deal_room_accessed | kyc_submitted |
  --             kyc_approved | kyc_rejected | agreement_viewed | agreement_signed |
  --             payment_instructions_sent
  metadata TEXT, -- JSON blob with event-specific data
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Index for audit trail queries
CREATE INDEX IF NOT EXISTS idx_audit_events_lead_id ON audit_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- Offeree register (human checkpoint 1)
CREATE TABLE IF NOT EXISTS offeree_register (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  source TEXT, -- 'manual' | 'referral' | 'event' | 'other'
  notes TEXT,
  added_by TEXT NOT NULL, -- admin email
  added_at INTEGER NOT NULL DEFAULT (unixepoch()),
  activated INTEGER DEFAULT 0 -- 0 = not yet activated, 1 = lead created
);

-- Index for offeree lookups
CREATE INDEX IF NOT EXISTS idx_offeree_email ON offeree_register(email);
CREATE INDEX IF NOT EXISTS idx_offeree_activated ON offeree_register(activated);

-- OTP codes for agreement signing
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'agreement_signing' | 'email_verification'
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0, -- 0 = unused, 1 = used
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Index for OTP validation
CREATE INDEX IF NOT EXISTS idx_otp_lead_id ON otp_codes(lead_id);
CREATE INDEX IF NOT EXISTS idx_otp_code ON otp_codes(code);

-- Admin users (simple auth for hackathon)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin', -- 'admin' | 'compliance_officer'
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Runtime admin authentication is environment-based. This legacy table is
-- retained for compatibility and should be populated explicitly if adopted.
