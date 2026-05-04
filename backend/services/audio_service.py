"""
audio_service.py  –  Whisper transcription service

CURRENT STATE: Returns a dummy transcript so the rest of the app can run
               without needing the Whisper model installed.

HOW TO UPDATE (when ready):
  1. pip install openai-whisper
  2. Uncomment the real implementation below and delete the stub block.
  3. Make sure ffmpeg is installed on your system (required by Whisper).
"""

import tempfile
import os


# ─────────────────────────────────────────────────────────────────────────────
# STUB  (replace this whole block when Whisper is ready)
# ─────────────────────────────────────────────────────────────────────────────

def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    STUB: returns dummy transcript.
    When Whisper is ready, delete this function and uncomment the real one below.
    """
    print(f"[STUB] transcribe_audio called for {filename} ({len(audio_bytes)} bytes)")
    return (
        "Hello everyone, thank you for joining today's meeting. "
        "I wanted to discuss the project progress and upcoming milestones. "
        "I think we are making good progress, however there are some areas "
        "where we could definitely improve our communication."
    )


# ─────────────────────────────────────────────────────────────────────────────
# REAL IMPLEMENTATION  (uncomment when Whisper is installed)
# ─────────────────────────────────────────────────────────────────────────────

# import whisper
# _model = None
#
# def _get_model():
#     global _model
#     if _model is None:
#         _model = whisper.load_model("base")   # change to "small"/"medium" for better accuracy
#     return _model
#
# def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
#     ext = os.path.splitext(filename)[-1] or ".webm"
#     with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
#         tmp.write(audio_bytes)
#         tmp_path = tmp.name
#     try:
#         model = _get_model()
#         result = model.transcribe(tmp_path)
#         return result["text"].strip()
#     finally:
#         os.unlink(tmp_path)