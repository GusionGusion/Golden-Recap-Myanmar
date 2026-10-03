import threading
import uuid
from datetime import datetime
from ai import router_text
# =========================================================
# GOLDEN RECAP MM - WHISPER
# =========================================================

import os
import subprocess
import tempfile

from faster_whisper import WhisperModel
# =========================================================
# AI ROUTER CONNECTION TEST
# =========================================================

def test_ai_router():
    prompt = """
Reply with exactly one short sentence:

Golden Recap MM AI Router connection test successful.
"""

    return router_text(
        task="caption",
        prompt=prompt,
    )

# =========================================================
# GOLDEN RECAP MM
# JOB MANAGER
# =========================================================

JOBS = {}

JOBS_LOCK = threading.Lock()

# =========================================================
# TRANSCRIBE VIDEO
# =========================================================

def transcribe_video(video_path):
    """
    Extract mono 16 kHz WAV from video
    and transcribe using Faster-Whisper.
    """

    if not video_path:
        raise ValueError("Video path is required.")

    if not os.path.exists(video_path):
        raise FileNotFoundError(
            f"Video file not found: {video_path}"
        )

    wav_path = None

    try:

        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False
        ) as temp_audio:

            wav_path = temp_audio.name

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                video_path,
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-acodec",
                "pcm_s16le",
                wav_path,
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        model = WhisperModel(
            "tiny",
            device="cpu",
            compute_type="int8",
            cpu_threads=4,
            num_workers=1,
        )

        segments, info = model.transcribe(
            wav_path,
            language="en",
            task="transcribe",
            beam_size=1,
            best_of=1,
            temperature=0,
            condition_on_previous_text=False,
            vad_filter=True,
        )

        transcript_segments = []

        for segment in segments:

            transcript_segments.append(
                {
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": segment.text.strip(),
                }
            )

        full_text = " ".join(
            item["text"]
            for item in transcript_segments
            if item["text"]
        ).strip()

        return {
            "text": full_text,
            "segments": transcript_segments,
            "language": info.language,
        }

    finally:

        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

# =========================================================
# CREATE JOB
# =========================================================

def create_job(
    video_path=None,
    settings=None,
    source="upload",
    source_url=""
):
    job_id = uuid.uuid4().hex

    now = datetime.utcnow().isoformat()

    job = {
        "job_id": job_id,
        "status": "queued",
        "progress": 5,
        "stage": "Uploading Video",
        "message": "Job created successfully.",
        "source": source,
        "source_url": source_url,
        "video_path": video_path,
        "settings": settings or {},
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
        "cancel_requested": False,
    }

    with JOBS_LOCK:
        JOBS[job_id] = job

    worker = threading.Thread(
        target=temporary_worker,
        args=(job_id,),
        daemon=True,
    )

    worker.start()

    return public_job(job)


# =========================================================
# GET JOB
# =========================================================

def get_job(job_id):

    with JOBS_LOCK:
        job = JOBS.get(job_id)

        if job is None:
            return None

        return public_job(job)


# =========================================================
# CANCEL JOB
# =========================================================

def cancel_job(job_id):

    with JOBS_LOCK:
        job = JOBS.get(job_id)

        if job is None:
            return None

        if job["status"] in [
            "completed",
            "failed",
            "cancelled",
        ]:
            return public_job(job)

        job["cancel_requested"] = True
        job["status"] = "cancelling"
        job["message"] = "Cancellation requested."
        job["updated_at"] = datetime.utcnow().isoformat()

        return public_job(job)


# =========================================================
# UPDATE JOB
# =========================================================

def update_job(
    job_id,
    progress=None,
    stage=None,
    status=None,
    message=None,
    result=None,
    error=None,
):

    with JOBS_LOCK:

        job = JOBS.get(job_id)

        if job is None:
            return None

        if progress is not None:
            job["progress"] = int(progress)

        if stage is not None:
            job["stage"] = stage

        if status is not None:
            job["status"] = status

        if message is not None:
            job["message"] = message

        if result is not None:
            job["result"] = result

        if error is not None:
            job["error"] = error

        job["updated_at"] = datetime.utcnow().isoformat()

        return public_job(job)


# =========================================================
# CANCEL CHECK
# =========================================================

def is_cancel_requested(job_id):

    with JOBS_LOCK:

        job = JOBS.get(job_id)

        if job is None:
            return True

        return bool(
            job.get(
                "cancel_requested",
                False,
            )
        )


# =========================================================
# TEMPORARY WORKER
# =========================================================

def temporary_worker(job_id):

    """
    Temporary worker for API testing.

    This will later be replaced by
    the real Golden Recap MM pipeline.
    """

    import time

    stages = [
        (5, "Uploading Video"),
        (15, "Transcribing"),
        (30, "Scene Analysing"),
        (45, "Generating Recap"),
        (60, "Myanmar Translation"),
        (75, "Generating Voiceover"),
        (85, "Creating Subtitles"),
        (92, "Freeze + Zoom"),
    ]

    try:

        update_job(
            job_id,
            status="processing",
            progress=5,
            stage="Uploading Video",
            message="Video upload completed.",
        )

        for progress, stage in stages[1:]:

            time.sleep(0.8)

            if is_cancel_requested(job_id):

                update_job(
                    job_id,
                    status="cancelled",
                    message="Job cancelled.",
                )

                return

            update_job(
                job_id,
                status="processing",
                progress=progress,
                stage=stage,
                message=stage,
            )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        update_job(
            job_id,
            status="completed",
            progress=100,
            stage="Final Video Ready",
            message="Processing completed.",
            result={
                "video_url": None,
                "download_url": None,
            },
        )

    except Exception as error:

        update_job(
            job_id,
            status="failed",
            message="Processing failed.",
            error=str(error),
        )


# =========================================================
# PUBLIC RESPONSE
# =========================================================

def public_job(job):

    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "progress": job["progress"],
        "stage": job["stage"],
        "message": job["message"],
        "source": job["source"],
        "result": job["result"],
        "error": job["error"],
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
    }
