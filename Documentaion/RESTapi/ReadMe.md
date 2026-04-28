# REST API Definition

Use Python FastAPI.

## Directory Structure

```plaintext
backend/
│
├── main.py
├── requirements.txt
├── .env
├── models/
│   └── emotion_cnn.keras
├── uploads/
└── services/
    ├── audio_service.py
    ├── video_service.py
    └── llm_service.py
```

## main.py Endpoints

### `POST /api/audio/transcribe`

- receives audio file
- runs Whisper
- returns transcript

### `POST /api/video/emotion`

- receives video file
- runs CNN emotion model
- returns emotion summary

### `POST /api/session/summary`

> inside this endpoint llm call should be done

- combines transcript + emotion result
- returns final report

## Additional Notes

- Inside `requirements.txt`, define all required packages.
- Use `.env` to manage LLM API keys.
- Inside `models`, keep the trained CNN model. Whisper model will install in the Python runtime.
- `uploads` directory works as temporary storage for keeping audio and video files.
- Inside `audio_service.py`, all the transcription should be done with Whisper support.
- Inside `video_service.py`, all the facial emotion identification should be done with the CNN model.
- Inside `llm_service.py`, do the LLM calling task.

## LLM Flow

LangChain can be used to manage LLM structured outputs with a JSON schema.

- transcript + emotion summary
- LangChain prompt
- LLM with structured output
- validated JSON response
- send to frontend
