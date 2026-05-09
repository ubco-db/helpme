import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
// word-extractor is CJS (`module.exports = WordExtractor`); default import emits `.default` and breaks at runtime.
import WordExtractor = require('word-extractor');

export type SupportedMime =
  | 'text/plain'
  | 'text/markdown'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/pdf';

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.doc', '.docx', '.pdf']);

export function isSupportedFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

type FileKind = 'txt' | 'doc' | 'docx' | 'pdf';

function pickKind(mimetype: string, filename: string): FileKind {
  const lower = filename.toLowerCase();
  if (
    lower.endsWith('.docx') ||
    mimetype.includes('officedocument.wordprocessingml')
  ) {
    return 'docx';
  }
  if (lower.endsWith('.doc') || mimetype === 'application/msword') {
    return 'doc';
  }
  if (lower.endsWith('.pdf') || mimetype === 'application/pdf') {
    return 'pdf';
  }
  return 'txt';
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeText(result.text);
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  if (!isSupportedFilename(filename)) {
    throw new Error(
      'Unsupported file type. Please upload .txt, .md, .doc, .docx, or .pdf.',
    );
  }

  const kind = pickKind(mimetype, filename);

  if (kind === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }

  if (kind === 'doc') {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return normalizeText(doc.getBody());
  }

  if (kind === 'pdf') {
    return extractPdfText(buffer);
  }

  return normalizeText(buffer.toString('utf-8'));
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
