import os
import base64
from io import BytesIO
from PIL import Image
from openai import OpenAI

# Ambil gambar dari artifacts (atau buat gambar dummy jika tidak ada)
try:
    img_path = r"C:\Users\taqiy\.gemini\antigravity\brain\d3e7debe-9521-4c2e-8573-91dfdb1b9fde\media__1781436808370.png"
    img = Image.open(img_path).convert("RGB")
except Exception as e:
    # Buat gambar dummy
    print("Gambar tidak ditemukan, membuat gambar dummy tabel...")
    img = Image.new("RGB", (800, 600), color="white")

buf = BytesIO()
img.save(buf, format="JPEG")
b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
image_url = f"data:image/jpeg;base64,{b64}"

client = OpenAI(
    api_key="EMPTY",
    base_url="http://localhost:8118/v1",
)

print("Mengirim request ke vLLM...")
try:
    response = client.chat.completions.create(
        model="PaddlePaddle/PaddleOCR-VL-1.6",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    # Menambahkan token image secara eksplisit dalam teks untuk jaga-jaga
                    {"type": "text", "text": "<|IMAGE_START|><|IMAGE_PLACEHOLDER|><|IMAGE_END|>Table Recognition:"},
                ],
            }
        ],
        temperature=0.0,
        max_tokens=1024,
    )
    print("RESPONSE:")
    print(response.choices[0].message.content)
except Exception as e:
    print("ERROR:", e)
