# PRD — Sistem Pencari Kode Enroll Mata Kuliah
**Versi:** 1.0  
**Status:** Draft  
**Dibuat:** 2026-05

---

## 1. Ringkasan Produk

### Latar Belakang
Setelah mengisi KRS, mahasiswa harus membuka Looker Studio secara manual, mencocokkan nama mata kuliah dan kelas satu per satu untuk mendapatkan kode enroll. Proses ini repetitif, rawan salah, dan membuang waktu.

### Tujuan
Mahasiswa cukup mengunggah **screenshot jadwal KRS**, sistem secara otomatis mengembalikan daftar **kode enroll** untuk semua mata kuliah yang terdeteksi — dalam satu tampilan, tanpa navigasi manual ke Looker Studio.

### Target Pengguna
- **Primer:** Mahasiswa aktif yang baru selesai mengisi KRS
- **Sekunder:** Admin/staf akademik yang mengelola data kode enroll

---

## 2. Alur Sistem (Happy Path)

```
[Mahasiswa upload screenshot]
        ↓
[Frontend kirim gambar ke backend]
        ↓
[Backend kirim ke OpenRouter API — model utama: nvidia/nemotron-ultra-253b-v1]
        ↓
[LLM ekstrak: Nama MK, Kelas, Program Studi → JSON]
        ↓
[Backend query database SQLite]
        ↓
[Return hasil: kode enroll per mata kuliah]
        ↓
[Frontend tampilkan hasil + status match]
```

### Fallback Flow (jika model utama gagal/timeout)
```
Model utama gagal (timeout 15 detik / error 5xx)
        ↓
Retry dengan model fallback: nvidia/llama-3.2-nemotron-nano-vl-8b-v1  (via OpenRouter)
        ↓
Jika fallback juga gagal → tampilkan form input manual
```

---

## 3. Fitur & User Stories

### MVP (Fase 1)

| ID | User Story | Prioritas |
|----|-----------|-----------|
| F01 | Sebagai mahasiswa, saya bisa upload screenshot jadwal (JPG/PNG/WebP, maks 5MB) | P0 |
| F02 | Sistem secara otomatis mengekstrak daftar mata kuliah dari gambar | P0 |
| F03 | Saya bisa melihat dan mengedit hasil ekstraksi sebelum dicari | P0 |
| F04 | Sistem menampilkan kode enroll beserta status (ditemukan/tidak ditemukan) | P0 |
| F05 | Jika ekstraksi gagal, tersedia form input manual sebagai fallback | P0 |
| F06 | Saya bisa menyalin semua kode enroll sekaligus dengan satu klik | P1 |

### Fase 2 (Post-MVP)

| ID | User Story | Prioritas |
|----|-----------|-----------|
| F07 | Admin bisa upload CSV baru untuk memperbarui database setiap semester | P1 |
| F08 | Sistem menampilkan confidence score dari hasil ekstraksi LLM | P2 |
| F09 | Riwayat pencarian tersimpan selama sesi berlangsung | P2 |
| F10 | Export hasil ke format teks/clipboard yang rapi | P2 |

---

## 4. Spesifikasi Teknis

### Stack yang Direkomendasikan
```
Frontend  : Next.js 14 (App Router) + Tailwind CSS
Backend   : Next.js API Routes (atau FastAPI jika dipisah)
Database  : SQLite via better-sqlite3 (Node) atau sqlite3 (Python)
LLM API   : OpenRouter (https://openrouter.ai/api/v1)
Deployment: Vercel / Railway / server lokal fakultas
```

### Model LLM
```
Model Utama  : nvidia/nemotron-ultra-253b-v1
Model Fallback: nvidia/llama-3.2-nemotron-nano-vl-8b-v1
API Base URL : https://openrouter.ai/api/v1
Endpoint     : POST /chat/completions
Timeout      : 15 detik (sebelum switch ke fallback)
```

### Environment Variables
```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_PRIMARY_MODEL=nvidia/nemotron-ultra-253b-v1
OPENROUTER_FALLBACK_MODEL=nvidia/llama-3.2-nemotron-nano-vl-8b-v1
DATABASE_PATH=./data/courses.db
```

---

## 5. Schema Database

```sql
CREATE TABLE course_codes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  prodi        TEXT NOT NULL,    -- contoh: "Teknologi Informasi"
  kode_mk      TEXT NOT NULL,    -- contoh: "CSD60706"
  nama_mk      TEXT NOT NULL,    -- contoh: "Administrasi Basis Data"
  kelas        TEXT NOT NULL,    -- contoh: "A" atau "N1G"
  kode_enroll  TEXT NOT NULL,    -- contoh: "TI-ABDta-A"
  UNIQUE(kode_mk, kelas)
);

CREATE INDEX idx_nama_mk ON course_codes(nama_mk);
CREATE INDEX idx_kode_mk ON course_codes(kode_mk);
CREATE INDEX idx_prodi   ON course_codes(prodi);
```

### Contoh Data
```
prodi                  | kode_mk  | nama_mk                 | kelas | kode_enroll
Teknologi Informasi    | CSD60706 | Administrasi Basis Data  | A     | TI-ABDta-A
Teknologi Informasi    | MPK60001 | Agama Islam              | N1G   | TI-AIam-N1G
Teknologi Informasi    | MPK60001 | Agama Islam              | N1H   | TI-AIam-N1H
```

---

## 6. Spesifikasi API

### POST /api/extract
Menerima gambar, mengembalikan daftar mata kuliah yang diekstrak.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "prodi": "Teknologi Informasi"  // opsional, sebagai hint untuk LLM
}
```

**Response (success):**
```json
{
  "success": true,
  "model_used": "nvidia/nemotron-ultra-253b-v1",
  "courses": [
    {
      "nama_mk": "Administrasi Basis Data",
      "kelas": "A",
      "prodi": "Teknologi Informasi",
      "confidence": "high"
    }
  ]
}
```

**Response (fallback triggered):**
```json
{
  "success": true,
  "model_used": "nvidia/llama-3.2-nemotron-nano-vl-8b-v1",
  "fallback_reason": "primary_timeout",
  "courses": [...]
}
```

---

### POST /api/lookup
Menerima daftar mata kuliah, mengembalikan kode enroll dari database.

**Request:**
```json
{
  "courses": [
    { "nama_mk": "Administrasi Basis Data", "kelas": "A", "prodi": "Teknologi Informasi" }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "nama_mk": "Administrasi Basis Data",
      "kelas": "A",
      "kode_enroll": "TI-ABDta-A",
      "match_type": "exact",
      "found": true
    }
  ]
}
```

**match_type values:** `exact` | `fuzzy` | `kode_mk` | `not_found`

---

## 7. Prompt LLM (Ekstraksi OCR)

> Gunakan prompt ini persis sebagai `system` message. Jangan ubah struktur JSON output-nya.

### System Prompt
```
Kamu adalah sistem OCR khusus untuk membaca jadwal mata kuliah mahasiswa.
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
- Abaikan informasi selain nama MK, kelas, dan prodi (SKS, dosen, ruang, jadwal jam)
```

### User Message (dikirim bersama gambar)
```
Ekstrak semua mata kuliah dari jadwal ini.
```

### Contoh Output yang Diharapkan
```json
[
  {
    "nama_mk": "Administrasi Basis Data",
    "kelas": "A",
    "prodi": "Teknologi Informasi",
    "kode_mk": "CSD60706"
  },
  {
    "nama_mk": "Agama Islam",
    "kelas": "N1G",
    "prodi": null
  }
]
```

---

## 8. Logika Matching Database

Jalankan pencarian secara berurutan, berhenti saat ditemukan:

```
1. EXACT MATCH
   WHERE LOWER(nama_mk) = LOWER(input_nama) AND LOWER(kelas) = LOWER(input_kelas)
   
2. KODE MK MATCH (jika LLM berhasil baca kode_mk)
   WHERE kode_mk = input_kode_mk AND LOWER(kelas) = LOWER(input_kelas)
   
3. FUZZY MATCH pada nama_mk
   Gunakan library: fuzzysearch / fuse.js (JS) atau rapidfuzz (Python)
   Threshold: similarity >= 0.85
   Pilih hasil dengan score tertinggi
   
4. NOT FOUND
   Kembalikan { found: false, suggestion: "Cek ejaan atau hubungi admin" }
```

---

## 9. Spesifikasi Frontend

### Komponen Utama
```
/app
  /page.tsx              — Halaman utama: upload + hasil
  /components
    UploadZone.tsx        — Drag & drop + klik untuk upload gambar
    ExtractedList.tsx     — Tabel hasil ekstraksi yang bisa diedit
    ResultTable.tsx       — Tabel kode enroll hasil lookup
    ManualForm.tsx        — Form fallback input manual
    CopyAllButton.tsx     — Tombol salin semua kode sekaligus
  /api
    extract/route.ts      — Endpoint ekstraksi LLM
    lookup/route.ts       — Endpoint query database
```

### State Flow di Frontend
```
idle → uploading → extracting → reviewing → looking_up → done
                                    ↓
                               (user edit)
                                    ↓
                              looking_up → done
```

### UI Requirements
- Loading state saat LLM memproses (tampilkan "Membaca jadwal...")
- Jika fallback aktif, tampil badge kecil "Model alternatif digunakan"
- Setiap baris hasil punya status chip: ✓ Ditemukan / ✗ Tidak ditemukan
- Tombol "Salin Semua" hanya menyalin kode enroll yang statusnya "ditemukan"

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Screenshot buram/terpotong | Ekstraksi gagal atau tidak akurat | Form manual sebagai fallback wajib |
| Nama MK tidak konsisten di database | Kode tidak ditemukan padahal ada | Fuzzy matching + normalisasi teks |
| OpenRouter API timeout/down | Fitur utama tidak berfungsi | Fallback model + form manual |
| Database tidak ter-update per semester | Kode tidak ditemukan untuk MK baru | Halaman admin upload CSV |
| LLM hallucinate nama MK | Hasil pencarian salah | User bisa edit hasil ekstraksi sebelum lookup |

---

## 11. Kriteria Selesai (Definition of Done)

### Fase 1 — MVP
- [ ] Mahasiswa dapat upload screenshot dan mendapat kode enroll dalam ≤ 15 detik
- [ ] Akurasi ekstraksi ≥ 90% pada screenshot yang terbaca jelas
- [ ] Semua data CSV yang diberikan ter-import dan bisa di-query
- [ ] Fallback ke model Nemotron Nano 12B berfungsi jika model utama timeout
- [ ] Form manual tersedia dan berfungsi sebagai last resort
- [ ] Tombol "Salin Semua" menyalin kode enroll ke clipboard
- [ ] Aplikasi bisa diakses di browser tanpa install apapun

### Fase 2
- [ ] Admin bisa upload CSV baru via halaman admin
- [ ] Fuzzy matching bekerja dengan benar (tes dengan variasi ejaan)
- [ ] Confidence score ditampilkan per hasil ekstraksi

---

## 12. Referensi

- OpenRouter API Docs: https://openrouter.ai/docs
- Model utama: https://openrouter.ai/nvidia/nemotron-ultra-253b-v1
- Model fallback: https://openrouter.ai/nvidia/llama-3.2-nemotron-nano-vl-8b-v1
- Sumber data asli: Looker Studio Fakultas (https://datastudio.google.com/u/0/reporting/a7d3ca31-d40d-4065-956c-70ed78f616e8/page/hvv0C)
