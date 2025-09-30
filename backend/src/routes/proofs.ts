import { Router } from 'express';
import { auth } from '../middleware/auth';
import { parseMultipartFormData } from '../utils/multipart';
import { supabase } from '../services/db';

const MAX_UPLOAD_SIZE = 6 * 1024 * 1024; // 6MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

const r = Router();
r.use(auth);

r.post('/', async (req, res) => {
  let form;
  try {
    form = await parseMultipartFormData(req);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'could not parse form-data' });
  }

  const file = form.files['file'];
  if (!file) {
    return res.status(400).json({ error: 'missing file field' });
  }

  if (file.size <= 0) {
    return res.status(400).json({ error: 'file is empty' });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return res.status(400).json({ error: 'file too large (limit 6MB)' });
  }

  const mime = file.contentType.toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return res.status(400).json({ error: 'unsupported file type' });
  }

  const me = (req as any).userId as string;
  const timestamp = Date.now();
  const safeName = sanitizeFilename(file.filename || 'proof');
  const filePath = `${me}/${timestamp}-${safeName}`;

  const storage = supabase.storage.from('proofs');
  const { error: uploadError } = await storage.upload(filePath, file.data, {
    contentType: mime,
    upsert: true,
  });

  if (uploadError) {
    return res.status(400).json({ error: uploadError.message });
  }

  const { data: publicUrlData } = storage.getPublicUrl(filePath);
  const publicUrl = publicUrlData?.publicUrl ?? null;

  const { data, error } = await supabase
    .from('proofs')
    .upsert(
      {
        profile_id: me,
        file_path: filePath,
        file_url: publicUrl,
        status: 'pending',
        reason: null,
      },
      { onConflict: 'profile_id' }
    )
    .select('status, reason, file_url')
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ status: data?.status ?? 'pending', reason: data?.reason, file_url: data?.file_url ?? publicUrl });
});

r.get('/status', async (req, res) => {
  const me = (req as any).userId as string;
  const { data, error } = await supabase
    .from('proofs')
    .select('status, reason, file_url, updated_at, created_at')
    .eq('profile_id', me)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!data) {
    return res.json({ status: 'not_submitted' });
  }

  res.json({
    status: data.status,
    reason: data.reason,
    file_url: data.file_url,
    updated_at: (data as any).updated_at ?? null,
    created_at: (data as any).created_at ?? null,
  });
});

export default r;
