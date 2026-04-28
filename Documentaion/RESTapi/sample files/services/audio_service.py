import tempfile
from faster_whisper import WhisperModel

whisper_model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)


async def transcribe_audio(audio_file):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        content = await audio_file.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name

    segments, info = whisper_model.transcribe(temp_audio_path)

    transcript = " ".join([segment.text for segment in segments])

    return transcript