/**
 * ocr-client.ts — Client untuk memanggil Python PaddleOCR Service
 *
 * Interface-nya SAMA PERSIS dengan openrouter.ts sehingga
 * extract/route.ts hanya perlu ubah 1 baris import.
 */

import { Course } from './types';
import { createLogger } from './logger';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';
const OCR_TIMEOUT_MS = 300_000; // 300 detik (sama dengan timeout di Python service)

export interface ExtractResult {
  success: boolean;
  model_used: string;
  method: string;
  courses: Course[];
  raw_ocr: string[];     // baris teks mentah OCR (untuk debugging)
  raw_html: string[];    // HTML tabel PP-Structure (untuk debugging)
  fallback_reason?: string;
}

/**
 * Kirim gambar ke PaddleOCR service dan terima daftar mata kuliah.
 *
 * @param imageBase64 - Base64 data URL gambar (format: "data:image/jpeg;base64,...")
 * @param prodi       - Hint program studi (opsional, membantu akurasi)
 * @param requestId   - ID request untuk logging
 */
export async function extractCourses(
  imageBase64: string,
  prodi?: string,
  requestId?: string
): Promise<ExtractResult> {
  const logger = createLogger(requestId);
  const startTime = Date.now();

  logger.logLlmRequest({
    model: 'PaddleOCR-PPStructure',
    imageBase64Length: imageBase64.length,
    systemPromptLength: 0,
    userPrompt: prodi ? `prodi hint: ${prodi}` : 'no prodi hint',
  });

  // Cek dulu apakah OCR service aktif (health check cepat)
  try {
    const healthRes = await fetch(`${OCR_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 detik untuk health check
    });

    if (!healthRes.ok) {
      throw new Error(`OCR service unhealthy: ${healthRes.status}`);
    }

    const health = await healthRes.json();
    if (health.queue_size >= health.queue_max) {
      throw new Error('OCR service queue is full. Try again in a moment.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OCR service unreachable';

    // Jika service tidak aktif, kembalikan error yang jelas
    throw new Error(
      `PaddleOCR service tidak tersedia (${msg}). ` +
        'Pastikan ocr-service sudah dijalankan: cd ocr-service && uvicorn main:app --port 8000'
    );
  }

  // Kirim request ke OCR service
  const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, prodi }),
    signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const detail = errData.detail || response.statusText;
    throw new Error(`OCR service error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const executionTimeMs = Date.now() - startTime;

  // Normalize: pastikan setiap course punya field yang diperlukan
  const courses: Course[] = (data.courses || []).map((c: Record<string, unknown>) => ({
    nama_mk: String(c.nama_mk || '').trim(),
    kelas: String(c.kelas || '').trim(),
    prodi: c.prodi ? String(c.prodi).trim() : (prodi ?? ''),
    kode_mk: c.kode_mk ? String(c.kode_mk).trim() : undefined,
  })).filter((c: Course) => c.nama_mk && c.kelas); // filter baris kosong

  logger.logLlmResponse({
    model: 'PaddleOCR-PPStructure',
    rawResponse: JSON.stringify(data.courses),
    parsedCourses: courses,
    executionTimeMs,
    isFallback: false,
  });

  return {
    success: true,
    model_used: data.model_used || 'PaddleOCR-PPStructure',
    method: data.method || 'ppstructure',
    courses,
    raw_ocr: data.raw_ocr || [],
    raw_html: data.raw_html || [],
  };
}
