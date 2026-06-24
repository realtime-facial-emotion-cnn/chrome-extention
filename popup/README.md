# Browser Extension Popup (Audio + Video Capture)

## Overview
This popup is part of a browser extension that captures tab audio, microphone audio, and screen video for analysis.

## Features
- Start/Stop tab + microphone audio recording
- Start/Stop screen/video recording
- Capture media using MediaRecorder API
- Send recorded files to backend API for processing
- Store analysis results in localStorage
- Redirect to summary page after processing

## How It Works

1. User opens the extension popup
2. Clicks "Start Recording"
   - Captures system/tab audio using `getDisplayMedia`
   - Captures microphone audio using `getUserMedia`
3. MediaRecorder records audio and video streams
4. Click "Stop Recording" to stop capture
5. Click "Get Insights"
   - Sends audio to: `/analyze-audio`
   - Sends video to: `/analyze-video`
6. Backend returns analysis results
7. Results saved in `localStorage` as `meetingSummary`
8. Redirects to `summary.html`

## Tech Used
- HTML
- JavaScript (MediaRecorder API)
- Browser Extension APIs
- Fetch API for backend communication

## Note
This is a temporary implementation using dummy backend data while CNN model training is in progress.