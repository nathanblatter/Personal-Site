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
import httpx
import redis.asyncio as aioredis

from app import journal_vocab, prompt_service, vocab_service, weave_service
from app.routers.journal import journal_dsn, SUBMIT_STREAM
from app.routers.storage import get_s3_client, MINIO_BUCKET

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("journal_worker")

GROUP = "journal-workers"
CONSUMER = os.getenv("WORKER_NAME", "worker-1")

# Preferred path: delegate transcription to the native MLX Whisper service on the
# mini HOST (app.journal_mlx_server), which uses the M4 GPU (~12-16x realtime, and
# at least as accurate as CPU large-v3). Docker can't reach the Mac GPU, so this
# container itself is CPU-only; host.docker.internal lets it call the host service.
# Empty/unset MLX_TRANSCRIBE_URL disables delegation and uses local CPU whisper.
MLX_TRANSCRIBE_URL = os.getenv("MLX_TRANSCRIBE_URL", "http://host.docker.internal:4310/transcribe")

# Fallback path: local faster-whisper on CPU. Used only when the MLX host service is
# unreachable (e.g. it's down), so a nightly entry is never stuck. large-v3 is
# markedly better on proper nouns than small.en; the box is idle so the extra CPU
# time per (once-daily) entry is fine. Override via env if needed.
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
# Recurring proper nouns fed as `hotwords` (a stronger bias than initial_prompt) on
# the CPU path, and as `initial_prompt` to the MLX service (which has no hotwords).
# The env override wins outright; otherwise the vocab is read from the DB per entry
# (names accepted in the /journal/vocab grading UI apply the same night), with the
# static journal_vocab file as the offline fallback.
WHISPER_PROMPT_OVERRIDE = os.getenv("WHISPER_PROMPT")

_model = None


async def _entry_vocab(pool: asyncpg.Pool) -> tuple[str, str]:
    """(whisper prompt, weave glossary) from the DB-backed vocab, static fallback."""
    try:
        async with pool.acquire() as conn:
            vocab = await vocab_service.fetch_vocab(conn)
    except Exception as exc:
        log.warning("vocab fetch failed, using static file: %s", exc)
        vocab = dict(journal_vocab.CANONICAL)
    prompt = WHISPER_PROMPT_OVERRIDE or journal_vocab.whisper_prompt_from(vocab)
    return prompt, journal_vocab.weave_glossary_from(vocab)


def _transcribe_mlx(audio_bytes: bytes, suffix: str, prompt: str) -> str:
    """Transcribe via the native MLX GPU service on the host. Raises on any failure
    so the caller can fall back to local CPU whisper."""
    files = {"file": (f"audio{suffix}", audio_bytes)}
    data = {"prompt": prompt}
    # A cold model load + long entry can take a while on first call; generous timeout.
    resp = httpx.post(MLX_TRANSCRIBE_URL, files=files, data=data, timeout=600.0)
    resp.raise_for_status()
    return (resp.json().get("text") or "").strip()


def _get_model():
    """Lazy-load the faster-whisper model once per process."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel  # imported lazily; heavy dep
        log.info("loading whisper model %s (%s/%s)", WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE)
        _model = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE)
    return _model


def _transcribe_cpu(audio_bytes: bytes, suffix: str, prompt: str) -> str:
    model = _get_model()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
        f.write(audio_bytes)
        f.flush()
        # hotwords only take effect when initial_prompt is None (faster-whisper).
        segments, _info = model.transcribe(f.name, hotwords=prompt)
        return " ".join(seg.text.strip() for seg in segments).strip()


def _transcribe(audio_bytes: bytes, suffix: str, prompt: str) -> str:
    """Prefer the native MLX GPU service on the host; fall back to local CPU whisper
    if it's unreachable, so a nightly entry is never blocked by the host service
    being down. Both paths use the same vocab bias."""
    if MLX_TRANSCRIBE_URL:
        try:
            return _transcribe_mlx(audio_bytes, suffix, prompt)
        except Exception as exc:
            log.warning("MLX transcribe failed (%s); falling back to local CPU whisper", exc)
    return _transcribe_cpu(audio_bytes, suffix, prompt)


def _decoded_duration_sec(audio_bytes: bytes, suffix: str) -> float | None:
    """Real decoded duration via PyAV (ships with faster-whisper; the worker
    image has no ffprobe binary). Container metadata first; if the header is
    missing/lying (truncated uploads), decode and take the last frame's time.
    None if the file is unreadable."""
    import io

    try:
        import av
        with av.open(io.BytesIO(audio_bytes)) as container:
            if container.duration:
                return container.duration / 1_000_000  # AV_TIME_BASE µs
            last_end = 0.0
            for frame in container.decode(audio=0):
                if frame.time is not None:
                    last_end = frame.time + (frame.samples / frame.sample_rate)
            return last_end or None
    except Exception as exc:
        log.warning("PyAV duration check failed: %s", exc)
        return None


TRUNCATION_MIN_CLAIMED_SEC = 30
TRUNCATION_RATIO = 0.6


async def _process_entry(pool: asyncpg.Pool, entry_id_str: str) -> None:
    entry_id = uuid.UUID(entry_id_str)
    async with pool.acquire() as conn:
        recs = await conn.fetch(
            "SELECT id, audio_ref, sequence, duration_sec FROM recordings "
            "WHERE entry_id = $1 ORDER BY sequence",
            entry_id,
        )
    if not recs:
        log.warning("entry %s has no recordings", entry_id)
        return

    s3 = get_s3_client()
    whisper_prompt, weave_glossary = await _entry_vocab(pool)
    raw_texts: list[str] = []
    truncation_flags: list[dict] = []
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

        # Truncation guard (journal-12): a take whose decoded audio is far
        # shorter than the client-claimed duration means capture died mid-take.
        claimed = rec["duration_sec"] or 0
        if claimed >= TRUNCATION_MIN_CLAIMED_SEC:
            decoded = await asyncio.to_thread(_decoded_duration_sec, audio, suffix)
            if decoded is not None and decoded < claimed * TRUNCATION_RATIO:
                log.error(
                    "recording %s looks TRUNCATED: claimed %ds, decoded %.1fs",
                    rec["id"], claimed, decoded,
                )
                truncation_flags.append({
                    "category": "audio",
                    "note": (
                        f"Take {rec['sequence']} audio is truncated: the recorder reported "
                        f"{claimed}s but only {decoded:.0f}s of audio exists — the rest was "
                        "never captured (mic interruption). Consider re-telling this part."
                    ),
                    "raw_span": "",
                })

        text = await asyncio.to_thread(_transcribe, audio, suffix, whisper_prompt)

        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO transcripts (recording_id, raw_text) VALUES ($1, $2) "
                "ON CONFLICT (recording_id) DO NOTHING",
                rec["id"], text,
            )
        raw_texts.append(text)
        log.info("transcribed recording %s (%d chars)", rec["id"], len(text))

    woven = await weave_service.weave_day(raw_texts, glossary=weave_glossary)
    if truncation_flags:
        woven["drift_flags"] = truncation_flags + (woven.get("drift_flags") or [])
        woven["drift_score"] = max(float(woven.get("drift_score") or 0), 0.9)
    async with pool.acquire() as conn:
        entry_date = await conn.fetchval(
            "UPDATE entries SET narrative = $2, "
            "final_text = COALESCE(final_text, $2), "
            "drift_flags = $3::jsonb, drift_score = $4, status = 'processed' "
            "WHERE id = $1 RETURNING entry_date",
            entry_id,
            woven["narrative"],
            json.dumps(woven["drift_flags"]),
            woven["drift_score"],
        )
    log.info("entry %s processed (drift_score=%s)", entry_id, woven["drift_score"])

    # Extract next-day content prompts from the narrative (best-effort; never blocks).
    try:
        prompts = await prompt_service.extract_forward_prompts(woven["narrative"], entry_date)
        if prompts:
            async with pool.acquire() as conn:
                await conn.executemany(
                    "INSERT INTO prompt_suggestions (entry_id, target_date, prompt_text, confidence, source) "
                    "VALUES ($1, $2, $3, $4, 'content')",
                    [(entry_id, p["target_date"], p["prompt_text"], p["confidence"]) for p in prompts],
                )
            log.info("entry %s produced %d content prompt(s)", entry_id, len(prompts))
    except Exception:
        log.exception("prompt extraction failed for entry %s", entry_id)


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
