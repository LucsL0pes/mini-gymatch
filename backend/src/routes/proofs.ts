import { Router } from "express";
import { auth } from "../middleware/auth";
import { parseMultipartFormData } from "../utils/multipart";
import { supabase } from "../services/db";
import {
  ProofValidationDisabledError,
  ProofValidationOutcome,
  validateGymProofImage,
} from "../services/proofValidation";

const MAX_UPLOAD_SIZE = 6 * 1024 * 1024; // 6MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function sanitizeFilename(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

const router = Router();
router.use(auth);

type ProofRecord = {
  status: "manual_review" | "approved" | "rejected";
  reason: string | null;
  file_url: string | null;
  ocr_text: string | null;
};

export async function upsertProof(
  userId: string,
  payload: Partial<ProofRecord>,
  client = supabase
): Promise<ProofRecord> {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );

  const { data: existing, error: fetchError } = await client
    .from("proofs")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const baseSelect = "status, reason, file_url, ocr_text";
  const existingId = existing?.id;

  if (existingId) {
    if (!Object.keys(sanitizedPayload).length) {
      const { data, error } = await client
        .from("proofs")
        .select(baseSelect)
        .eq("id", existingId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        status: (data?.status as ProofRecord["status"]) ?? "manual_review",
        reason: (data?.reason as ProofRecord["reason"]) ?? null,
        file_url: (data?.file_url as ProofRecord["file_url"]) ?? null,
        ocr_text: (data?.ocr_text as ProofRecord["ocr_text"]) ?? null,
      };
    }

    const { data, error } = await client
      .from("proofs")
      .update(sanitizedPayload)
      .eq("id", existingId)
      .select(baseSelect)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      status: (data?.status as ProofRecord["status"]) ?? "manual_review",
      reason: (data?.reason as ProofRecord["reason"]) ?? null,
      file_url: (data?.file_url as ProofRecord["file_url"]) ?? null,
      ocr_text: (data?.ocr_text as ProofRecord["ocr_text"]) ?? null,
    };
  }

  const { data, error } = await client
    .from("proofs")
    .insert({ user_id: userId, ...sanitizedPayload })
    .select(baseSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: (data?.status as ProofRecord["status"]) ?? "manual_review",
    reason: (data?.reason as ProofRecord["reason"]) ?? null,
    file_url: (data?.file_url as ProofRecord["file_url"]) ?? null,
    ocr_text: (data?.ocr_text as ProofRecord["ocr_text"]) ?? null,
  };
}

function buildReasonFromAi(validation: ProofValidationOutcome): string | null {
  const pieces: string[] = [];

  if (validation.reason) pieces.push(validation.reason);

  if (validation.matchedKeywords.length) {
    pieces.push(
      `Palavras-chave encontradas: ${validation.matchedKeywords.join(", ")}.`
    );
  }

  if (typeof validation.confidence === "number") {
    pieces.push(`Confiança IA: ${(validation.confidence * 100).toFixed(0)}%.`);
  }

  if (!pieces.length) {
    pieces.push(
      validation.approved
        ? "Documento aprovado automaticamente pela IA com base na análise do comprovante."
        : "A IA não encontrou evidências suficientes na imagem para confirmar a matrícula na academia."
    );

    if (!validation.approved && !validation.matchedKeywords.length) {
      pieces.push("Nenhuma palavra-chave relevante foi localizada.");
    }
  }

  return pieces.join(" ").trim() || null;
}

/**
 * método POST /api/proofs
 * multipart/form-data (campo: file)
 */
router.post("/", async (req, res) => {
  let form;
  try {
    form = await parseMultipartFormData(req);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: err?.message || "could not parse form-data" });
  }

  const file = form.files["file"];
  if (!file) return res.status(400).json({ error: "missing file field" });
  if (file.size <= 0) return res.status(400).json({ error: "file is empty" });
  if (file.size > MAX_UPLOAD_SIZE)
    return res.status(400).json({ error: "file too large (limit 6MB)" });

  const mime = file.contentType.toLowerCase();
  if (!ALLOWED_MIME.has(mime))
    return res.status(400).json({ error: "unsupported file type" });

  const me = (req as any).user?.id as string;
  if (!me) return res.status(401).json({ error: "unauthorized" });

  const timestamp = Date.now();
  const safeName = sanitizeFilename(file.filename || "proof");
  const filePath = `${me}/${timestamp}-${safeName}`;

  // upload no Storage (bucket: proofs)
  const storage = supabase.storage.from("proofs");
  const { error: uploadError } = await storage.upload(filePath, file.data, {
    contentType: mime,
    upsert: true,
  });
  if (uploadError) return res.status(400).json({ error: uploadError.message });

  const { data: publicUrlData } = storage.getPublicUrl(filePath);
  const publicUrl = publicUrlData?.publicUrl ?? null;

  // upsert inicial: manual review (status padrão aceito pelo banco)
  let record: ProofRecord;
  try {
    record = await upsertProof(me, {
      file_url: publicUrl,
      status: "manual_review",
      reason: null,
      ocr_text: null,
    });
  } catch (err: any) {
    return res.status(400).json({
      error: err?.message || "Não foi possível salvar o comprovante",
    });
  }

  let status = record.status;
  let reason = record.reason;
  const fileUrl = record.file_url ?? publicUrl;

  
  try {
    const validation = await validateGymProofImage(file.data, mime, {
      profileId: me,
    });
    status = validation.approved ? "approved" : "rejected";
    reason = buildReasonFromAi(validation);

    await supabase
      .from("proofs")
      .update({
        status,
        reason,
        ocr_text: validation.matchedKeywords.join(", ") || null,
      })
      .eq("user_id", me);
  } catch (err) {
    if (err instanceof ProofValidationDisabledError) {
      status = "manual_review";
      reason =
        "Comprovante recebido. A validação automática está desativada e será concluída manualmente em breve.";
    } else {
      console.error("proof-validation:error", err);
      status = "manual_review";
      reason =
        "Comprovante recebido, mas ocorreu um erro na validação automática. Nossa equipe fará a revisão manual.";
    }

    await supabase
      .from("proofs")
      .update({ status, reason })
      .eq("user_id", me);
  }

  return res.json({ status, reason, file_url: fileUrl });
});

/**
 * GET /api/proofs/status
 */
router.get("/status", async (req, res) => {
  const me = (req as any).user?.id as string;
  if (!me) return res.status(401).json({ error: "unauthorized" });

  let { data, error } = await supabase
    .from("proofs")
    .select("status, reason, file_url, created_at, updated_at")
    .eq("user_id", me)
    .maybeSingle();

  if (error && /updated_at/.test(error.message || "")) {
    ({ data, error } = await supabase
      .from("proofs")
      .select("status, reason, file_url, created_at")
      .eq("user_id", me)
      .maybeSingle());
  }

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.json({ status: "not_submitted" });

  return res.json({
    status: (data as any).status,
    reason: (data as any).reason,
    file_url: (data as any).file_url,
    updated_at:
      (data as any).updated_at ?? (data as any).created_at ?? null,
    created_at: (data as any).created_at ?? null,
  });
});

export default router;
