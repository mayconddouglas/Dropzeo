-- Migration: Add download_count column to upload_sessions
ALTER TABLE public.upload_sessions 
ADD COLUMN IF NOT EXISTS download_count INT NOT NULL DEFAULT 0;
