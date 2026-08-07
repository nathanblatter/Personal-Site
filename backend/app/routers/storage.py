import io
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
import boto3
from botocore.exceptions import ClientError

from app.auth import require_auth

router = APIRouter(prefix="/storage", tags=["storage"])

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY") or os.getenv("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY") or os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "portfolio")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "20971520"))  # 20MB default
CHUNK_SIZE = 1024 * 1024  # 1MB chunks


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{MINIO_ENDPOINT}",
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        region_name="us-east-1",
    )


def ensure_bucket(client):
    try:
        client.head_bucket(Bucket=MINIO_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=MINIO_BUCKET)


# Formats whose metadata (EXIF/GPS) we scrub before storing personal photos.
_EXIF_STRIP_FORMATS = {"JPEG", "PNG", "WEBP", "TIFF"}


def strip_image_metadata(data: bytes) -> bytes:
    """Re-encode a JPEG/PNG/WebP/TIFF image without EXIF (or other) metadata.

    Keeps the original format (JPEG re-saved at quality=90, ICC profile
    preserved). Non-image or unparseable input is returned unchanged.
    """
    try:
        from PIL import Image, ImageOps

        img = Image.open(io.BytesIO(data))
        fmt = (img.format or "").upper()
        if fmt not in _EXIF_STRIP_FORMATS:
            return data
        img.load()
        # Bake the EXIF orientation into the pixels BEFORE dropping metadata —
        # otherwise phone photos render sideways once the tag is gone.
        img = ImageOps.exif_transpose(img)
        # copy() carries pixels but we drop the metadata dict (EXIF, XMP, …),
        # keeping only the ICC profile so colors stay correct.
        clean = img.copy()
        icc = img.info.get("icc_profile")
        clean.info = {}
        save_kwargs = {}
        if icc:
            save_kwargs["icc_profile"] = icc
        if fmt == "JPEG":
            save_kwargs["quality"] = 90
        out = io.BytesIO()
        clean.save(out, format=fmt, **save_kwargs)
        return out.getvalue()
    except Exception:
        # Never fail an upload over metadata stripping — store as-is.
        return data


@router.post("/upload", dependencies=[Depends(require_auth)])
async def upload_file(
    file: UploadFile = File(...),
    prefix: str = Query("uploads", description="Key prefix / folder"),
):
    client = get_s3_client()
    ensure_bucket(client)

    ext = os.path.splitext(file.filename or "")[1]
    key = f"{prefix}/{uuid.uuid4().hex}{ext}"

    # Read file in chunks and collect into buffer
    contents = bytearray()
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        contents.extend(chunk)
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum size of {MAX_UPLOAD_BYTES} bytes",
            )

    contents = bytes(contents)

    # Personal photos: scrub EXIF/GPS metadata before the image ever hits storage.
    if prefix.startswith("personal"):
        contents = strip_image_metadata(contents)

    client.put_object(
        Bucket=MINIO_BUCKET,
        Key=key,
        Body=contents,
        ContentType=file.content_type or "application/octet-stream",
    )

    return {"key": key, "bucket": MINIO_BUCKET, "size": len(contents)}


@router.get("/files", dependencies=[Depends(require_auth)])
def list_files(prefix: str = Query("", description="Key prefix to list")):
    client = get_s3_client()
    ensure_bucket(client)

    response = client.list_objects_v2(Bucket=MINIO_BUCKET, Prefix=prefix)
    files = [
        {
            "key": obj["Key"],
            "size": obj["Size"],
            "last_modified": obj["LastModified"].isoformat(),
        }
        for obj in response.get("Contents", [])
    ]
    return {"files": files}


@router.delete("/files/{key:path}", dependencies=[Depends(require_auth)])
def delete_file(key: str):
    client = get_s3_client()
    try:
        client.head_object(Bucket=MINIO_BUCKET, Key=key)
    except ClientError:
        raise HTTPException(status_code=404, detail="File not found")

    client.delete_object(Bucket=MINIO_BUCKET, Key=key)
    return {"deleted": key}


@router.get("/download/{key:path}")
def download_file(key: str):
    """Proxy a file download from MinIO."""
    client = get_s3_client()
    try:
        obj = client.get_object(Bucket=MINIO_BUCKET, Key=key)
    except ClientError:
        raise HTTPException(status_code=404, detail="File not found")

    return StreamingResponse(
        obj["Body"],
        media_type=obj.get("ContentType", "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{key.split("/")[-1]}"'},
    )
