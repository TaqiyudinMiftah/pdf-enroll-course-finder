import { Course } from './types';
import { createLogger } from './logger';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const PRIMARY_MODEL = process.env.OPENROUTER_PRIMARY_MODEL || 'nvidia/nemotron-ultra-253b-v1';
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'nvidia/llama-3.2-nemotron-nano-vl-8b-v1';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `Kamu adalah sistem OCR khusus untuk membaca jadwal mata kuliah mahasiswa.
Tugasmu adalah mengekstrak informasi mata kuliah dari gambar yang diberikan.

OUTPUT RULES:
- Kembalikan HANYA JSON array yang valid, tanpa penjelasan, tanpa markdown code block
- Jika tidak ada mata kuliah yang terbaca, kembalikan array kosong: []
- Jangan menambahkan field selain yang diminta

OUTPUT FORMAT:
[
  {
    "nama_mk": "<nama mata kuliah persis seperti di gambar>",
    "kelas": "<huruf atau kode kelas, contoh: A, B, N1G>",
    "prodi": "<program studi jika terlihat, atau null>"
  }
]

ATURAN EKSTRAKSI:
- nama_mk: tulis persis seperti di gambar, jangan disingkat atau diparafrase
- kelas: hanya kode kelasnya saja (A, B, C, N1G, dll), bukan "Kelas A"
- prodi: isi jika terlihat di gambar, jika tidak terlihat isi null
- Jika ada kode MK (misal CSD60706), tambahkan field "kode_mk" berisi kode tersebut
- Abaikan informasi selain nama MK, kelas, dan prodi (SKS, dosen, ruang, jadwal jam)`;

export interface ExtractResult {
  success: boolean;
  model_used: string;
  courses: Course[];
  fallback_reason?: string;
}

async function callOpenRouter(
  imageBase64: string,
  model: string,
  prodi: string | undefined,
  signal: AbortSignal,
  logger: ReturnType<typeof createLogger>
): Promise<{ courses: Course[]; rawResponse: string }> {
  const userContent = prodi
    ? `Ekstrak semua mata kuliah dari jadwal ini. Program Studi: ${prodi}`
    : 'Ekstrak semua mata kuliah dari jadwal ini.';

  logger.logLlmRequest({
    model,
    imageBase64Length: imageBase64.length,
    systemPromptLength: SYSTEM_PROMPT.length,
    userPrompt: userContent,
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://course-enroll-finder.vercel.app',
      'X-Title': 'Course Enroll Finder',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userContent,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const content: string = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenRouter response');
  }

  const cleanedContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const courses = JSON.parse(cleanedContent);
    if (!Array.isArray(courses)) {
      throw new Error('Response is not an array');
    }
    return { courses, rawResponse: content };
  } catch {
    console.error('Failed to parse OpenRouter response:', content);
    throw new Error('Failed to parse extracted courses');
  }
}

export async function extractCourses(
  imageBase64: string,
  prodi?: string,
  requestId?: string
): Promise<ExtractResult> {
  const logger = createLogger(requestId);

  // Try primary model first with 60s timeout (253B parameter model is slow)
  const primaryController = new AbortController();
  const primaryTimeoutId = setTimeout(() => primaryController.abort(), 60000);
  const primaryStartTime = Date.now();

  try {
    const { courses, rawResponse } = await callOpenRouter(
      imageBase64,
      PRIMARY_MODEL,
      prodi,
      primaryController.signal,
      logger
    );
    clearTimeout(primaryTimeoutId);
    const executionTimeMs = Date.now() - primaryStartTime;

    logger.logLlmResponse({
      model: PRIMARY_MODEL,
      rawResponse,
      parsedCourses: courses,
      executionTimeMs,
      isFallback: false,
    });

    return {
      success: true,
      model_used: PRIMARY_MODEL,
      courses,
    };
  } catch (primaryError) {
    clearTimeout(primaryTimeoutId);
    const primaryExecutionTimeMs = Date.now() - primaryStartTime;

    const fallbackReason =
      primaryError instanceof Error && primaryError.name === 'AbortError'
        ? 'primary_timeout'
        : 'primary_error';

    logger.logLlmError({
      model: PRIMARY_MODEL,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      executionTimeMs: primaryExecutionTimeMs,
    });

    console.warn(
      `Primary model (${PRIMARY_MODEL}) failed [${fallbackReason}]:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );

    // Try fallback model with 45s timeout
    const fallbackController = new AbortController();
    const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 45000);
    const fallbackStartTime = Date.now();

    try {
      const { courses, rawResponse } = await callOpenRouter(
        imageBase64,
        FALLBACK_MODEL,
        prodi,
        fallbackController.signal,
        logger
      );
      clearTimeout(fallbackTimeoutId);
      const fallbackExecutionTimeMs = Date.now() - fallbackStartTime;

      logger.logLlmResponse({
        model: FALLBACK_MODEL,
        rawResponse,
        parsedCourses: courses,
        executionTimeMs: fallbackExecutionTimeMs,
        isFallback: true,
        fallbackReason,
      });

      return {
        success: true,
        model_used: FALLBACK_MODEL,
        courses,
        fallback_reason: fallbackReason,
      };
    } catch (fallbackError) {
      clearTimeout(fallbackTimeoutId);
      const fallbackExecutionTimeMs = Date.now() - fallbackStartTime;

      logger.logLlmError({
        model: FALLBACK_MODEL,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        executionTimeMs: fallbackExecutionTimeMs,
      });

      console.error('Fallback model also failed:', fallbackError);
      throw new Error(
        `Both primary and fallback models failed. ${
          fallbackError instanceof Error ? fallbackError.message : ''
        }`
      );
    }
  }
}
