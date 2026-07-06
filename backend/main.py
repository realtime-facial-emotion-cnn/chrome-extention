from fastapi import FastAPI, UploadFile, File
from fastapi import BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from enum import Enum
from pydantic import BaseModel
from typing import Dict
import uuid
import uvicorn

# ─── Import services (stubs for now, swap in real ones later) ─────────────────
from services.audio_service import transcribe_audio
from services.video_service import analyze_emotion
from services.llm_service import generate_summary

app = FastAPI(title="Meeting Analysis API", version="1.0.0")

# ─── CORS (allows the chrome extension and summary page to call this) ─────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ UPDATE LATER: restrict to your extension origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ───────────────────────────────────────────────────────────────────


# class SessionSummaryRequest(BaseModel):
#     transcript: str
#     emotion_summary: Dict[str, float]


class SessionSummaryResponse(BaseModel):
    grammar_score: float
    fluency_score: float
    confidence_score: float
    emotion_observation: str
    strengths: str
    improvements: str
    finalthought :str


class VideoAnalysisResponse(BaseModel):
    transcript_data: str
    emotion_data: Dict[str, float]
    llm_output: SessionSummaryResponse


class TranscriptResponse(BaseModel):
    transcript: str


class EmotionResponse(BaseModel):
    emotion_summary: Dict[str, float]


class JobStatus(str, Enum):
    QUEUED = "queued"
    STARTED = "started"
    TRANSCRIBED = "transcribed"
    EMOTIONED = "emotion_analyzed"
    SUMMARIZED = "summary_generated"
    FAILED = "failed"


class Job(BaseModel):
    id: str
    status: JobStatus
    progress: int
    message: str
    result: dict | None = None
    error: str | None = None


jobs: dict[str, dict] = {}


def create_job():
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "status": JobStatus.QUEUED,
        "progress": 0,
        "message": "Waiting...",
        "result": None,
        "error": None,
    }
    return job_id


def get_job(job_id):
    return jobs[job_id]


def update_job(job_id, **kwargs):
    jobs[job_id].update(kwargs)


def process_video(job_id, video_bytes, filename):
    try:
        update_job(
            job_id,
            status=JobStatus.STARTED,
            progress=0,
            message="Transcribing audio...",
        )

        transcript = transcribe_audio(
            video_bytes,
            filename=filename,
        )

        update_job(
            job_id,
            status=JobStatus.TRANSCRIBED,
            progress=25,
            message="Analyzing emotions...",
        )

        emotion = analyze_emotion(
            video_bytes,
            filename=filename,
        )

        update_job(
            job_id,
            status=JobStatus.EMOTIONED,
            progress=60,
            message="Generating AI summary...",
        )

        summary = generate_summary(
            transcript,
            emotion,
        )

        update_job(
            job_id,
            status=JobStatus.SUMMARIZED,
            progress=100,
            message="Completed",
            result={
                "transcript_data": transcript,
                "emotion_data": emotion,
                "llm_output": summary,
            },
        )

    except Exception as ex:
        update_job(
            job_id,
            status=JobStatus.FAILED,
            error=str(ex),
            message="Failed",
        )


class JobSubmissionResponse(BaseModel):
    job_id: str


# ─── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/")
def root():
    return {"status": "Meeting Analysis API is running", "author": "Dimuthu"}


@app.post("/api/video/analyze", response_model=VideoAnalysisResponse)
async def analyze_video(file: UploadFile = File(...)):
    """
    Accepts one video file, runs transcription and emotion analysis internally,
    then sends both outputs to the LLM summary service.
    """
    video_bytes = await file.read()

    transcript_data = transcribe_audio(video_bytes, filename=file.filename)
    emotion_data = analyze_emotion(video_bytes, filename=file.filename)
    llm_output = generate_summary(
        transcript=transcript_data,
        emotion_summary=emotion_data,
    )

    return {
        "transcript_data": transcript_data,
        "emotion_data": emotion_data,
        "llm_output": llm_output,
    }


@app.post("/api/video/transcribe", response_model=TranscriptResponse)
async def transcribe_video(file: UploadFile = File(...)):
    """
    Debug endpoint for transcript generation only.
    Accepts a video file and returns the Whisper transcript.
    """
    video_bytes = await file.read()
    transcript = transcribe_audio(video_bytes, filename=file.filename)
    return {"transcript": transcript}


@app.post("/api/video/emotion", response_model=EmotionResponse)
async def analyze_video_emotion(file: UploadFile = File(...)):
    """
    Debug endpoint for emotion analysis only.
    Accepts a video file and returns the emotion distribution.
    """
    video_bytes = await file.read()
    emotion_summary = analyze_emotion(video_bytes, filename=file.filename)
    return {"emotion_summary": emotion_summary}


@app.post("/api/video/analyze/job", response_model=JobSubmissionResponse)
async def analyze_video_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Submit a video for background processing and return a job id immediately.
    """
    video_bytes = await file.read()

    job_id = create_job()

    background_tasks.add_task(
        process_video,
        job_id,
        video_bytes,
        file.filename,
    )

    return {"job_id": job_id}


@app.get("/api/video/jobs/{job_id}", response_model=Job)
async def get_job_status(job_id: str):
    try:
        return get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
