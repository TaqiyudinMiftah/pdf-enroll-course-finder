import { NextRequest, NextResponse } from 'next/server';
import Fuse from 'fuse.js';
import { findExactMatch, findByKodeMk, getAllCourses } from '@/lib/db';
import { Course, LookupResult } from '@/lib/types';

const FUSE_THRESHOLD = 0.85;

function normalizeKelas(kelas: string): string {
  let normalized = kelas.trim().toUpperCase();
  // Fix OCR errors for 3-character classes like N8N (read as NBN), N6E (read as NGE)
  if (normalized.length === 3 && normalized.startsWith('N')) {
    const chars = normalized.split('');
    const middle = chars[1];
    const corrections: Record<string, string> = {
      'B': '8',
      'G': '6',
      'S': '5',
      'Z': '2',
      'O': '0',
      'I': '1',
      'L': '1',
      'T': '7',
      'A': '4',
      'Q': '0'
    };
    if (corrections[middle]) {
      chars[1] = corrections[middle];
      normalized = chars.join('');
    }
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courses } = body;

    if (!Array.isArray(courses)) {
      return NextResponse.json(
        { error: 'Courses array is required' },
        { status: 400 }
      );
    }

    // Get all courses for fuzzy matching
    const allCourses = getAllCourses();
    const fuse = new Fuse(allCourses, {
      keys: ['nama_mk'],
      threshold: 1 - FUSE_THRESHOLD, // Fuse uses distance, not similarity
      includeScore: true,
    });

    const results: LookupResult[] = courses.map((course: Course) => {
      let { nama_mk, kelas, kode_mk } = course;
      kelas = normalizeKelas(kelas);

      // 1. Exact match
      const exactMatch = findExactMatch(nama_mk, kelas);
      if (exactMatch) {
        return {
          nama_mk,
          kelas,
          kode_enroll: exactMatch.kode_enroll,
          match_type: 'exact' as const,
          found: true,
        };
      }

      // 2. Kode MK match
      if (kode_mk) {
        const kodeMatch = findByKodeMk(kode_mk, kelas);
        if (kodeMatch) {
          return {
            nama_mk,
            kelas,
            kode_enroll: kodeMatch.kode_enroll,
            match_type: 'kode_mk' as const,
            found: true,
          };
        }
      }

      // 3. Fuzzy match
      const fuzzyResults = fuse.search(nama_mk);
      if (fuzzyResults.length > 0) {
        const bestMatch = fuzzyResults[0];
        const score = bestMatch.score || 1;
        const similarity = 1 - score;

        if (similarity >= FUSE_THRESHOLD) {
          // Check if kelas matches
          const matchedCourse = bestMatch.item;
          if (matchedCourse.kelas.toLowerCase() === kelas.toLowerCase()) {
            return {
              nama_mk,
              kelas,
              kode_enroll: matchedCourse.kode_enroll,
              match_type: 'fuzzy' as const,
              found: true,
            };
          }
        }
      }

      // 4. Not found
      return {
        nama_mk,
        kelas,
        kode_enroll: null,
        match_type: 'not_found' as const,
        found: false,
        suggestion: 'Cek ejaan atau hubungi admin',
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Lookup API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
