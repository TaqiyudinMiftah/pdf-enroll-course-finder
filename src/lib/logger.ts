import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const APP_LOG_FILE = path.join(LOG_DIR, 'app.log');
const LLM_LOG_DIR = path.join(LOG_DIR, 'llm');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
if (!fs.existsSync(LLM_LOG_DIR)) {
  fs.mkdirSync(LLM_LOG_DIR, { recursive: true });
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  type: 'USER_INPUT' | 'LLM_REQUEST' | 'LLM_RESPONSE' | 'LLM_ERROR' | 'APP_ERROR';
  requestId: string;
  data: Record<string, unknown>;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function appendLog(entry: LogEntry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(APP_LOG_FILE, line, 'utf-8');
}

export function createLogger(requestId?: string) {
  const rid = requestId || generateRequestId();

  return {
    requestId: rid,

    logUserInput(input: {
      fileName: string;
      fileSize: number;
      fileType: string;
      imageBase64Length: number;
      prodi?: string;
    }) {
      appendLog({
        timestamp: formatTimestamp(),
        level: 'INFO',
        type: 'USER_INPUT',
        requestId: rid,
        data: input,
      });
      console.log(`[${rid}] USER_INPUT: ${input.fileName} (${input.fileSize} bytes)`);
    },

    logLlmRequest(params: {
      model: string;
      imageBase64Length: number;
      systemPromptLength: number;
      userPrompt: string;
    }) {
      appendLog({
        timestamp: formatTimestamp(),
        level: 'INFO',
        type: 'LLM_REQUEST',
        requestId: rid,
        data: params,
      });
      console.log(`[${rid}] LLM_REQUEST: model=${params.model}`);
    },

    logLlmResponse(params: {
      model: string;
      rawResponse: string;
      parsedCourses: unknown[];
      executionTimeMs: number;
      isFallback: boolean;
      fallbackReason?: string;
    }) {
      // Simpan raw response ke file terpisah untuk debugging
      const rawFileName = `${rid}_raw.txt`;
      const rawFilePath = path.join(LLM_LOG_DIR, rawFileName);
      fs.writeFileSync(
        rawFilePath,
        `Request ID: ${rid}\nModel: ${params.model}\nExecution Time: ${params.executionTimeMs}ms\nIs Fallback: ${params.isFallback}\nFallback Reason: ${params.fallbackReason || 'N/A'}\n\n--- RAW RESPONSE ---\n${params.rawResponse}\n\n--- PARSED COURSES ---\n${JSON.stringify(params.parsedCourses, null, 2)}\n`,
        'utf-8'
      );

      appendLog({
        timestamp: formatTimestamp(),
        level: 'INFO',
        type: 'LLM_RESPONSE',
        requestId: rid,
        data: {
          ...params,
          rawResponseFile: rawFileName,
        },
      });
      console.log(
        `[${rid}] LLM_RESPONSE: model=${params.model}, courses=${params.parsedCourses.length}, time=${params.executionTimeMs}ms`
      );
    },

    logLlmError(params: {
      model: string;
      error: string;
      executionTimeMs: number;
      rawResponse?: string;
    }) {
      appendLog({
        timestamp: formatTimestamp(),
        level: 'ERROR',
        type: 'LLM_ERROR',
        requestId: rid,
        data: params,
      });
      console.error(`[${rid}] LLM_ERROR: model=${params.model}, error=${params.error}`);
    },

    logAppError(error: unknown, context?: string) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      appendLog({
        timestamp: formatTimestamp(),
        level: 'ERROR',
        type: 'APP_ERROR',
        requestId: rid,
        data: {
          context,
          error: errorMsg,
          stack,
        },
      });
      console.error(`[${rid}] APP_ERROR: ${context || ''} ${errorMsg}`);
    },
  };
}
