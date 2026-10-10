-- Phase 1: MVP Inbox & Channels Schema
-- 1. channels_whatsapp_cloud (Official Meta Graph API v18.0+)
CREATE TABLE IF NOT EXISTS channels_whatsapp_cloud (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(50) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL UNIQUE,
    waba_id VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    webhook_verify_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. channels_whatsapp_unofficial (Baileys Multi-Device Socket Gateway)
CREATE TABLE IF NOT EXISTS channels_whatsapp_unofficial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(50),
    session_id VARCHAR(100) NOT NULL UNIQUE,
    connection_status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
    qr_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. channels_web_widget (Website Live Chat Widget)
CREATE TABLE IF NOT EXISTS channels_web_widget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_token VARCHAR(100) NOT NULL UNIQUE,
    website_url TEXT,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    widget_color VARCHAR(20) NOT NULL DEFAULT '#10b981',
    reply_time VARCHAR(50) NOT NULL DEFAULT 'in_a_few_minutes',
    pre_chat_form_enabled BOOLEAN NOT NULL DEFAULT false,
    hmac_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. channels_api (Custom Third-Party API Channel)
CREATE TABLE IF NOT EXISTS channels_api (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    webhook_url TEXT,
    api_key_hash TEXT NOT NULL,
    auth_token VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. inboxes (Entry point connecting Channel to Agents)
CREATE TABLE IF NOT EXISTS inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    channel_id UUID NOT NULL,
    enable_auto_assign BOOLEAN NOT NULL DEFAULT true,
    greeting_enabled BOOLEAN NOT NULL DEFAULT false,
    greeting_message TEXT,
    working_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    out_of_office_message TEXT,
    lock_to_single_conv BOOLEAN NOT NULL DEFAULT false,
    sender_name_type VARCHAR(50) NOT NULL DEFAULT 'friendly',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. inbox_members (Access control for agents handling an inbox)
CREATE TABLE IF NOT EXISTS inbox_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inbox_id, user_id)
);

-- Indexes for performance & query lookups
CREATE INDEX IF NOT EXISTS idx_inboxes_channel ON inboxes(channel_type, channel_id);
CREATE INDEX IF NOT EXISTS idx_inbox_members_inbox_id ON inbox_members(inbox_id);
CREATE INDEX IF NOT EXISTS idx_inbox_members_user_id ON inbox_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_whatsapp_cloud_phone_number_id ON channels_whatsapp_cloud(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_channels_whatsapp_unofficial_session_id ON channels_whatsapp_unofficial(session_id);
CREATE INDEX IF NOT EXISTS idx_channels_web_widget_website_token ON channels_web_widget(website_token);
