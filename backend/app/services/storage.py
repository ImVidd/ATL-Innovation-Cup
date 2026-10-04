import os
from typing import Optional, BinaryIO
from supabase import create_client, Client

from app.config import settings

_supabase: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    global _supabase
    if _supabase is None and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase


def upload_file(path: str, content: bytes) -> str:
    supabase = get_supabase()
    if supabase:
        bucket = settings.STORAGE_BUCKET
        supabase.storage.from_(bucket).upload(
            path=path,
            file=content,
            file_options={"content-type": "application/octet-stream"}
        )
        return f"{bucket}/{path}"
    
    local_dir = os.path.join("uploads", os.path.dirname(path))
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join("uploads", path)
    with open(local_path, "wb") as f:
        f.write(content)
    return local_path


def download_file(path: str) -> bytes:
    supabase = get_supabase()
    if supabase:
        bucket = settings.STORAGE_BUCKET
        return supabase.storage.from_(bucket).download(path)
    
    local_path = os.path.join("uploads", path)
    with open(local_path, "rb") as f:
        return f.read()


def delete_file(path: str) -> bool:
    supabase = get_supabase()
    if supabase:
        bucket = settings.STORAGE_BUCKET
        supabase.storage.from_(bucket).remove([path])
        return True
    
    local_path = os.path.join("uploads", path)
    if os.path.exists(local_path):
        os.remove(local_path)
        return True
    return False


def get_file_url(path: str, expires_in: int = 3600) -> str:
    supabase = get_supabase()
    if supabase:
        bucket = settings.STORAGE_BUCKET
        return supabase.storage.from_(bucket).create_signed_url(path, expires_in)["signedURL"]
    
    return f"/uploads/{path}"