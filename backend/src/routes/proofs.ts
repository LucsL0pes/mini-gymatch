import { Router } from 'express';
import { auth } from '../middleware/auth';
import { parseMultipartFormData } from '../utils/multipart';
import { supabase } from '../services/db';
import { ProofValidationDisabledError, validateGymProofImage } from '../services/proofValidation';

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

  let status = data?.status ?? 'pending';
  let reason = data?.reason ?? null;
  const fileUrl = data?.file_url ?? publicUrl;

  try {
    const validation = await validateGymProofImage(file.data, mime, { profileId: me });
    status = validation.approved ? 'approved' : 'rejected';

    const pieces: string[] = [];
    if (validation.reason) {
      pieces.push(validation.reason);
    }
    if (validation.matchedKeywords.length) {
      pieces.push(`Palavras-chave encontradas: ${validation.matchedKeywords.join(', ')}.`);
    }
    if (typeof validation.confidence === 'number') {
      pieces.push(`Confiança IA: ${(validation.confidence * 100).toFixed(0)}%.`);
    }

    if (!pieces.length) {
      pieces.push(
          validation.approved
            ? 'Documento aprovado automaticamente pela IA com base na análise do comprovante.'
            : 'A IA não encontrou evidências suficientes na imagem para confirmar a matrícula na academia.'
      );
      if (!validation.approved && !validation.matchedKeywords.length) {
        pieces.push('Nenhuma palavra-chave relevante foi localizada.');
      }
    }

    reason = pieces.join(' ').trim() || null;

    await supabase
      .from('proofs')
      .update({ status, reason })
      .eq('profile_id', me);
  } catch (err) {
    if (err instanceof ProofValidationDisabledError) {
      status = 'pending';
      reason =
        'Comprovante recebido. A validação automática está desativada e será concluída manualmente em breve.';
    } else {
      console.error('proof-validation:error', err);
      status = 'pending';
      reason =
        'Comprovante recebido, mas ocorreu um erro na validação automática. Nossa equipe fará a revisão manual.';
    }

    await supabase
      .from('proofs')
      .update({ status, reason })
      .eq('profile_id', me);
  }

  res.json({ status, reason, file_url: fileUrl });
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
