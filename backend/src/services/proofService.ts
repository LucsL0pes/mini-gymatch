import sharp from "sharp";
import Tesseract from "tesseract.js";
import { supabase } from "../services/db"; 
import crypto from "crypto";

const OCR_LANG = "por+eng";

export type OcrResult = { text: string; confidence?: number };

export async function runOCRtoText(buf: Buffer): Promise<OcrResult> {
  let pre = buf;
  try {
    pre = await sharp(buf).grayscale().normalise().toBuffer();
  } catch {}

  const res = await Tesseract.recognize(pre, OCR_LANG, { logger: () => {} });

  const text = (res.data?.text ?? "").replace(/\s+\n/g, "\n").trim();

  // words pode não existir na tipagem; pegamos via cast e caímos para data.confidence se preciso
  const words = (res.data as any)?.words as Array<{ confidence?: number }> | undefined;

  const confidence =
    words?.length
      ? Math.round(
          words
            .map(w => w?.confidence ?? 0)
            .reduce((a, b) => a + b, 0) / words.length
        )
      : typeof (res.data as any)?.confidence === "number"
      ? Math.round((res.data as any).confidence)
      : undefined;

  return { text, confidence };
}

function avgConfidence(words?: Array<{ confidence?: number }>) {
  if (!words?.length) return undefined;
  const vals = words.map(w => w?.confidence ?? 0);
  return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
}

export type Decision = { status: "approved" | "rejected" | "manual_review"; reason: string };

export function decideProof(text: string, profileName?: string): Decision {
  const norm = (text || "").toLowerCase();
  const keywords = ["comprovante","matrícula","matricula","universidade","instituição","aluno","curso","semestre"];
  if (keywords.filter(k => norm.includes(k)).length < 2)
    return { status: "rejected", reason: "Palavras-chave insuficientes" };

  const date = extractDate(norm);
  if (!date) return { status: "manual_review", reason: "Sem data reconhecível" };
  const days = (Date.now() - date.getTime()) / 86400000;
  if (days > 180) return { status: "manual_review", reason: "Documento possivelmente antigo (>180 dias)" };

  if (profileName) {
    const first = profileName.split(/\s+/)[0]?.toLowerCase();
    if (first && !norm.includes(first)) return { status: "manual_review", reason: "Nome do perfil não encontrado" };
  }

  if (norm.length < 120) return { status: "manual_review", reason: "Texto insuficiente" };
  return { status: "approved", reason: "Documento consistente com comprovante de matrícula" };
}

function extractDate(norm: string): Date | null {
  const m1 = norm.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
  if (m1) {
    const d = +m1[1], mo = +m1[2]-1, y = +(m1[3].length===2 ? "20"+m1[3] : m1[3]);
    const dt = new Date(y, mo, d); if (!isNaN(dt.getTime())) return dt;
  }
  const m2 = norm.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m2) {
    const y = +m2[1], mo = +m2[2]-1, d = +m2[3];
    const dt = new Date(y, mo, d); if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

export async function uploadToStorage(userId: string, file: Buffer, mime: string): Promise<string> {
  const ext = mime.split("/")[1] || "jpg";
  const key = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("proofs")
    .upload(key, file, { contentType: mime, upsert: false });
  if (error) throw error;

  const { data: pub } = supabase.storage.from("proofs").getPublicUrl(data.path);
  return pub.publicUrl;
}
