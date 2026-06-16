"""
engine.py — PaddleOCR-VL-1.6 Inference Engine via vLLM

Arsitektur baru:
  1. Decode base64 image → PIL Image → base64 URL
  2. Kirim ke vLLM server (OpenAI-compatible API, port 8118)
     Prompt: "Table Recognition:"
  3. VLM mengembalikan HTML tabel yang bersih
  4. Parse HTML → ekstrak (nama_mk, kelas, kode_mk) → dedup

vLLM server harus berjalan terlebih dahulu:
  Jalankan: start_vllm.bat
"""

import os
import re
import base64
import logging
from io import BytesIO
from typing import Optional

from PIL import Image
from bs4 import BeautifulSoup
from openai import OpenAI, OpenAIError

logger = logging.getLogger(__name__)

# ── Konfigurasi dari environment ──────────────────────────────────────────────
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://localhost:8118/v1")
VLLM_MODEL    = os.getenv("VLLM_MODEL", "PaddleOCR-VL-1.6-0.9B")
VLLM_TIMEOUT  = float(os.getenv("VLLM_TIMEOUT", "300"))   # detik, tabel besar butuh lebih lama

# ── OpenAI client (mengarah ke vLLM lokal) ───────────────────────────────────
_vllm_client: OpenAI | None = None

def get_vllm_client() -> OpenAI:
    global _vllm_client
    if _vllm_client is None:
        _vllm_client = OpenAI(
            api_key="EMPTY",           # vLLM tidak butuh API key
            base_url=VLLM_BASE_URL,
            timeout=VLLM_TIMEOUT,
        )
        logger.info("vLLM client initialized → %s", VLLM_BASE_URL)
    return _vllm_client

# ── Keyword untuk mencocokkan header kolom ────────────────────────────────────
HEADER_KEYWORDS = {
    "nama_mk": [
        "mata kuliah", "nama mk", "nama mata kuliah",
        "matakuliah", "nama matkul", "matkul", "subject",
    ],
    "kelas": ["kelas", "class", "kls", "grup", "group"],
    "prodi":  ["program studi", "prodi", "jurusan", "program", "ps"],
    "kode_mk": ["kode mk", "kode mata kuliah", "kode matkul", "kode", "code mk"],
}

# ── Regex patterns ────────────────────────────────────────────────────────────

# Kode MK: 2-4 huruf kapital + 4-6 digit, kurung opsional
# Contoh: (CIF64213), CIF64213, CIF64213Nama
KODE_ANYWHERE = re.compile(r'\(?([A-Z]{2,4}\d{4,6})\)?')

# Pola kelas: A, B, C, N6E, N8N, N1G, dll
KELAS_FULLMATCH = re.compile(r'^([A-Z]\d[A-Z]|[A-Z]{1,3})$')

# Kolom yang harus diabaikan saat parsing
IGNORE_COLUMNS = {"hari", "jam", "waktu", "dosen", "ruang", "gedung", "action", "aksi", "sks"}


# ── Utility: decode base64 image ─────────────────────────────────────────────
def decode_image_to_pil(image_base64: str) -> Image.Image:
    """Decode base64 data URL atau raw base64 ke PIL Image (RGB)."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_base64)
    return Image.open(BytesIO(image_bytes)).convert("RGB")


def pil_to_base64_url(image: Image.Image, max_size: int = 1920) -> str:
    """Konversi PIL Image ke base64 data URL untuk dikirim ke vLLM.

    Resize ke max_size (lebar atau tinggi maks) agar tidak OOM di GPU.
    """
    w, h = image.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        image = image.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    buf = BytesIO()
    image.save(buf, format="JPEG", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


# ── Ekstrak kode_mk dan nama bersih dari teks sel MATA KULIAH ──────────────────
def parse_mata_kuliah_cell(raw_text: str) -> list[tuple[str, str | None]]:
    """
    Parsing teks dari kolom MATA KULIAH.
    Mengembalikan LIST karena satu sel bisa mengandung beberapa MK yang ter-merge.

    Contoh input → output:
    "(CIF64213) Keamanan Informasi"          → [("Keamanan Informasi", "CIF64213")]
    "CIF64213Keamanan Informasi"             → [("Keamanan Informasi", "CIF64213")]
    "( Kewirausahaan"                        → [("Kewirausahaan", None)]
    "CIF64213 Nama1 CIF64311 Nama2"          → [("Nama1","CIF64213"), ("Nama2","CIF64311")]
    """
    text = " ".join(raw_text.split())
    matches = list(KODE_ANYWHERE.finditer(text))

    if not matches:
        cleaned = re.sub(r'[()]+', '', text).strip()
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return [(cleaned, None)] if len(cleaned) >= 3 else []

    results: list[tuple[str, str | None]] = []

    for i, match in enumerate(matches):
        kode_mk   = match.group(1)
        name_start = match.end()
        name_end   = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        name_raw   = text[name_start:name_end]

        name_clean = re.sub(r'[()]+', '', name_raw)
        name_clean = re.sub(r'\s+', ' ', name_clean).strip()

        if len(name_clean) < 3:
            logger.debug("Skipping short fragment: %r (kode=%s)", name_clean, kode_mk)
            continue

        results.append((name_clean, kode_mk))

    if not results:
        no_code = KODE_ANYWHERE.sub('', text)
        no_code = re.sub(r'[()]+', '', no_code)
        no_code = re.sub(r'\s+', ' ', no_code).strip()
        first_code = matches[0].group(1) if matches else None
        if no_code and len(no_code) >= 3:
            return [(no_code, first_code)]

    return results


# ── Normalisasi kelas ─────────────────────────────────────────────────────────
def normalize_kelas(raw: str) -> str:
    """Bersihkan kelas: strip whitespace, uppercase. Kembalikan '' jika tidak valid."""
    cleaned = raw.strip().upper()
    m = KELAS_FULLMATCH.match(cleaned)
    return m.group(1) if m else ""


# ── Deduplikasi berdasarkan (kode_mk | nama_mk_normalized, kelas) ─────────────
def deduplicate_courses(courses: list[dict]) -> list[dict]:
    """
    Hapus duplikat.
    Key: (kode_mk.upper() atau nama_mk.lower(), kelas.upper())
    Pertahankan entry pertama.
    """
    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for c in courses:
        key_id = (c.get("kode_mk") or c.get("nama_mk", "")).upper()
        key = (key_id, c.get("kelas", "").upper())
        if key not in seen:
            seen.add(key)
            unique.append(c)
        else:
            logger.debug("Dedup: skip duplicate %s", key)
    return unique


# ── Parse HTML tabel dari VLM output ─────────────────────────────────────────
def parse_table_html(html: str, prodi_hint: str | None = None) -> list[dict]:
    """
    Parse HTML tabel dari output VLM.
    Identifikasi kolom MATA KULIAH dan KELAS, ekstrak data, dedup.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Ambil semua baris
    rows = soup.find_all("tr")
    if len(rows) < 2:
        logger.warning("parse_table_html: tabel terlalu kecil (%d baris)", len(rows))
        return []

    # ── Deteksi baris header ──────────────────────────────────────────────────
    header_row_idx = -1
    column_map: dict[int, str] = {}   # {col_idx: field_name}

    for row_idx, row in enumerate(rows[:5]):   # cari di 5 baris pertama
        cells = row.find_all(["th", "td"])
        candidate: dict[int, str] = {}
        for col_idx, cell in enumerate(cells):
            cell_text = cell.get_text(separator=" ", strip=True).lower()
            if any(kw in cell_text for kw in IGNORE_COLUMNS):
                continue
            for field, keywords in HEADER_KEYWORDS.items():
                if any(kw in cell_text for kw in keywords):
                    candidate[col_idx] = field
                    break
        if "nama_mk" in candidate.values():
            header_row_idx = row_idx
            column_map = candidate
            break

    if header_row_idx < 0:
        logger.warning("parse_table_html: header tidak ditemukan, coba heuristic.")
        return _parse_rows_heuristic_html(rows)

    logger.info("parse_table_html: header ditemukan di baris %d — kolom: %s",
                header_row_idx, column_map)

    # ── Parse data rows ───────────────────────────────────────────────────────
    courses: list[dict] = []

    for row in rows[header_row_idx + 1:]:
        cells = row.find_all(["th", "td"])
        if not cells:
            continue

        raw_values: dict[str, str] = {}
        for i, cell in enumerate(cells):
            if i in column_map:
                raw_values[column_map[i]] = cell.get_text(separator=" ", strip=True)

        if not raw_values.get("nama_mk"):
            continue

        kelas = normalize_kelas(raw_values.get("kelas", ""))
        prodi = raw_values.get("prodi") or prodi_hint

        parsed_list = parse_mata_kuliah_cell(raw_values["nama_mk"])

        # Override kode jika ada kolom kode_mk terpisah
        override_kode: str | None = None
        if raw_values.get("kode_mk"):
            m = KODE_ANYWHERE.search(raw_values["kode_mk"])
            if m:
                override_kode = m.group(1)

        for idx, (nama_mk, kode_mk) in enumerate(parsed_list):
            if not nama_mk or not kelas:
                continue
            final_kode = override_kode if (idx == 0 and override_kode) else kode_mk
            courses.append({
                "nama_mk": nama_mk,
                "kelas":   kelas,
                "prodi":   prodi or None,
                "kode_mk": final_kode,
            })

    logger.info("parse_table_html: %d raw, %d after dedup",
                len(courses), len(deduplicate_courses(courses)))
    return deduplicate_courses(courses)


def _parse_rows_heuristic_html(rows) -> list[dict]:
    """Heuristic fallback: scan setiap sel untuk kode MK tanpa header."""
    courses: list[dict] = []
    for row in rows:
        cells = row.find_all(["th", "td"])
        texts = [c.get_text(separator=" ", strip=True) for c in cells]

        for text in texts:
            if not KODE_ANYWHERE.search(text):
                continue
            parsed_list = parse_mata_kuliah_cell(text)
            if not parsed_list:
                continue

            kelas = ""
            for other in texts:
                if other == text:
                    continue
                m = KELAS_FULLMATCH.match(other.strip())
                if m:
                    kelas = m.group(1)
                    break

            if kelas:
                for nama_mk, kode_mk in parsed_list:
                    if nama_mk and len(nama_mk) >= 3:
                        courses.append({
                            "nama_mk": nama_mk,
                            "kelas":   kelas,
                            "prodi":   None,
                            "kode_mk": kode_mk,
                        })
            break

    return deduplicate_courses(courses)


# ── Parse output Markdown tabel (fallback jika VLM output bukan HTML) ─────────
_MD_SEP = re.compile(r'^\s*\|?[\s\-|:]+\|[\s\-|:]+\|?\s*$')

def parse_markdown_table(md_text: str, prodi_hint: str | None = None) -> list[dict]:
    """
    Parse tabel Markdown dari VLM output.
    Format: | Kolom1 | Kolom2 | ...
    """
    lines = [l.strip() for l in md_text.splitlines() if l.strip()]
    table_lines = [l for l in lines if l.startswith("|") and not _MD_SEP.match(l)]

    if len(table_lines) < 2:
        return []

    def split_row(line: str) -> list[str]:
        return [c.strip() for c in line.strip("|").split("|")]

    header_cells = split_row(table_lines[0])
    column_map: dict[int, str] = {}
    for i, h in enumerate(header_cells):
        h_lower = h.lower()
        for field, keywords in HEADER_KEYWORDS.items():
            if any(kw in h_lower for kw in keywords):
                column_map[i] = field
                break

    if "nama_mk" not in column_map.values():
        logger.warning("parse_markdown_table: tidak ada kolom nama_mk")
        return []

    courses: list[dict] = []
    for line in table_lines[1:]:
        cells = split_row(line)
        raw: dict[str, str] = {}
        for i, field in column_map.items():
            if i < len(cells):
                raw[field] = cells[i]

        if not raw.get("nama_mk"):
            continue

        kelas = normalize_kelas(raw.get("kelas", ""))
        prodi = raw.get("prodi") or prodi_hint
        parsed_list = parse_mata_kuliah_cell(raw["nama_mk"])

        for nama_mk, kode_mk in parsed_list:
            if nama_mk and kelas:
                courses.append({
                    "nama_mk": nama_mk,
                    "kelas":   kelas,
                    "prodi":   prodi or None,
                    "kode_mk": kode_mk,
                })

    return deduplicate_courses(courses)


# ── Kirim gambar ke vLLM dan dapatkan output mentah ───────────────────────────
def call_vllm(image_b64_url: str, prompt: str = "Table Recognition:") -> str:
    """
    Kirim image + prompt ke vLLM server (OpenAI-compatible API).
    Kembalikan teks output dari model.

    Raises: OpenAIError jika vLLM tidak dapat dihubungi.
    """
    client = get_vllm_client()
    response = client.chat.completions.create(
        model=VLLM_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_b64_url}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        temperature=0.0,
        max_tokens=3000,
    )
    return response.choices[0].message.content or ""


# ── Entry point ───────────────────────────────────────────────────────────────
def extract_courses_from_image(
    image_base64: str,
    prodi_hint: str | None = None,
) -> dict:
    """
    Main function: terima base64 image, kembalikan dict berisi:
      - courses: list of {nama_mk, kelas, prodi, kode_mk}
      - raw_ocr: output mentah dari VLM (untuk debugging)
      - method: 'vllm_table' atau 'vllm_ocr'
    """
    pil_image    = decode_image_to_pil(image_base64)
    img_b64_url  = pil_to_base64_url(pil_image)
    raw_ocr_text = ""
    courses: list[dict] = []
    method = "vllm_table"

    # ── Tahap 1: Table Recognition ───────────────────────────────────────────
    try:
        logger.info("Calling vLLM: Table Recognition...")
        raw_ocr_text = call_vllm(img_b64_url, prompt="Table Recognition:")
        logger.debug("vLLM raw output (first 500 chars): %s", raw_ocr_text[:500])

        # Coba parse native PaddleOCR-VL format (<fcel> dan <nl>)
        if "<fcel>" in raw_ocr_text:
            courses = _parse_paddleocr_table(raw_ocr_text, prodi_hint=prodi_hint)
            logger.info("Parsed as PaddleOCR <fcel> table → %d courses", len(courses))

        # Coba parse sebagai HTML
        elif "<table" in raw_ocr_text.lower():
            courses = parse_table_html(raw_ocr_text, prodi_hint=prodi_hint)
            logger.info("Parsed as HTML table → %d courses", len(courses))

        # Coba parse sebagai Markdown tabel
        elif "|" in raw_ocr_text:
            courses = parse_markdown_table(raw_ocr_text, prodi_hint=prodi_hint)
            logger.info("Parsed as Markdown table → %d courses", len(courses))

        # Fallback: scan teks mentah untuk kode MK
        if not courses:
            logger.warning("Table Recognition gagal parsing. Mencoba OCR plain text...")
            method = "vllm_ocr"
            raw_ocr_text = call_vllm(img_b64_url, prompt="OCR:")
            courses = _scan_raw_text_for_courses(raw_ocr_text, prodi_hint)
            logger.info("Raw OCR scan → %d courses", len(courses))

    except OpenAIError as e:
        logger.error("vLLM tidak dapat dihubungi: %s", e)
        return {
            "courses": [],
            "raw_ocr": [f"ERROR: vLLM server tidak berjalan. Jalankan start_vllm.bat terlebih dahulu. Detail: {e}"],
            "raw_html": [],
            "method": "error",
        }
    except Exception as e:
        logger.error("Unexpected error: %s", e, exc_info=True)
        return {
            "courses": [],
            "raw_ocr": [f"ERROR: {e}"],
            "raw_html": [],
            "method": "error",
        }

    # Inject prodi_hint jika ada
    if prodi_hint:
        for c in courses:
            if not c.get("prodi"):
                c["prodi"] = prodi_hint

    return {
        "courses":  courses,
        "raw_ocr":  raw_ocr_text.replace("<fcel>", " | ").replace("<nl>", "\n").splitlines(),  # untuk debugging yang mudah dibaca
        "raw_html": [raw_ocr_text] if "<table" in raw_ocr_text.lower() else [],
        "method":   method,
    }

def _parse_paddleocr_table(text: str, prodi_hint: str | None = None) -> list[dict]:
    """Parse format native PaddleOCR: <fcel> Kolom 1 <fcel> Kolom 2 <nl>"""
    lines = [line.strip() for line in text.split("<nl>") if line.strip()]
    if len(lines) < 2:
        return []

    def split_row(line: str) -> list[str]:
        # Hapus <fcel> di awal jika ada, lalu split
        cleaned = line.removeprefix("<fcel>")
        return [c.strip() for c in cleaned.split("<fcel>")]

    header_cells = split_row(lines[0])
    column_map: dict[int, str] = {}
    for i, h in enumerate(header_cells):
        h_lower = h.lower()
        for field, keywords in HEADER_KEYWORDS.items():
            if any(kw in h_lower for kw in keywords):
                column_map[i] = field
                break

    if "nama_mk" not in column_map.values():
        logger.warning("_parse_paddleocr_table: tidak ada kolom nama_mk di header")
        return []

    courses: list[dict] = []
    for line in lines[1:]:
        cells = split_row(line)
        raw: dict[str, str] = {}
        for i, field in column_map.items():
            if i < len(cells):
                raw[field] = cells[i]

        if not raw.get("nama_mk"):
            continue

        kelas = normalize_kelas(raw.get("kelas", ""))
        prodi = raw.get("prodi") or prodi_hint
        parsed_list = parse_mata_kuliah_cell(raw["nama_mk"])

        # Jika ada kolom kode_mk terpisah
        override_kode: str | None = None
        if raw.get("kode_mk"):
            m = KODE_ANYWHERE.search(raw["kode_mk"])
            if m:
                override_kode = m.group(1)

        for idx, (nama_mk, kode_mk) in enumerate(parsed_list):
            if nama_mk and kelas:
                final_kode = override_kode if (idx == 0 and override_kode) else kode_mk
                courses.append({
                    "nama_mk": nama_mk,
                    "kelas":   kelas,
                    "prodi":   prodi or None,
                    "kode_mk": final_kode,
                })

    return deduplicate_courses(courses)

def _scan_raw_text_for_courses(text: str, prodi_hint: str | None) -> list[dict]:
    """
    Last-resort: scan teks OCR mentah baris per baris.
    Cari pola kode MK dan kelas berdekatan (bisa di baris yang sama, atas, atau bawah).
    """
    courses: list[dict] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    for i, line in enumerate(lines):
        codes = KODE_ANYWHERE.findall(line)
        if not codes:
            continue

        parsed = parse_mata_kuliah_cell(line)
        if not parsed:
            continue

        # Cari kelas di baris yang sama, atau 1-2 baris setelahnya/sebelumnya
        kelas = ""
        # 1. Cek di baris yang sama
        for word in line.split():
            m = KELAS_FULLMATCH.match(word.strip())
            if m:
                kelas = m.group(1)
                break
        
        # 2. Cek di baris sekitar jika tidak ada di baris yang sama
        if not kelas:
            start_idx = max(0, i - 2)
            end_idx = min(len(lines), i + 3)
            for j in range(start_idx, end_idx):
                if j == i: continue
                # Periksa apakah baris sekitarnya fullmatch dengan format kelas (contoh: "A", "B", "C", "N6E")
                m = KELAS_FULLMATCH.match(lines[j])
                if m:
                    kelas = m.group(1)
                    break

        if kelas:
            for nama_mk, kode_mk in parsed:
                if nama_mk and len(nama_mk) >= 3:
                    courses.append({
                        "nama_mk": nama_mk,
                        "kelas":   kelas,
                        "prodi":   prodi_hint or None,
                        "kode_mk": kode_mk,
                    })

    return deduplicate_courses(courses)
