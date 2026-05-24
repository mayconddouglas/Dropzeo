import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ error: 'Token ausente.' });

  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, user_id, share_token, expires_at, is_expired, self_destruct, password, files(id, original_name, mime_type, size_bytes, storage_path)')
      .eq('share_token', token)
      .maybeSingle();

    if (sessionError || !session) return res.status(404).json({ error: 'NOT_FOUND' });

    const clientPassword = req.query.password;
    if (session.password && session.password !== clientPassword) {
      return res.status(401).json({ error: 'PASSWORD_REQUIRED' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const enrichedFiles = (session.files || []).map((file: any) => ({
      ...file,
      download_url: `${supabaseUrl}/storage/v1/object/public/dropzeo-files/${file.storage_path}`
    }));

    return res.json({ ...session, files: enrichedFiles });

  } else if (req.method === 'DELETE') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).end();

    const { data: session, error } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, files(storage_path)')
      .eq('share_token', token)
      .maybeSingle();

    if (error || !session) return res.status(404).json({ error: 'NOT_FOUND' });

    const filePaths = (session.files || []).map((f: any) => f.storage_path).filter(Boolean);
    if (filePaths.length > 0) {
      await supabaseAdmin.storage.from('dropzeo-files').remove(filePaths);
    }

    await supabaseAdmin.from('upload_sessions').update({ is_expired: true }).eq('id', session.id);

    return res.json({ success: true, message: 'Link revogado!' });
  }

  return res.status(405).end();
}
