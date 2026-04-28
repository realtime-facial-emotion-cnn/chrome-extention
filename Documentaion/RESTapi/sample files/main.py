from fastapi import FastAPI, UploadFile, File
from services.audio_service import transcribe_audio
from services.video_service import analyze_video_emotions

app = FastAPI(title="Interview Insight API")


@app.get("/")
def health_check():
    return {"status": "running"}


@app.post("/api/audio/transcribe")
async def audio_transcribe(audio: UploadFile = File(...)):
    transcript = await transcribe_audio(audio)

    return {
        "transcript": transcript
    }


@app.post("/api/video/emotion")
async def video_emotion(video: UploadFile = File(...)):
    emotion_summary = await analyze_video_emotions(video)

    return {
        "emotion_summary": emotion_summary
    }


@app.post("/api/session/summary")
async def session_summary(data: dict):
    return {
        "summary": "Final combined summary will be generated here",
        "audio": data.get("audio"),
        "video": data.get("video")
    }