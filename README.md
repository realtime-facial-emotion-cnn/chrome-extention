<img width="830" height="495" alt="project overview" src="https://github.com/user-attachments/assets/adf221c7-35d8-421c-9335-e9269ea6a007" />

# AI-Powered Meeting Analysis Project

This project is a full-stack application that combines a Chrome extension, a Python backend, and a React-based frontend to analyze meeting or presentation sessions. The workflow begins with recording a browser tab or screen through the extension, sending the recording to the backend for transcription and emotion analysis, and then generating an AI-driven summary with communication feedback.

## Project Overview

The system is designed to help users review their speaking performance by providing:

- audio transcription from recorded video
- emotion and tone analysis
- AI-generated feedback on grammar, fluency, confidence, strengths, and improvement areas
- a simple web interface to view the results

## Main Components

- Chrome extension: records the active tab and sends the recording to the backend
- Backend API: built with FastAPI and Python services for transcription, emotion analysis, and LLM-based summarization
- Frontend UI: a React + Vite application that displays the generated performance summary

## Prerequisites

Before running the project locally, make sure you have:

- Python 3.10+ installed
- Node.js 18+ installed
- Google Chrome installed
- A Groq API key for the AI summarization service

## Backend Setup

1. Open a terminal in the backend folder
2. Create and activate a virtual environment
3. Install dependencies
4. Add your API key to a .env file

Example:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create a .env file inside the backend folder with:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Start the backend server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- http://localhost:8000/
- http://localhost:8000/docs

## Frontend Setup

1. Open a terminal in the frontend UI folder
2. Install dependencies
3. Start the Vite development server

```bash
cd frontend/perfomance-summary-ui
npm install
npm run dev
```

The UI should open at the local Vite address shown in the terminal.

## Chrome Extension Setup

1. Open Chrome and go to chrome://extensions
2. Enable Developer mode
3. Click Load unpacked and select the tab-recorder-extension folder
4. If needed, update the target destination in the extension configuration before testing

## How to Test

### 1. Test the backend

You can test the backend API using the Swagger UI at http://localhost:8000/docs or by sending a sample video file to the analysis endpoint.

Useful endpoints:

- GET / -> health check
- POST /api/video/transcribe -> transcribe a video
- POST /api/video/emotion -> analyze emotions
- POST /api/video/analyze -> run the full pipeline

### 2. Test the frontend

Open the frontend in your browser and confirm that the performance summary page loads properly.

### 3. Test the end-to-end flow

- Start the backend
- Start the frontend
- Load the extension in Chrome
- Record a short tab session
- Verify that the recording is processed and the summary appears in the UI

## Notes

- The backend depends on the Groq API for the final summary generation.
- Make sure the extension is allowed to access the tab or screen recording permissions in Chrome.
- If you run into issues, check the terminal output from both the backend and frontend servers.
