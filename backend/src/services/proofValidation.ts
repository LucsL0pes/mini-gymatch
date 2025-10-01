import https from 'https';

const DEFAULT_KEYWORDS = (process.env.GYM_PROOF_KEYWORDS ||
  'academia, matrícula, matricula, aluno, mensalidade, plano, contrato, pagamento, recibo, unidade')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const MODEL = process.env.PROOF_VALIDATION_MODEL || 'gpt-4.1-mini';
const ENDPOINT = process.env.OPENAI_PROOF_ENDPOINT || 'https://api.openai.com/v1/responses';

export class ProofValidationDisabledError extends Error {
  constructor(message = 'AI proof validation is not configured') {
    super(message);
    this.name = 'ProofValidationDisabledError';
  }
}

export type ProofValidationOutcome = {
  approved: boolean;
  matchedKeywords: string[];
  reason: string;
  confidence?: number;
};

async function callOpenAI(payload: unknown, apiKey: string): Promise<any> {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');

          if ((response.statusCode || 500) >= 400) {
            return reject(new Error(`OpenAI API error (${response.statusCode}): ${text}`));
          }

          try {
            resolve(JSON.parse(text));
          } catch (err: any) {
            reject(new Error(`Could not parse OpenAI response: ${err?.message || 'unknown error'}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

export async function validateGymProofImage(
  fileBuffer: Buffer,
  mimeType: string,
  options?: { keywords?: string[]; profileId?: string }
): Promise<ProofValidationOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ProofValidationDisabledError();
  }

  const keywords = (options?.keywords || DEFAULT_KEYWORDS).map((value) => value.trim()).filter(Boolean);

  if (!keywords.length) {
    throw new Error('No keywords configured for proof validation');
  }

  const base64 = fileBuffer.toString('base64');
  const imageUrl = `data:${mimeType};base64,${base64}`;
  const profileId = options?.profileId?.trim();

  const schema = {
    name: 'GymProofValidation',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        approved: { type: 'boolean' },
        matched_keywords: {
          type: 'array',
          items: { type: 'string' },
        },
        reason: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['approved', 'matched_keywords', 'reason'],
    },
    strict: true,
  } as const;

  const payload = {
    model: MODEL,
    max_output_tokens: 300,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: [
              'Você é um assistente especializado em validar comprovantes de matrícula de academias.',
              'Aprove somente se o documento trouxer evidências claras (texto visível) que a pessoa está matriculada.',
              'Use o contexto para identificar sinônimos ou abreviações das palavras-chave informadas.',
              'Retorne sempre um JSON compatível com o schema informado.',
              profileId ? `ID do perfil em análise: ${profileId}.` : '',
            ]
              .filter(Boolean)
              .join(' '),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Analise o comprovante e indique se ele confirma a matrícula na academia. Palavras-chave alvo: ${keywords.join(
              ', '
            )}.`,
          },
          {
            type: 'input_text',
            text: 'Informe também quais palavras-chave (ou variações) foram encontradas, um motivo curto e um nível de confiança.',
          },
          {
            type: 'input_image',
            image_url: imageUrl,
          },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema,
    },
  };

  const response = await callOpenAI(payload, apiKey);

  let parsed: any = null;
  const output = response?.output || [];
  for (const block of output || []) {
    for (const piece of block?.content || []) {
      if (piece?.type === 'json_schema' && piece?.json) {
        parsed = piece.json;
        break;
      }
    }
    if (parsed) break;
  }

  if (!parsed) {
    throw new Error('Could not parse AI response for proof validation');
  }

  const approved = Boolean(parsed.approved);
  const reason = typeof parsed.reason === 'string' && parsed.reason.trim().length > 0 ? parsed.reason.trim() : '';
  const matchedKeywords = Array.isArray(parsed.matched_keywords)
    ? parsed.matched_keywords.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;

  return {
    approved,
    matchedKeywords,
    reason,
    confidence,
  };
}
