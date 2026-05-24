-- ==========================================
-- DROPZEO - DATABASE MIGRATION & SCHEMAS
-- ==========================================

-- 1. Create upload_sessions table
CREATE TABLE IF NOT EXISTS public.upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    share_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_expired BOOLEAN NOT NULL DEFAULT false
);

-- Index for searching tokens quickly
CREATE INDEX IF NOT EXISTS idx_upload_sessions_token ON public.upload_sessions(share_token);
-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_status ON public.upload_sessions(expires_at, is_expired);

-- 2. Create files table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.upload_sessions(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on session_id
CREATE INDEX IF NOT EXISTS idx_files_session_id ON public.files(session_id);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable security on tables
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR 'upload_sessions'
-- Only service role can insert/delete because of custom business logic verification on server.
-- Client application (authenticated user) can view their own sessions:
CREATE POLICY "Users can read their own upload sessions"
    ON public.upload_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- POLICIES FOR 'files'
-- Readers can read files of a session if they possess the valid share_token and the session is not expired:
CREATE POLICY "Public read files via share_token"
    ON public.files
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 
            FROM public.upload_sessions s
            WHERE s.id = files.session_id 
              AND s.is_expired = false
        )
    );


-- ==========================================
-- STORAGE BUCKET CONFIGURATION (INFORMATIONAL / SUPABASE SETUP)
-- ==========================================
-- This configuration is handled when creating the bucket 'dropzeo-files'.
-- Storage bucket RLS:
-- 1. Anyone should be able to read/download objects from 'dropzeo-files'.
-- 2. Only authenticated service role (using SUPABASE_SERVICE_ROLE_KEY) can upload or delete objects.

-- If you run this in Supabase SQL editor, it registers the bucket:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dropzeo-files', 'dropzeo-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies:
-- Reading objects is allowed for anyone:
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'dropzeo-files');

-- Uploading/Deleting objects is restricted to service_role:
CREATE POLICY "Service Role Upload" 
ON storage.objects FOR INSERT 
TO service_role 
WITH CHECK (bucket_id = 'dropzeo-files');

CREATE POLICY "Service Role Delete" 
ON storage.objects FOR DELETE 
TO service_role 
USING (bucket_id = 'dropzeo-files');
