import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, supabase } from '../src/lib/supabase';
import { generateToken } from '../src/lib/utils';

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

  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { files, expiration, self_destruct, password } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const expirationOpt = expiration || '15min';
    const selfDestructOpt = self_destruct === true;
    const passwordOpt = password || null;

    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size || 0;
    }

    const MAX_SESSION_BYTES = 50 * 1024 * 1024;
    if (totalBytes > MAX_SESSION_BYTES) {
      return res.status(400).json({ error: 'BETA_LIMIT_EXCEEDED' });
    }

    // Auth check
    const user = await getAuthUser(req);
    const LIMIT_20MB = 20 * 1024 * 1024;

    if (!user && totalBytes > LIMIT_20MB) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Uploads maiores de 20MB exigem cadastro ou login.'
      });
    }

    let durationMinutes = 15;
    if (expirationOpt === '5min') durationMinutes = 5;
    if (expirationOpt === '30min') durationMinutes = 30;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    const supabaseAdmin = getSupabaseAdmin();

    let shareToken = generateToken(10);
    
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .insert({
        user_id: user ? user.id : null,
        share_token: shareToken,
        expires_at: expiresAt.toISOString(),
        is_expired: false,
        self_destruct: selfDestructOpt,
        password: passwordOpt
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Session Insert Error:', sessionError);
      return res.status(500).json({ error: 'Falha ao processar sessão.', details: sessionError });
    }

    const sessionId = session.id;

    // Generate signed upload URLs in parallel to avoid Vercel timeout on large batches
    const fileUploadConfigs = await Promise.all(files.map(async (file) => {
      const originalFilename = file.name || 'file';
      const cleanOriginalName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePrefix = generateToken(6);
      const storagePath = `session-${shareToken}/${uniquePrefix}-${cleanOriginalName}`;

      const { error: dbError } = await supabaseAdmin
        .from('files')
        .insert({
          session_id: sessionId,
          original_name: originalFilename,
          storage_path: storagePath,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size || 0
        });

      if (dbError) {
        throw new Error(`DB_INSERT_ERROR:${dbError.message}`);
      }

      const { data: signedUploadData, error: signedUploadError } = await supabaseAdmin.storage
        .from('dropzeo-files')
        .createSignedUploadUrl(storagePath);

      if (signedUploadError || !signedUploadData) {
        throw new Error(`SIGNED_URL_ERROR:${signedUploadError?.message || 'unknown'}`);
      }

      return {
        id: file.id,
        storagePath,
        signedUrl: signedUploadData.signedUrl,
        token: signedUploadData.token,
      };
    }));

    res.json({
      success: true,
      share_token: shareToken,
      expires_at: expiresAt.toISOString(),
      uploads: fileUploadConfigs,
    });
  } catch (globalError: any) {
    console.error('Internal Server Error in /api/upload.ts:', globalError);
    return res.status(500).json({ error: 'Erro inesperado no servidor', details: globalError?.message });
  }
}

