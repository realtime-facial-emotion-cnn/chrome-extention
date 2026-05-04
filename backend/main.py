from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import uvicorn

# ─── Import services (stubs for now, swap in real ones later) ─────────────────
from services.audio_service import transcribe_audio
from services.video_service import analyze_emotion
from services.llm_service import generate_summary

app = FastAPI(title="Meeting Analysis API", version="1.0.0")

# ─── CORS (allows the chrome extension and summary page to call this) ─────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # ⚠️ UPDATE LATER: restrict to your extension origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ───────────────────────────────────────────────────────────────────

class SessionSummaryRequest(BaseModel):
    transcript: str
    emotion_summary: Dict[str, float]


class SessionSummaryResponse(BaseModel):
    grammar_score: float
    fluency_score: float
    confidence_score: float
    emotion_observation: str
    strengths: str
    improvements: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Meeting Analysis API is running", "author": "Dimuthu"}


@app.post("/api/audio/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Accepts an audio file (webm/wav/mp3) and returns a transcript.
    Currently returns stub data.
    UPDATE LATER: audio_service.py → wire real Whisper call here.
    """
    audio_bytes = await file.read()
    transcript = transcribe_audio(audio_bytes, filename=file.filename)
    return {"transcript": transcript}


@app.post("/api/video/emotion")
async def emotion(file: UploadFile = File(...)):
    """
    Accepts a video file (webm/mp4) and returns emotion distribution.
    Currently returns stub data.
    UPDATE LATER: video_service.py → load emotion_cnn.keras and run inference.
    """
    video_bytes = await file.read()
    emotion_summary = analyze_emotion(video_bytes, filename=file.filename)
    return {"emotion_summary": emotion_summary}


@app.post("/api/session/summary", response_model=SessionSummaryResponse)
async def session_summary(payload: SessionSummaryRequest):
    """
    Accepts transcript + emotion_summary, returns full meeting analysis.
    Currently returns stub/heuristic data.
    UPDATE LATER: llm_service.py → real Groq/LLM call with structured JSON output.
    """
    result = generate_summary(
        transcript=payload.transcript,
        emotion_summary=payload.emotion_summary
    )
    return result


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)