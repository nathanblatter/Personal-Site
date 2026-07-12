"""Native MLX Whisper transcription server (runs on the Mac mini HOST, not Docker).

The journal worker runs in Docker, whose Linux VM cannot reach the Mac's GPU/ANE,
so faster-whisper there is stuck on CPU (~1x realtime). This standalone service runs
NATIVELY in a host venv (~/journal-mlx/venv) and uses mlx-whisper on the M4 GPU
(~12-16x realtime, and at least as accurate — it got "Lake Tulloch"/"Sand Harbor"
right where the CPU baseline erred). The Dockerized worker POSTs audio here via
host.docker.internal and falls back to its own CPU whisper if this service is down.

Run:  ~/journal-mlx/venv/bin/python -m app.journal_mlx_server
      (kept alive by the com.nathanblatter.journal-mlx launchd service)

Deliberately dependency-free beyond mlx-whisper + fastapi: it imports nothing from
the `app` package (no torch/asyncpg/etc.), so the host venv stays tiny. Vocab bias is
the worker's concern — it passes the `prompt` per request; this stays a dumb transcriber.

Validated decode config (see flightdeck journal benchmark 2026-07-11):
  condition_on_previous_text=False  -- REQUIRED. Keeps the initial_prompt vocab bias
  but eliminates a catastrophic repetition-loop hallucination (hit 1 of 7 real
  entries out of the box) and runs ~2.5x faster (no growing decode context).
"""

import logging
import os
import tempfile

import mlx_whisper
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("journal_mlx")

# Best-quality Apple-Silicon Whisper. large-v3 (NOT turbo/distil) for max accuracy;
# the box is idle for one nightly entry so we spend the quality budget.
MODEL_REPO = os.getenv("MLX_WHISPER_MODEL", "mlx-community/whisper-large-v3-mlx")

app = FastAPI(title="journal-mlx-whisper")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": MODEL_REPO}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    prompt: str | None = Form(default=None),
) -> JSONResponse:
    """Transcribe one audio file on the GPU. `prompt` biases recurring proper nouns
    (the worker passes journal_vocab.whisper_prompt()). Returns {"text": ...}."""
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    data = await file.read()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
        f.write(data)
        f.flush()
        result = mlx_whisper.transcribe(
            f.name,
            path_or_hf_repo=MODEL_REPO,
            condition_on_previous_text=False,  # REQUIRED — see module docstring
            initial_prompt=prompt or None,
        )
    text = (result.get("text") or "").strip()
    log.info("transcribed %s (%d bytes -> %d chars)", file.filename, len(data), len(text))
    return JSONResponse({"text": text})


def main() -> None:
    import uvicorn

    host = os.getenv("MLX_HOST", "0.0.0.0")  # 0.0.0.0 so host.docker.internal reaches it
    port = int(os.getenv("MLX_PORT", "4310"))
    log.info("starting journal-mlx-whisper on %s:%d (model %s)", host, port, MODEL_REPO)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
