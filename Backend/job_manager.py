import threading
import uuid
from datetime import datetime
import os
import subprocess
import tempfile

from ai import router_text
from supabase import create_client

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
SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    ""
)

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    ""
)

SUPABASE_CLIENT = None

if (
    SUPABASE_URL
    and SUPABASE_SERVICE_ROLE_KEY
):
    SUPABASE_CLIENT = create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    )

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

    job_data = {
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
        "cancel_requested": False,
    }

    if SUPABASE_CLIENT is None:
        raise RuntimeError(
            "Supabase is not configured."
        )

    response = (
        SUPABASE_CLIENT
        .table("jobs")
        .insert(job_data)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            "Could not create job in Supabase."
        )

    worker = threading.Thread(
        target=temporary_worker,
        args=(job_id,),
        daemon=True,
    )

    worker.start()

    return public_job(job_data)


# =========================================================
# GET JOB
# =========================================================

def get_job(job_id):

    if SUPABASE_CLIENT is None:
        raise RuntimeError(
            "Supabase is not configured."
        )

    response = (
        SUPABASE_CLIENT
        .table("jobs")
        .select("*")
        .eq("job_id", job_id)
        .execute()
    )

    if not response.data:
        return None

    job = response.data[0]

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
    if SUPABASE_CLIENT is None:
        raise RuntimeError(
            "Supabase is not configured."
        )

    updates = {
        "updated_at": datetime.utcnow().isoformat()
    }

    if progress is not None:
        updates["progress"] = int(progress)

    if stage is not None:
        updates["stage"] = stage

    if status is not None:
        updates["status"] = status

    if message is not None:
        updates["message"] = message

    if result is not None:
        updates["result"] = result

    if error is not None:
        updates["error"] = error

    response = (
        SUPABASE_CLIENT
        .table("jobs")
        .update(updates)
        .eq("job_id", job_id)
        .execute()
    )

    if not response.data:
        return None

    return public_job(response.data[0])


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
# STEP 9 - REAL TRANSCRIPTION
# =========================================================

def temporary_worker(job_id):

    """
    Worker with real Faster-Whisper transcription.

    Later stages are still temporary simulation.
    """

    import time

    try:

        # -------------------------------------------------
        # GET JOB
        # -------------------------------------------------

        with JOBS_LOCK:

            job = JOBS.get(job_id)

            if job is None:
                return

            video_path = job.get("video_path")

        # -------------------------------------------------
        # 5% - UPLOADING VIDEO
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=5,
            stage="Uploading Video",
            message="Video upload completed.",
        )

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 15% - TRANSCRIBING
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=15,
            stage="Transcribing",
            message="Transcribing video...",
        )

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        transcript = transcribe_video(
            video_path
        )

        # -------------------------------------------------
        # STORE TRANSCRIPT INTERNALLY
        # -------------------------------------------------

        with JOBS_LOCK:

            job = JOBS.get(job_id)

            if job is not None:
                job["transcript"] = transcript

        # -------------------------------------------------
        # 30% - SCENE ANALYSING
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=30,
            stage="Scene Analysing",
            message="Transcription completed.",
        )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 45% - GENERATING RECAP
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=45,
            stage="Generating Recap",
            message="Scene analysis started.",
        )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 60% - MYANMAR TRANSLATION
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=60,
            stage="Myanmar Translation",
            message="Generating recap.",
        )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 75% - GENERATING VOICEOVER
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=75,
            stage="Generating Voiceover",
            message="Translating recap to Myanmar.",
        )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 85% - CREATING SUBTITLES
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=85,
            stage="Creating Subtitles",
            message="Generating voiceover.",
        )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 92% - FREEZE + ZOOM
        # -------------------------------------------------

        update_job(
            job_id,
            status="processing",
            progress=92,
            stage="Freeze + Zoom",
            message="Creating subtitles.",
        )

        time.sleep(0.8)

        if is_cancel_requested(job_id):

            update_job(
                job_id,
                status="cancelled",
                message="Job cancelled.",
            )

            return

        # -------------------------------------------------
        # 100% - FINAL VIDEO READY
        # -------------------------------------------------

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
