from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from job_manager import (
    create_job,
    get_job,
    cancel_job,
)

import json
import os
import shutil
import tempfile
import uuid


# =========================================================
# GOLDEN RECAP MM
# BACKEND API
# STEP 1 — JOB API
# =========================================================

app = FastAPI(
    title="Golden Recap MM API",
    version="1.0.0"
)


# =========================================================
# CORS
# =========================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# DIRECTORIES
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads"
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
async def health():

    return {
        "status": "online",
        "service": "Golden Recap MM",
        "message": "Backend is running"
    }
@app.get("/api/test-ai")
async def test_ai():
    from job_manager import test_ai_router

    try:
        result = test_ai_router()

        return {
            "status": "success",
            "result": result
        }

    except Exception as error:
        return {
            "status": "error",
            "error": str(error)
        }

# =========================================================
# ROOT
# =========================================================

@app.get("/")
async def root():

    return {
        "service": "Golden Recap MM",
        "status": "online"
    }


# =========================================================
# CREATE JOB
# =========================================================

@app.post("/api/jobs")
async def create_recap_job(
    video: UploadFile = File(None),
    settings: str = Form("{}"),
    source: str = Form("local"),
    source_url: str = Form("")
):

    # -----------------------------------------------------
    # Validate source
    # -----------------------------------------------------

    if source not in [
        "local",
        "tiktok",
        "rednote"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Unsupported source."
        )


    # -----------------------------------------------------
    # Parse settings
    # -----------------------------------------------------

    try:

        parsed_settings = json.loads(
            settings
        )

        if not isinstance(
            parsed_settings,
            dict
        ):

            parsed_settings = {}

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid settings JSON."
        )


    # -----------------------------------------------------
    # Local video
    # -----------------------------------------------------

    video_path = None

    if source == "local":

        if video is None:

            raise HTTPException(
                status_code=400,
                detail="Video file is required."
            )


        filename = (
            video.filename
            or "uploaded_video.mp4"
        )


        extension = os.path.splitext(
            filename
        )[1].lower()


        allowed_extensions = {
            ".mp4",
            ".mov",
            ".avi",
            ".mkv",
            ".webm"
        }


        if extension not in allowed_extensions:

            raise HTTPException(
                status_code=400,
                detail="Unsupported video format."
            )


        safe_name = (
            f"{uuid.uuid4().hex}"
            f"{extension}"
        )


        video_path = os.path.join(
            UPLOAD_DIR,
            safe_name
        )


        try:

            with open(
                video_path,
                "wb"
            ) as output_file:

                shutil.copyfileobj(
                    video.file,
                    output_file
                )

        except Exception as error:

            if os.path.exists(video_path):

                os.remove(video_path)

            raise HTTPException(
                status_code=500,
                detail=(
                    "Could not save uploaded video: "
                    f"{error}"
                )
            )


    # -----------------------------------------------------
    # URL source
    # -----------------------------------------------------

    if source in [
        "tiktok",
        "rednote"
    ]:

        if not source_url.strip():

            raise HTTPException(
                status_code=400,
                detail="Video URL is required."
            )


    # -----------------------------------------------------
    # Create Job
    # -----------------------------------------------------

    job = create_job(
        video_path=video_path,
        settings=parsed_settings,
        source=source,
        source_url=source_url.strip()
    )


    return JSONResponse(
        status_code=202,
        content=job
    )


# =========================================================
# GET JOB STATUS
# =========================================================

@app.get("/api/jobs/{job_id}")
async def get_recap_job(
    job_id: str
):

    job = get_job(
        job_id
    )


    if job is None:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )


    return job


# =========================================================
# CANCEL JOB
# =========================================================

@app.post("/api/jobs/{job_id}/cancel")
async def cancel_recap_job(
    job_id: str
):

    job = cancel_job(
        job_id
    )


    if job is None:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )


    return job


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(
            os.environ.get(
                "PORT",
                8000
            )
        ),
        reload=False
    )
