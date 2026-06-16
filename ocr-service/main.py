"""
main.py — FastAPI OCR Service (client untuk vLLM)

Arsitektur baru:
  - FastAPI menerima request HTTP (gambar base64)
  - engine.py memanggil vLLM server via OpenAI-compatible API
  - Tidak ada GPU loading di sini — GPU dikelola oleh vLLM server

Prasyarat:
  1. Jalankan start_vllm.bat (vLLM server di port 8118)
  2. Jalankan service ini: uvicorn main:app --host 0.0.0.0 --port 8000

Workers BOLEH lebih dari 1 karena tidak ada state GPU di sini.
"""

import os
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from engine import extract_courses_from_image

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

OCR_PORT       = int(os.getenv("OCR_PORT", "8000"))
MAX_QUEUE_SIZE = int(os.getenv("MAX_QUEUE_SIZE", "20"))

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Queue untuk membatasi concurrent request ke vLLM ─────────────────────────
# vLLM bisa handle concurrent, tapi kita batasi untuk mencegah queue panjang
gpu_queue: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
_worker_task: asyncio.Task | None = None


async def ocr_worker():
    """
    Background worker: serialisasi request ke vLLM.
    vLLM handles GPU concurrency sendiri, tapi ini mencegah overload.
    """
    logger.info("OCR worker started. Queue max: %d", MAX_QUEUE_SIZE)
    while True:
        try:
            image_base64, prodi_hint, future = await gpu_queue.get()
            start_time = time.perf_counter()
            try:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    extract_courses_from_image,
                    image_base64,
                    prodi_hint,
                )
                elapsed = time.perf_counter() - start_time
                courses = result.get("courses", []) if isinstance(result, dict) else []
                logger.info(
                    "OCR done in %.2fs — %d courses. Queue: %d",
                    elapsed, len(courses), gpu_queue.qsize(),
                )
                if not future.done():
                    future.set_result(result)
            except Exception as e:
                logger.error("OCR error: %s", e)
                if not future.done():
                    future.set_exception(e)
            finally:
                gpu_queue.task_done()
        except asyncio.CancelledError:
            logger.info("OCR worker cancelled.")
            break
        except Exception as e:
            logger.error("Unexpected worker error: %s", e)


# ── Startup & Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task

    # Cek koneksi ke vLLM saat startup
    logger.info("Checking vLLM server connection...")
    from engine import get_vllm_client
    try:
        client = get_vllm_client()
        models = client.models.list()
        model_ids = [m.id for m in models.data]
        logger.info("vLLM connected. Available models: %s", model_ids)
    except Exception as e:
        logger.warning(
            "vLLM server tidak dapat dihubungi saat startup: %s\n"
            "Pastikan start_vllm.bat sudah berjalan.", e
        )

    # Start worker
    _worker_task = asyncio.create_task(ocr_worker())
    logger.info("OCR service ready on port %d", OCR_PORT)

    yield

    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    logger.info("OCR service shut down.")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="PaddleOCR-VL Service",
    description="OCR service menggunakan PaddleOCR-VL-1.6 via vLLM untuk ekstraksi jadwal KRS",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Pydantic Models ───────────────────────────────────────────────────────────
class OcrRequest(BaseModel):
    image: str                   # base64 data URL atau raw base64
    prodi: Optional[str] = None  # hint program studi (opsional)


class CourseItem(BaseModel):
    nama_mk: str
    kelas: str
    prodi: Optional[str] = None
    kode_mk: Optional[str] = None


class OcrResponse(BaseModel):
    success: bool
    model_used: str
    method: str = "vllm_table"
    courses: list[CourseItem]
    raw_ocr: list[str] = []       # baris teks mentah dari VLM (untuk debugging)
    raw_html: list[str] = []      # HTML tabel jika ada
    queue_position: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    vllm_connected: bool
    vllm_url: str
    queue_size: int
    queue_max: int


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Monitoring"])
async def health_check():
    """Cek status service dan koneksi ke vLLM."""
    from engine import VLLM_BASE_URL, get_vllm_client
    vllm_ok = False
    try:
        client = get_vllm_client()
        client.models.list()
        vllm_ok = True
    except Exception:
        pass

    return HealthResponse(
        status="ok" if vllm_ok else "degraded",
        vllm_connected=vllm_ok,
        vllm_url=VLLM_BASE_URL,
        queue_size=gpu_queue.qsize(),
        queue_max=MAX_QUEUE_SIZE,
    )


@app.post("/ocr", response_model=OcrResponse, tags=["OCR"])
async def extract_text(req: OcrRequest):
    """
    Ekstrak mata kuliah dari screenshot jadwal KRS.

    - Terima gambar dalam format base64 (data URL atau raw)
    - Kirim ke vLLM (PaddleOCR-VL-1.6) dengan prompt "Table Recognition:"
    - Return list mata kuliah: nama_mk, kelas, prodi, kode_mk
    """
    if not req.image:
        raise HTTPException(status_code=400, detail="Field 'image' wajib diisi")

    if gpu_queue.full():
        raise HTTPException(
            status_code=503,
            detail=f"Server sedang sibuk. Antrian penuh ({MAX_QUEUE_SIZE}). Coba lagi.",
        )

    queue_pos = gpu_queue.qsize() + 1
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()

    await gpu_queue.put((req.image, req.prodi, future))

    try:
        result = await asyncio.wait_for(future, timeout=300.0)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Waktu pemrosesan habis (>300 detik). Coba upload gambar lebih kecil.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses: {str(e)}")

    courses_data = result.get("courses", []) if isinstance(result, dict) else []
    raw_ocr      = result.get("raw_ocr",  []) if isinstance(result, dict) else []
    raw_html     = result.get("raw_html", []) if isinstance(result, dict) else []
    method       = result.get("method", "vllm_table") if isinstance(result, dict) else "vllm_table"

    return OcrResponse(
        success=True,
        model_used="PaddleOCR-VL-1.6",
        method=method,
        courses=[CourseItem(**c) for c in courses_data],
        raw_ocr=raw_ocr,
        raw_html=raw_html,
        queue_position=queue_pos,
    )


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=OCR_PORT,
        workers=1,
        log_level="debug",
    )
