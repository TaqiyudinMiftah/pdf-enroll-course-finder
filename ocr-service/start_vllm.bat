@echo off
:: ============================================================
:: Start vLLM server via Docker (PaddleOCR-VL-1.6)
::
:: Prasyarat:
::   - Docker Desktop sudah terinstall dan berjalan
::   - NVIDIA Container Toolkit sudah terinstall
::     (biasanya sudah include di Docker Desktop dengan GPU support)
::
:: Jalankan script ini SEBELUM menjalankan FastAPI service.
:: Server akan berjalan di http://localhost:8118
:: ============================================================

echo [vLLM] Memulai vLLM server via Docker...
echo [vLLM] Model: PaddlePaddle/PaddleOCR-VL-1.6
echo [vLLM] Port: 8118
echo [vLLM] GPU Memory Utilization: 70%%
echo.
echo [vLLM] Download model ~2GB akan terjadi otomatis saat pertama kali.
echo [vLLM] Cache disimpan di volume 'vllm-model-cache'.
echo.

:: Jalankan PaddleOCR GenAI Server dalam container Docker dengan GPU access
docker run --rm ^
    --name vllm-paddleocr ^
    --gpus all ^
    -p 8118:8118 ^
    -v vllm-model-cache:/root/.cache/huggingface ^
    -v "%cd%\backend_config.json:/backend_config.json" ^
    --ipc=host ^
    --ulimit memlock=-1 ^
    --ulimit stack=67108864 ^
    ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-genai-vllm-server:latest-nvidia-gpu ^
    paddleocr genai_server ^
        --model_name PaddleOCR-VL-1.6-0.9B ^
        --host 0.0.0.0 ^
        --port 8118 ^
        --backend vllm ^
        --backend_config /backend_config.json

echo.
echo [vLLM] Server berhenti.
pause
