-- Migration: Add Security & Privacy Features (Self-Destruct and Password)
ALTER TABLE public.upload_sessions 
ADD COLUMN IF NOT EXISTS self_destruct BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS password TEXT;
