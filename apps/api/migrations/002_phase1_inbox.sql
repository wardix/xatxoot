-- Phase 1: MVP Inbox, Channels, Contacts, Conversations, Tickets & Messages Schema

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

-- 7. companies (Corporate / B2B entities for contacts)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    description TEXT,
    custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. contacts (Customer / External Contact Profiles)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    name VARCHAR(255),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    identifier VARCHAR(255),
    contact_type VARCHAR(50) NOT NULL DEFAULT 'lead',
    custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    additional_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. contact_inboxes (Unique link between Contact and Inbox with source identifier)
CREATE TABLE IF NOT EXISTS contact_inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    source_id VARCHAR(255) NOT NULL,
    hmac_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inbox_id, source_id)
);

-- 10. teams (Agent functional teams e.g., Support, Sales, Billing)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    allow_auto_assign BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. team_members (Mapping agents to teams)
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

-- 12. conversations (Persistent chat thread per contact in an inbox)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    contact_inbox_id UUID REFERENCES contact_inboxes(id) ON DELETE CASCADE,
    active_ticket_id UUID,
    unread_count INT NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. tickets (Operational work units attached to a conversation with 1:1 Sticky Case Note)
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id BIGINT GENERATED BY DEFAULT AS IDENTITY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    snoozed_until TIMESTAMPTZ,
    waiting_since TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    first_reply_created_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    internal_note TEXT,
    internal_note_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    internal_note_updated_at TIMESTAMPTZ,
    custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. ticket_participants (Teammates collaborating or watching ticket)
CREATE TABLE IF NOT EXISTS ticket_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ticket_id, user_id)
);

-- 15. messages (Chat message history in a conversation)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    sender_type VARCHAR(50) NOT NULL,
    sender_id UUID,
    message_type VARCHAR(50) NOT NULL DEFAULT 'incoming',
    content TEXT,
    content_type VARCHAR(50) NOT NULL DEFAULT 'text',
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    external_source_id VARCHAR(255),
    content_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. attachments (Media files attached to a message)
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_type VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    thumb_url TEXT,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_name VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. labels (Categorization tags for tickets and contacts)
CREATE TABLE IF NOT EXISTS labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20) NOT NULL DEFAULT '#10b981',
    description TEXT,
    show_on_sidebar BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. ticket_labels (Ticket to Label relation)
CREATE TABLE IF NOT EXISTS ticket_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ticket_id, label_id)
);

-- 19. contact_labels (Contact to Label relation)
CREATE TABLE IF NOT EXISTS contact_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contact_id, label_id)
);

-- Indexes for performance & query lookups
CREATE INDEX IF NOT EXISTS idx_inboxes_channel ON inboxes(channel_type, channel_id);
CREATE INDEX IF NOT EXISTS idx_inbox_members_inbox_id ON inbox_members(inbox_id);
CREATE INDEX IF NOT EXISTS idx_inbox_members_user_id ON inbox_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_whatsapp_cloud_phone_number_id ON channels_whatsapp_cloud(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_channels_whatsapp_unofficial_session_id ON channels_whatsapp_unofficial(session_id);
CREATE INDEX IF NOT EXISTS idx_channels_web_widget_website_token ON channels_web_widget(website_token);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_inboxes_contact_id ON contact_inboxes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_inboxes_inbox_id ON contact_inboxes(inbox_id);
CREATE INDEX IF NOT EXISTS idx_contact_inboxes_source_id ON contact_inboxes(inbox_id, source_id);
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_id ON conversations(inbox_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_tickets_conversation_id ON tickets(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_external_source_id ON messages(external_source_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_ticket_labels_ticket_id ON ticket_labels(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_labels_label_id ON ticket_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_contact_labels_contact_id ON contact_labels(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_labels_label_id ON contact_labels(label_id);
