"""Journal transcription + weave worker.

Runs as its own process/container (`python -m app.journal_worker`) so faster-whisper
/ torch / ffmpeg stay out of the API image. Consumes the `journal:submitted` Redis
stream (a message is XADD'd by the /journal/{token}/submit route once a day is locked).

Per submitted entry:
  1. Transcribe each recording with faster-whisper (initial_prompt biases recurring
     proper nouns) → one immutable transcripts.raw_text per recording, permanent.
  2. Weave all of that day's raw_text (sequence order) into entries.narrative +
     drift_flags + drift_score via app.weave_service.
  3. final_text defaults to narrative; status → 'processed'.

Whisper only runs after submit, never on individual uploads, so the day is locked first.
"""

import asyncio
import json
import logging
import os
import tempfile
import uuid

import asyncpg
import redis.asyncio as aioredis

from app import weave_service
from app.routers.journal import journal_dsn, SUBMIT_STREAM
from app.routers.storage import get_s3_client, MINIO_BUCKET

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("journal_worker")

GROUP = "journal-workers"
CONSUMER = os.getenv("WORKER_NAME", "worker-1")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small.en")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
# Bias recurring proper nouns to cut misrecognition (PRD custom-vocabulary note).
WHISPER_PROMPT = os.getenv(
    "WHISPER_PROMPT",
    "Gengar, Alakazam, Marriott, Gaskin, Tahoe, BYU, FinForge, flightdeck.",
)

_model = None


def _get_model():
    """Lazy-load the faster-whisper model once per process."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel  # imported lazily; heavy dep
        log.info("loading whisper model %s (%s/%s)", WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE)
        _model = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE)
    return _model


def _transcribe(audio_bytes: bytes, suffix: str) -> str:
    model = _get_model()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
        f.write(audio_bytes)
        f.flush()
        segments, _info = model.transcribe(f.name, initial_prompt=WHISPER_PROMPT)
        return " ".join(seg.text.strip() for seg in segments).strip()


async def _process_entry(pool: asyncpg.Pool, entry_id_str: str) -> None:
    entry_id = uuid.UUID(entry_id_str)
    async with pool.acquire() as conn:
        recs = await conn.fetch(
            "SELECT id, audio_ref, sequence FROM recordings WHERE entry_id = $1 ORDER BY sequence",
            entry_id,
        )
    if not recs:
        log.warning("entry %s has no recordings", entry_id)
        return

    s3 = get_s3_client()
    raw_texts: list[str] = []
    for rec in recs:
        # Transcribe only if not already done (idempotent on retry).
        async with pool.acquire() as conn:
            existing = await conn.fetchval(
                "SELECT raw_text FROM transcripts WHERE recording_id = $1", rec["id"]
            )
        if existing is not None:
            raw_texts.append(existing)
            continue

        obj = s3.get_object(Bucket=MINIO_BUCKET, Key=rec["audio_ref"])
        audio = obj["Body"].read()
        suffix = os.path.splitext(rec["audio_ref"])[1] or ".webm"
        text = await asyncio.to_thread(_transcribe, audio, suffix)

        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO transcripts (recording_id, raw_text) VALUES ($1, $2) "
                "ON CONFLICT (recording_id) DO NOTHING",
                rec["id"], text,
            )
        raw_texts.append(text)
        log.info("transcribed recording %s (%d chars)", rec["id"], len(text))

    woven = await weave_service.weave_day(raw_texts)
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE entries SET narrative = $2, "
            "final_text = COALESCE(final_text, $2), "
            "drift_flags = $3::jsonb, drift_score = $4, status = 'processed' "
            "WHERE id = $1",
            entry_id,
            woven["narrative"],
            json.dumps(woven["drift_flags"]),
            woven["drift_score"],
        )
    log.info("entry %s processed (drift_score=%s)", entry_id, woven["drift_score"])


async def _connect_pool() -> asyncpg.Pool:
    """Wait for the `journal` DB, which the API creates on its own boot. Retrying
    here (instead of crashing) avoids a restart crash-loop when the worker wins the
    startup race against the API."""
    last_exc = None
    for attempt in range(30):
        try:
            return await asyncpg.create_pool(journal_dsn())
        except (asyncpg.exceptions.InvalidCatalogNameError, OSError, ConnectionError) as exc:
            last_exc = exc
            log.info("journal DB not ready yet (attempt %d): %s", attempt + 1, exc)
            await asyncio.sleep(2)
    raise RuntimeError(f"journal DB never became available: {last_exc}")


async def _handle(pool: asyncpg.Pool, r: aioredis.Redis, msg_id, fields) -> None:
    entry_id = fields.get(b"entry_id", b"").decode()
    try:
        await _process_entry(pool, entry_id)
        await r.xack(SUBMIT_STREAM, GROUP, msg_id)
    except Exception:
        # Leave unacked (stays pending) so it can be retried on a later boot.
        log.exception("failed to process entry %s", entry_id)


async def _drain_pending(pool: asyncpg.Pool, r: aioredis.Redis) -> None:
    """Reprocess this consumer's unacked messages (e.g. entries submitted while a
    prior boot was broken). Reading id '0' returns our pending list; stop once it's
    empty or a pass makes no progress, so a persistently-failing message can't hot-loop."""
    while True:
        resp = await r.xreadgroup(GROUP, CONSUMER, {SUBMIT_STREAM: "0"}, count=10)
        msgs = resp[0][1] if resp else []
        if not msgs:
            return
        pending_before = (await r.xpending(SUBMIT_STREAM, GROUP))["pending"]
        for msg_id, fields in msgs:
            await _handle(pool, r, msg_id, fields)
        pending_after = (await r.xpending(SUBMIT_STREAM, GROUP))["pending"]
        if pending_after >= pending_before:
            log.warning("pending drain made no progress; leaving %d for next boot", pending_after)
            return


async def main() -> None:
    # Whisper needs ffmpeg-decodable input; the model loads on first transcribe.
    pool = await _connect_pool()
    r = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

    # Create the consumer group (idempotent), starting from new messages.
    try:
        await r.xgroup_create(SUBMIT_STREAM, GROUP, id="0", mkstream=True)
    except aioredis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise

    log.info("journal worker ready, consuming %s as %s/%s", SUBMIT_STREAM, GROUP, CONSUMER)
    await _drain_pending(pool, r)  # recover entries submitted while a prior boot was broken
    while True:
        try:
            resp = await r.xreadgroup(GROUP, CONSUMER, {SUBMIT_STREAM: ">"}, count=1, block=15000)
            if not resp:
                continue
            for _stream, messages in resp:
                for msg_id, fields in messages:
                    await _handle(pool, r, msg_id, fields)
        except Exception:
            log.exception("worker loop error; backing off")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
