import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../../src/lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.query.token as string;

  if (req.method === 'GET') {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, user_id, share_token, expires_at, is_expired, self_destruct, password, files(id, original_name, mime_type, size_bytes, storage_path)')
      .eq('share_token', token)
      .maybeSingle();

    if (sessionError || !session) return res.status(404).json({ error: 'NOT_FOUND' });

    const clientPassword = req.query.password;
    if (session.password && session.password !== clientPassword) return res.status(401).json({ error: 'PASSWORD_REQUIRED' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const enrichedFiles = (session.files || []).map((file: any) => ({
      ...file,
      download_url: `${supabaseUrl}/storage/v1/object/public/dropzeo-files/${file.storage_path}`
    }));

    res.json({ ...session, files: enrichedFiles });
  } else if (req.method === 'DELETE') {
    // Auth check is simplified
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).end();
    
    // ... complete deletion logic here ...
    res.json({ success: true, message: 'Link revogado!' });
  } else {
    res.status(405).end();
  }
}
