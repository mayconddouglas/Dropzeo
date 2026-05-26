import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, supabase } from '../../src/lib/supabase';

async function getAuthUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch (err) {
    console.error('Error authenticating user in function:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.query.token as string;

  if (req.method === 'GET') {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('upload_sessions')
        .select(`
          id, 
          user_id, 
          share_token, 
          expires_at, 
          is_expired, 
          self_destruct, 
          password, 
          files(id, original_name, mime_type, size_bytes, storage_path)
        `)
        .eq('share_token', token)
        .maybeSingle();

      if (sessionError || !session) {
        return res.status(404).json({ error: 'NOT_FOUND' });
      }

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
    } catch (err) {
      console.error('GET Session error:', err);
      return res.status(500).json({ error: 'Erro interno ao carregar dados do link.' });
    }

  } else if (req.method === 'DELETE') {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login necessário para revogar transferências.' });
      }

      const supabaseAdmin = getSupabaseAdmin();

      const { data: session, error: findError } = await supabaseAdmin
        .from('upload_sessions')
        .select(`
          id,
          user_id,
          is_expired,
          files (
            id,
            storage_path
          )
        `)
        .eq('share_token', token)
        .maybeSingle();

      if (findError) {
        console.error('Error finding session for revocation:', findError);
        return res.status(500).json({ error: 'Erro ao localizar a transferência.' });
      }

      if (!session) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Sessão não encontrada.' });
      }

      // Verify ownership
      if (session.user_id !== user.id) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Você não tem permissão para revogar este link.' });
      }

      // Mark expired in database
      const { error: updateError } = await supabaseAdmin
        .from('upload_sessions')
        .update({ is_expired: true })
        .eq('id', session.id);

      if (updateError) {
        console.error('Error updating session expiry:', updateError);
        return res.status(500).json({ error: 'Erro ao revogar link.' });
      }

      // Clear out physical storage files
      const filePaths = (session.files || []).map((f: any) => f.storage_path).filter(Boolean);
      if (filePaths.length > 0) {
        try {
          await supabaseAdmin.storage.from('dropzeo-files').remove(filePaths);
          console.log('Successfully completed physical file removal on manual revocation');
        } catch (e) {
          console.error('Error removing files during manual revocation:', e);
        }
      }

      return res.json({ success: true, message: 'Link revogado e arquivos removidos com sucesso!' });
    } catch (err) {
      console.error('Revoke session exception:', err);
      return res.status(500).json({ error: 'Erro inesperado ao revogar a sessão.' });
    }

  } else {
    return res.status(405).end();
  }
}
