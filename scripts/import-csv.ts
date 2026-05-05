import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { clearCourses, insertCourse } from '../src/lib/db';

function findCsvFile(): string | null {
  const files = fs.readdirSync('.');
  const csvFile = files.find(f => f.endsWith('.csv') && f.includes('Enroll'));
  return csvFile || null;
}

interface CsvRecord {
  [key: string]: string;
}

async function importCsv() {
  const csvFile = findCsvFile();
  
  if (!csvFile) {
    console.error('No CSV file found in current directory');
    process.exit(1);
  }

  console.log('Found CSV file: ' + csvFile);
  
  const fileContent = fs.readFileSync(csvFile, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRecord[];

  console.log('Found ' + records.length + ' records to import');

  // Clear existing data
  clearCourses();
  console.log('Cleared existing data');

  // Insert new data
  for (const record of records) {
    const course = {
      prodi: record['Program Studi'] || record['prodi'] || '',
      kode_mk: record['Kode MK'] || record['kode_mk'] || '',
      nama_mk: record['Nama MK'] || record['nama_mk'] || '',
      kelas: record['Kelas'] || record['kelas'] || '',
      kode_enroll: record['kode enroll course kelas'] || record['kode_enroll'] || '',
    };

    if (course.prodi && course.kode_mk && course.nama_mk && course.kelas && course.kode_enroll) {
      insertCourse(course);
    }
  }

  console.log('Successfully imported ' + records.length + ' courses');
}

importCsv().catch(console.error);
