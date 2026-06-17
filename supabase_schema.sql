-- Supabase schema for Modular AI Notes.
-- Run this in the Supabase SQL editor if you want cloud sync + durable usage limits.
-- The app works without Supabase (local IndexedDB + in-memory limits) too.

-- Notes (cloud mirror of the local library)
create table if not exists notes (
    id            text primary key,
    title         text,
    date          text,
    duration      text,
    content       text,
    transcript    text,
    type          text,
    tags          jsonb,
    attachments   jsonb,
    is_bookmarked boolean default false,
    last_accessed timestamptz,
    source_data   jsonb,
    updated_at    timestamptz default now()
);

-- Saved Global Analysis sessions
create table if not exists analysis_sessions (
    id         uuid primary key default gen_random_uuid(),
    title      text,
    messages   jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Daily free-usage counters (the real enforcement layer for the limit system)
create table if not exists usage_counters (
    user_id text not null,
    day     date not null,
    count   integer not null default 0,
    primary key (user_id, day)
);

-- Paid (Pro) users — set after a successful Stripe checkout. Pro users bypass the daily limit.
create table if not exists pro_users (
    user_id            text primary key,
    active             boolean not null default true,
    stripe_customer_id text,
    updated_at         timestamptz default now()
);
