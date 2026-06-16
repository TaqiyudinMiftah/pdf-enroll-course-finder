import { Course } from './types';
import { createLogger } from './logger';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OCR_MODEL = process.env.OPENROUTER_OCR_MODEL;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ExtractResult {
  success: boolean;
  model_used: string;
  courses: Course[];
  fallback_reason?: string;
}

/**
 * Parse OCR output langsung dengan regex.
 * Format OCR dari baidu — 2 varian:
 *   Varian A: "Senin 08:45:00 - 10:25:00 (CIF64213) Keamanan Informasi C Mahendra Data..."
 *   Varian B: "Senin 08:45 - 10:25 A CCE61306 Desain dan Analisis Algoritma 2024 ..."
 */
function parseOcrDirect(ocrText: string): Course[] {
  const courses: Course[] = [];
  const seen = new Set<string>();

  const lines = ocrText.split('\n');

  // Pre-process: gabungkan MATA KULIAH multi-kata yang terpisah baris (jarang terjadi)
  const processedLines = lines.map((l) => l.trim()).filter((l) => l.length > 30);

  for (const line of processedLines) {
    // Varian A: kode MK dalam kurung, kelas setelah nama
    // "Senin 08:45:00 - 10:25:00 (CIF64213) Keamanan Informasi C Mahendra..."
    let match = line.match(
      /(?:Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s+\d{2}:\d{2}(?::\d{2})?\s*-\s*\d{2}:\d{2}(?::\d{2})?\s+\(([A-Z]{3}\d{5,8})\)\s+(.+?)\s+([A-Z][A-Z0-9]{0,3})\s+[A-Z][a-z]/
    );

    if (match) {
      const [, kode_mk, namaRaw, kelas] = match;
      const nama_mk = namaRaw.trim();

      if (nama_mk && kode_mk && kelas) {
        const key = `${nama_mk.toLowerCase()}|${kelas.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          courses.push({ nama_mk, kelas, kode_mk, prodi: '' });
        }
        continue;
      }
    }

    // Varian B: kelas sebelum kode MK (format sebelumnya)
    // "Senin 08:45 - 10:25 A CCE61306 Desain dan Analisis Algoritma 2024 ..."
    match = line.match(
      /(?:Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s+\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\s+([A-Z0-9]{1,3})\s+([A-Z]{3}\d{5,8})\s+(.+?)\s+\d{4}\b/
    );

    if (match) {
      const [, kelas, kode_mk, namaRaw] = match;
      let nama_mk = namaRaw;
      // Stop di kata-kata non-matkul
      const stopWords = ['Gedung', 'Luring', 'Daring', 'Tampilkan', 'Reguler', 'FILKOM', 'F3.', 'F4.', 'S.Kom', 'S.T', 'M.Kom', 'M.Eng', 'M.T', 'Ph.D', 'Pengumuman'];
      for (const stop of stopWords) {
        const idx = nama_mk.indexOf(stop);
        if (idx > 0) nama_mk = nama_mk.substring(0, idx);
      }
      nama_mk = nama_mk.replace(/\s{2,}/g, ' ').trim();

      if (nama_mk && kode_mk && kelas && nama_mk.length > 4) {
        const key = `${nama_mk.toLowerCase()}|${kelas.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          courses.push({ nama_mk, kelas, kode_mk, prodi: '' });
        }
      }
    }
  }

  return courses;
}

async function chat(model: string, messages: { role: string; content: unknown }[], signal: AbortSignal, maxTokens = 2048): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://course-enroll-finder.vercel.app',
      'X-Title': 'Course Enroll Finder',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.01 }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No content (finish_reason: ${data.choices?.[0]?.finish_reason || 'unknown'})`);
  return content;
}

export async function extractCourses(imageBase64: string, prodi?: string, requestId?: string): Promise<ExtractResult> {
  const logger = createLogger(requestId);
  const startTime = Date.now();

  try {
    // Step 1: OCR (30s timeout)
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30000);
    const ocrStart = Date.now();

    let ocrText: string;
    try {
      logger.logLlmRequest({ model: OCR_MODEL, imageBase64Length: imageBase64.length, systemPromptLength: 0, userPrompt: 'OCR' });
      ocrText = await chat(OCR_MODEL, [
        { role: 'user', content: [{ type: 'text', text: 'OCR semua teks dari gambar ini. Output hanya teks mentah.' }, { type: 'image_url', image_url: { url: imageBase64 } }] },
      ], ctrl.signal, 2048);
      logger.logLlmResponse({ model: OCR_MODEL, rawResponse: ocrText, parsedCourses: [], executionTimeMs: Date.now() - ocrStart, isFallback: false });
    } catch (e) {
      clearTimeout(timeout);
      throw new Error(`OCR failed: ${e instanceof Error ? e.message : e}`);
    }
    clearTimeout(timeout);
    const ocrElapsed = Date.now() - ocrStart;
    console.log(`[ocr] done in ${ocrElapsed}ms, text: ${ocrText.length} chars`);

    // Step 2: Parse directly with regex (no LLM needed!)
    const courses = parseOcrDirect(ocrText);
    const totalMs = Date.now() - startTime;
    console.log(`[pipeline] OCR=${ocrElapsed}ms + parse=${totalMs - ocrElapsed}ms = ${totalMs}ms, courses=${courses.length}`);

    if (courses.length === 0) {
      throw new Error('No courses parsed from OCR text — check OCR output format');
    }

    return { success: true, model_used: OCR_MODEL, courses };
  } catch (error) {
    logger.logAppError(error, 'PIPELINE');
    throw error;
  }
}
