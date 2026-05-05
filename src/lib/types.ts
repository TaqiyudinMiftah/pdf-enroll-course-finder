export interface Course {
  nama_mk: string;
  kelas: string;
  prodi: string;
  kode_mk?: string;
  confidence?: string;
}

export interface ExtractResponse {
  success: boolean;
  model_used: string;
  courses: Course[];
  fallback_reason?: string;
}

export interface LookupRequest {
  courses: Course[];
}

export interface LookupResult {
  nama_mk: string;
  kelas: string;
  kode_enroll: string | null;
  match_type: 'exact' | 'fuzzy' | 'kode_mk' | 'not_found';
  found: boolean;
  suggestion?: string;
}

export interface LookupResponse {
  results: LookupResult[];
}

export interface CourseCode {
  id: number;
  prodi: string;
  kode_mk: string;
  nama_mk: string;
  kelas: string;
  kode_enroll: string;
}
