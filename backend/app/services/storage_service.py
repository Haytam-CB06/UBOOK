from __future__ import annotations

import secrets
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

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
    try:
        file.file.seek(0)
    except Exception:
        pass
    raw = file.file.read()
    raw_limit = max(settings.max_upload_bytes * 4, 20 * 1024 * 1024)
    if not raw:
        raise ValueError("Upload a valid image file")
    if len(raw) > raw_limit:
        raise ValueError("Images must be 20MB or smaller before optimization")
    try:
        with Image.open(BytesIO(raw)) as probe:
            probe.verify()
        with Image.open(BytesIO(raw)) as source:
            if source.width < 1 or source.height < 1:
                raise ValueError("Upload a valid image file")
            if source.width > 12000 or source.height > 12000 or (source.width * source.height) > 80_000_000:
                raise ValueError("Image dimensions are too large")
            image = ImageOps.exif_transpose(source)
            image.load()
    except ValueError:
        raise
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Upload a valid image file") from exc
    except Exception as exc:
        raise ValueError("Could not process this image") from exc

    if image.width > 12000 or image.height > 12000:
        raise ValueError("Image dimensions are too large")

    image.thumbnail((1800, 1800), Image.LANCZOS)
    if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
        image = image.convert("RGBA")
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.getchannel("A"))
        image = background
    else:
        image = image.convert("RGB")

    output = BytesIO()
    image.save(output, format="JPEG", optimize=True, quality=86, progressive=True)
    data = output.getvalue()
    if len(data) <= settings.max_upload_bytes:
        return data

    for quality in (80, 74, 68):
        output = BytesIO()
        image.save(output, format="JPEG", optimize=True, quality=quality, progressive=True)
        data = output.getvalue()
        if len(data) <= settings.max_upload_bytes:
            return data
    raise ValueError("Images must be 5MB or smaller after optimization")


def _storage_provider():
    if settings.storage_provider == "cloudinary":
        return CloudinaryStorage()
    if settings.storage_provider == "s3":
        return S3Storage()
    return LocalStorage(settings.local_upload_dir)


storage = _storage_provider()
