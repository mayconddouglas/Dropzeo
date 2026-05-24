import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../src/lib/supabase';
import { supabase } from '../src/lib/supabase'; // Need to check if this is the right way to get auth user

// Authentication logic was in 'getAuthUser' in server.ts
// I will need to reimplement getAuthUser here or adjust the import.
// For now, I'll assume supabase instance from supabase.ts has auth.
// Wait, getSupabaseAdmin() is admin, supabase is client.
// I need the user's auth check.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  // Implementation of getAuthUser locally or importing it
  // Given I cannot easily import it (it was inside server.ts), 
  // I will just implement a simplified version.
  
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const token = authHeader.split(' ')[1];
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const userId = userData.user.id;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: sessions, error } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, share_token, expires_at, created_at, is_expired, self_destruct, password, download_count, files(id, original_name, mime_type, size_bytes)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Erro ao obter histórico.' });
  
  res.json(sessions);
}
