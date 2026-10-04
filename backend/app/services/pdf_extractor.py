import os
import io
from typing import Optional
import pdfplumber
import pytesseract
from PIL import Image

from app.config import settings


def extract_text_from_pdf(file_path: str) -> str:
    text_parts = []
    
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception:
        pass
    
    if not text_parts:
        text_parts = extract_text_from_pdf_ocr(file_path)
    
    return "\n\n".join(text_parts)


def extract_text_from_pdf_ocr(file_path: str) -> list:
    text_parts = []
    
    try:
        from pdf2image import convert_from_path
        
        if settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        
        images = convert_from_path(file_path, dpi=300)
        for img in images:
            page_text = pytesseract.image_to_string(img)
            if page_text.strip():
                text_parts.append(page_text)
    except Exception as e:
        print(f"OCR failed: {e}")
    
    return text_parts


def extract_text_from_image(file_path: str) -> str:
    try:
        img = Image.open(file_path)
        
        if settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        print(f"Image OCR failed: {e}")
        return ""


def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext in [".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp"]:
        return extract_text_from_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")