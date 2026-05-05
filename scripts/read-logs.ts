import fs from 'fs';
import path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'logs', 'app.log');
const LLM_DIR = path.resolve(process.cwd(), 'logs', 'llm');

function readLogs(filterType?: string, filterRequestId?: string) {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('No logs found.');
    return;
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);

      if (filterType && entry.type !== filterType) continue;
      if (filterRequestId && entry.requestId !== filterRequestId) continue;

      const time = new Date(entry.timestamp).toLocaleTimeString('id-ID');
      const emoji =
        entry.level === 'ERROR' ? '❌' : entry.level === 'WARN' ? '⚠️' : '📋';

      console.log(`${emoji} [${time}] ${entry.type} | req=${entry.requestId}`);
      console.log(JSON.stringify(entry.data, null, 2));
      console.log('─'.repeat(60));
    } catch {
      console.log('⚠️  Malformed log line:', line.substring(0, 100));
    }
  }
}

function listLlmRawLogs() {
  if (!fs.existsSync(LLM_DIR)) {
    console.log('No LLM raw logs found.');
    return;
  }

  const files = fs.readdirSync(LLM_DIR).sort();
  console.log(`Found ${files.length} LLM raw response files:\n`);

  for (const file of files) {
    const content = fs.readFileSync(path.join(LLM_DIR, file), 'utf-8');
    const firstLine = content.split('\n')[0];
    const modelLine = content.split('\n')[1];
    const timeLine = content.split('\n')[2];
    console.log(`📄 ${file}`);
    console.log(`   ${firstLine}`);
    console.log(`   ${modelLine}`);
    console.log(`   ${timeLine}`);
    console.log('');
  }
}

function showLlmRawLog(fileName: string) {
  const filePath = path.join(LLM_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${fileName}`);
    return;
  }
  console.log(fs.readFileSync(filePath, 'utf-8'));
}

// CLI usage
const args = process.argv.slice(2);
const command = args[0];

if (command === 'raw') {
  listLlmRawLogs();
} else if (command === 'show') {
  showLlmRawLog(args[1]);
} else if (command === 'type') {
  readLogs(args[1]);
} else if (command === 'req') {
  readLogs(undefined, args[1]);
} else {
  console.log('Usage:');
  console.log('  npx tsx scripts/read-logs.ts          - Show all logs');
  console.log('  npx tsx scripts/read-logs.ts raw      - List LLM raw response files');
  console.log('  npx tsx scripts/read-logs.ts show <file> - Show a specific LLM raw log');
  console.log('  npx tsx scripts/read-logs.ts type <TYPE> - Filter by type (USER_INPUT|LLM_REQUEST|LLM_RESPONSE|LLM_ERROR|APP_ERROR)');
  console.log('  npx tsx scripts/read-logs.ts req <id>    - Filter by request ID');
  console.log('\nShowing all logs:\n');
  readLogs();
}
