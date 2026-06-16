import requests

url = "https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6/raw/main/config.json"
response = requests.get(url)
print(response.json())
