"""
audio_service.py  -  Whisper transcription service

Accepts uploaded video files and passes them to Whisper, which extracts the
audio track internally before transcription.
"""

import importlib
import os
import tempfile

_whisper = None
_model = None


def _get_whisper_module():
    global _whisper
    if _whisper is None:
        try:
            _whisper = importlib.import_module("whisper")
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "openai-whisper is required for transcription. Install backend/requirements.txt first."
            ) from exc
    return _whisper


def _get_model():
    global _model
    if _model is None:
        whisper_module = _get_whisper_module()
        _model = whisper_module.load_model(
            "base"
        )  # change to "small"/"medium" for better accuracy
    return _model


def transcribe_audio(video_bytes: bytes, filename: str = "video.mp4") -> str:
    ext = os.path.splitext(filename)[-1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name
    try:
        model = _get_model()
        result = model.transcribe(tmp_path)
        return result["text"].strip()
    finally:
        os.unlink(tmp_path)
