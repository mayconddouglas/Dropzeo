import { IncomingForm } from 'formidable';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, supabase } from '../src/lib/supabase';
import { generateToken } from '../src/lib/utils';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const form = new IncomingForm({
      maxFileSize: 50 * 1024 * 1024,
      keepExtensions: true,
    });

    const [fields, formFiles] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    const uploadedFilesRaw = formFiles.files;
    const files = Array.isArray(uploadedFilesRaw) ? uploadedFilesRaw : (uploadedFilesRaw ? [uploadedFilesRaw] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const getFirst = (field: any) => Array.isArray(field) ? field[0] : field;

    const expirationOpt = getFirst(fields.expiration) || '15min';
    const selfDestructOpt = getFirst(fields.self_destruct) === 'true';
    const passwordOpt = getFirst(fields.password) || null;

    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size;
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

    for (const file of files) {
      const originalFilename = file.originalFilename || file.newFilename || 'file';
      const cleanOriginalName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePrefix = generateToken(6);
      const storagePath = `session-${shareToken}/${uniquePrefix}-${cleanOriginalName}`;

      const fileBuffer = await fs.promises.readFile(file.filepath);

      const { error: uploadError } = await supabaseAdmin.storage
        .from('dropzeo-files')
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype || 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage Upload Error:', uploadError);
        return res.status(500).json({ error: 'Falha ao fazer upload na nuvem.', details: uploadError });
      }

      const { error: dbError } = await supabaseAdmin
        .from('files')
        .insert({
          session_id: sessionId,
          original_name: originalFilename,
          storage_path: storagePath,
          mime_type: file.mimetype || 'application/octet-stream',
          size_bytes: file.size
        });
        
      if (dbError) {
        console.error('DB Insert Error:', dbError);
        return res.status(500).json({ error: 'Falha ao registrar arquivo no banco.', details: dbError });
      }
    }

    res.json({
      success: true,
      share_token: shareToken,
      expires_at: expiresAt.toISOString(),
    });
  } catch (globalError: any) {
    console.error('Internal Server Error in /api/upload.ts:', globalError);
    return res.status(500).json({ error: 'Erro inesperado no servidor', details: globalError?.message });
  }
}

