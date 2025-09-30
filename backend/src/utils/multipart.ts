import { Request } from 'express';

export interface MultipartFile {
  filename: string;
  contentType: string;
  data: Buffer;
  size: number;
}

export interface MultipartFormData {
  fields: Record<string, string>;
  files: Record<string, MultipartFile>;
}

function getBoundary(contentType: string): string | null {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) return null;
  return `--${boundary}`;
}

export async function parseMultipartFormData(req: Request): Promise<MultipartFormData> {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('content-type must be multipart/form-data');
  }

  const boundary = getBoundary(contentType);
  if (!boundary) {
    throw new Error('boundary not found');
  }

  const chunks: Buffer[] = [];
  const requestStream: any = req;
  for await (const chunk of requestStream) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk as Buffer);
    }
  }

  const buffer = Buffer.concat(chunks);
  const body = buffer.toString('binary');

  const rawParts = body.split(boundary).slice(1, -1);

  const fields: Record<string, string> = {};
  const files: Record<string, MultipartFile> = {};

  for (const rawPart of rawParts) {
    if (!rawPart) continue;

    let part = rawPart;
    if (part.startsWith('\r\n')) part = part.slice(2);
    if (part.endsWith('\r\n')) part = part.slice(0, -2);

    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) continue;

    const headersText = part.slice(0, headerEndIndex);
    let dataText = part.slice(headerEndIndex + 4);

    if (dataText.endsWith('\r\n')) {
      dataText = dataText.slice(0, -2);
    }

    const headerLines = headersText.split('\r\n').filter(Boolean);
    const dispositionLine = headerLines.find(line => line.toLowerCase().startsWith('content-disposition'));
    if (!dispositionLine) continue;

    const nameMatch = dispositionLine.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];

    const filenameMatch = dispositionLine.match(/filename="([^"]*)"/i);
    const contentTypeLine = headerLines.find(line => line.toLowerCase().startsWith('content-type'));
    const detectedContentType = contentTypeLine ? contentTypeLine.split(':')[1].trim() : 'application/octet-stream';

    const dataBuffer = Buffer.from(dataText, 'binary');

    if (filenameMatch && filenameMatch[1]) {
      files[fieldName] = {
        filename: filenameMatch[1],
        contentType: detectedContentType,
        data: dataBuffer,
        size: dataBuffer.length,
      };
    } else {
      fields[fieldName] = dataBuffer.toString('utf8');
    }
  }

  return { fields, files };
}
