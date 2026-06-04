from __future__ import annotations

import secrets
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from PIL import Image

from app.core.config import settings


class LocalStorage:
    def __init__(self, upload_dir: str) -> None:
        self.root = Path(upload_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, file: UploadFile, *, prefix: str) -> str:
        data = _optimized_image_bytes(file)
        if len(data) > settings.max_upload_bytes:
            raise ValueError("Images must be 5MB or smaller after optimization")
        name = f"{prefix}-{secrets.token_urlsafe(12)}.jpg"
        target = self.root / name
        with target.open("wb") as output:
            output.write(data)
        return f"/uploads/{name}"


class CloudinaryStorage:
    def save(self, file: UploadFile, *, prefix: str) -> str:
        has_cloudinary_url = bool(settings.cloudinary_url)
        has_cloudinary_keys = bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)
        if not has_cloudinary_url and not has_cloudinary_keys:
            raise ValueError("Cloudinary storage requires UBOOK_CLOUDINARY_URL or UBOOK_CLOUDINARY_CLOUD_NAME, UBOOK_CLOUDINARY_API_KEY, and UBOOK_CLOUDINARY_API_SECRET")
        try:
            import cloudinary
            import cloudinary.uploader
        except ImportError as exc:
            raise ValueError("Cloudinary storage requires the cloudinary package") from exc
        if settings.cloudinary_url:
            cloudinary.config(cloudinary_url=settings.cloudinary_url, secure=True)
        else:
            cloudinary.config(
                cloud_name=settings.cloudinary_cloud_name,
                api_key=settings.cloudinary_api_key,
                api_secret=settings.cloudinary_api_secret,
                secure=True,
            )
        result = cloudinary.uploader.upload(BytesIO(_optimized_image_bytes(file)), folder=prefix, resource_type="image")
        return str(result["secure_url"])


class S3Storage:
    def save(self, file: UploadFile, *, prefix: str) -> str:
        if not settings.s3_bucket:
            raise ValueError("S3 storage requires UBOOK_S3_BUCKET")
        try:
            import boto3
        except ImportError as exc:
            raise ValueError("S3 storage requires boto3") from exc
        key = f"{prefix}/{secrets.token_urlsafe(12)}.jpg"
        client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        client.upload_fileobj(BytesIO(_optimized_image_bytes(file)), settings.s3_bucket, key, ExtraArgs={"ContentType": "image/jpeg"})
        if settings.public_assets_base_url:
            return f"{settings.public_assets_base_url.rstrip('/')}/{key}"
        return f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"


def _optimized_image_bytes(file: UploadFile) -> bytes:
    raw = file.file.read()
    if len(raw) > settings.max_upload_bytes:
        raise ValueError("Images must be 5MB or smaller")
    content_type = (file.content_type or "").lower()
    suffix = Path(file.filename or "").suffix.lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"} or suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ValueError("Only JPG, PNG, and WEBP images are supported")
    try:
        image = Image.open(BytesIO(raw))
        image.verify()
        image = Image.open(BytesIO(raw))
    except Exception as exc:
        raise ValueError("Invalid image file") from exc
    if image.width < 320 or image.height < 240:
        raise ValueError("Image dimensions are too small")
    if image.width > 9000 or image.height > 9000:
        raise ValueError("Image dimensions are too large")
    image = image.convert("RGB")
    image.thumbnail((1800, 1800))
    output = BytesIO()
    image.save(output, format="JPEG", optimize=True, quality=85)
    return output.getvalue()


def _storage_provider():
    if settings.storage_provider == "cloudinary":
        return CloudinaryStorage()
    if settings.storage_provider == "s3":
        return S3Storage()
    return LocalStorage(settings.local_upload_dir)


storage = _storage_provider()
