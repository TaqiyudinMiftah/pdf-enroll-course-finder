import Database from 'better-sqlite3';
import { CourseCode } from './types';

const DB_PATH = process.env.DATABASE_PATH || './data/courses.db';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

export function initSchema() {
  const database = getDb();
  
  const sql = `
CREATE TABLE IF NOT EXISTS course_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prodi TEXT NOT NULL,
  kode_mk TEXT NOT NULL,
  nama_mk TEXT NOT NULL,
  kelas TEXT NOT NULL,
  kode_enroll TEXT NOT NULL,
  UNIQUE(kode_mk, kelas)
);

CREATE INDEX IF NOT EXISTS idx_nama_mk ON course_codes(nama_mk);
CREATE INDEX IF NOT EXISTS idx_kode_mk ON course_codes(kode_mk);
CREATE INDEX IF NOT EXISTS idx_prodi ON course_codes(prodi);
  `;
  
  database.exec(sql);
}

export function findExactMatch(namaMk: string, kelas: string): CourseCode | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM course_codes WHERE LOWER(nama_mk) = LOWER(?) AND LOWER(kelas) = LOWER(?) LIMIT 1'
  );
  return stmt.get(namaMk, kelas) as CourseCode | null;
}

export function findByKodeMk(kodeMk: string, kelas: string): CourseCode | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM course_codes WHERE kode_mk = ? AND LOWER(kelas) = LOWER(?) LIMIT 1'
  );
  return stmt.get(kodeMk, kelas) as CourseCode | null;
}

export function getAllCourses(): CourseCode[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM course_codes');
  return stmt.all() as CourseCode[];
}

export function insertCourse(course: Omit<CourseCode, 'id'>): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO course_codes (prodi, kode_mk, nama_mk, kelas, kode_enroll) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(course.prodi, course.kode_mk, course.nama_mk, course.kelas, course.kode_enroll);
}

export function clearCourses(): void {
  const db = getDb();
  db.prepare('DELETE FROM course_codes').run();
}
