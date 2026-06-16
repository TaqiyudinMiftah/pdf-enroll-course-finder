# OCR Service — PaddleOCR PP-Structure

Python microservice untuk ekstraksi jadwal KRS menggunakan PaddleOCR.
Berjalan lokal di port **8000**, dipanggil oleh Next.js di `/api/extract`.

---

## Prasyarat

- Python 3.10+
- NVIDIA GPU dengan CUDA 12.x (RTX 4050 sudah oke)
- CUDA Toolkit sudah terinstall → cek: `nvcc --version`

---

## Setup (Pertama Kali)

### 1. Buat virtual environment Python

```bash
cd ocr-service
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **Catatan:** `paddlepaddle-gpu` akan download package ~2GB. Pastikan koneksi stabil.
> Download model PaddleOCR (~500MB) terjadi otomatis saat pertama kali dijalankan.

### 3. Buat file `.env`

```bash
copy .env.example .env
```

Sesuaikan isi `.env` jika perlu (default sudah oke untuk RTX 4050).

---

## Menjalankan Service

```bash
# Pastikan venv aktif dulu
venv\Scripts\activate

# Jalankan service
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

> **PENTING:** Gunakan `--workers 1`. Jangan lebih dari 1 karena model PaddleOCR
> di-load ke GPU memory sekali saja — multiple workers akan menyebabkan OOM error.

Service berjalan di: **http://localhost:8000**
Swagger docs: **http://localhost:8000/docs**

---

## Endpoints

### `GET /health`
Cek status service.

```json
{
  "status": "ok",
  "queue_size": 0,
  "queue_max": 20,
  "model_loaded": true
}
```

### `POST /ocr`
Ekstrak mata kuliah dari gambar KRS.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "prodi": "Teknologi Informasi"
}
```

**Response:**
```json
{
  "success": true,
  "model_used": "PaddleOCR-PPStructure",
  "courses": [
    {
      "nama_mk": "Administrasi Basis Data",
      "kelas": "A",
      "prodi": "Teknologi Informasi",
      "kode_mk": "CSD60706"
    }
  ]
}
```

---

## Arsitektur Internal

```
POST /ocr (request masuk)
    ↓
asyncio.Queue (antrian GPU — max 20)
    ↓
GPU Worker (background task)
    ↓
PP-Structure → Layout Analysis → Table Recognition (SLANet)
    ↓
parse_table_html() → identifikasi kolom header
    ↓ (jika gagal)
Fallback: PaddleOCR biasa → coordinate grouping
    ↓
Response JSON
```

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `CUDA out of memory` | Turunkan `GPU_MEM_MB` di `.env` (misal: 3000) |
| Model tidak terdeteksi | Pastikan internet aktif saat pertama kali run (download model) |
| Tabel tidak terdeteksi | Screenshot kurang jelas atau format KRS tidak standar — fallback OCR biasa aktif otomatis |
| Service lambat | Normal untuk gambar besar. PP-Structure ~1-3 detik per gambar di GPU |
| Port 8000 sudah dipakai | Ubah `OCR_PORT` di `.env` dan `OCR_SERVICE_URL` di Next.js `.env.local` |
