# Backend README

This directory contains the Python backend for the meeting analysis project.

## Purpose

The backend receives recorded video input, processes it through AI services, and returns analysis results such as:

- transcript text
- emotion summary
- AI-generated communication feedback

## Main Components

- main.py: FastAPI application and API endpoints
- services/audio_service.py: audio transcription logic
- services/video_service.py: emotion analysis logic
- services/llm_service.py: AI summary generation using Groq
- models/: pretrained model assets used by the analysis pipeline

## Requirements

Install the required Python packages:

```bash
pip install -r requirements.txt
```

## Environment Setup

Create a .env file in this folder and add your API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

## Run the Backend

From this directory, start the server with:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You can then open:

- http://localhost:8000/
- http://localhost:8000/docs

## Available Endpoints

- GET / -> health check
- POST /api/video/transcribe -> transcribe uploaded video
- POST /api/video/emotion -> analyze emotions from uploaded video
- POST /api/video/analyze -> run transcription, emotion analysis, and AI summary
- POST /api/video/analyze/job -> process video in the background
- GET /api/video/jobs/{job_id} -> check job status

## Testing

You can test the API using the Swagger UI at http://localhost:8000/docs or by sending requests with tools like Postman or curl.

Example:

```bash
curl http://localhost:8000/
```

## Notes

- The backend uses FastAPI and Uvicorn.
- The summarization service depends on a valid Groq API key.
- Make sure your Python environment has the required dependencies installed before running the server.
