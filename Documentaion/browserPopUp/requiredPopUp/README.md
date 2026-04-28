# Browser Extension Popup Guide

## Overview

This folder contains a browser extension popup implementation intended to capture tab audio, microphone audio, and screen video from the browser popup UI. The primary file with the actual popup HTML and JavaScript logic is currently stored as `Documentaion/handleBrowserExtention.md`, which contains the extension popup UI code.


## What this Popup Does

The popup UI provides buttons to:

- Start recording tab audio and microphone audio together
- Stop audio recording
- Start video recording of the screen/tab
- Stop video recording
- Send recorded media to a backend API for analysis and insight generation

When the user clicks **Get Insights**, the popup:

1. Sends the recorded audio to `http://localhost:8000/analyze-audio`
2. Sends the recorded video to `http://localhost:8000/analyze-video`
3. Stores the analysis results in `localStorage` under `meetingSummary`
4. Redirects the browser to `summary.html`

## Key Files and Concepts

- `Documentaion/handleBrowserExtention.md`
  - This file currently contains the popup page HTML, inline JavaScript, and UI buttons.
  - It is structured as a complete HTML document with buttons and script logic.

### Core behaviors in the popup code

- `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` is used to capture the browser tab or screen along with system audio.
- `navigator.mediaDevices.getUserMedia({ audio: true })` captures microphone audio.
- A `MediaRecorder` records the merged audio streams into a `Blob`.
- Another `MediaRecorder` records screen/video output into a separate `Blob`.
- `FormData` is used to upload the recorded `webm` files to the backend.

## How to Use This as an Extension Popup

To turn this into a browser extension popup, you would typically:

1. Create a `manifest.json` file for a Chrome extension.
2. Add a popup HTML file such as `popup.html` with the contents from `Documentaion/handleBrowserExtention.md`.
3. Configure the manifest so the extension action loads the popup:

```json
{
  "manifest_version": 3,
  "name": "Tab Audio Recorder",
  "version": "1.0",
  "action": {
    "default_popup": "popup.html",
    "default_title": "Tab Audio Recorder"
  },
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["http://localhost:8000/*"]
}
```

4. Load the extension as an unpacked extension in Chrome or a Chromium-based browser.
5. Open the popup and use the buttons to start/stop recording and request insights.

## Required Backend Endpoints

The popup code expects a local analysis service running at:

- `http://localhost:8000/analyze-audio`
- `http://localhost:8000/analyze-video`

Both endpoints should accept `POST` requests with `FormData` containing either:

- `audio` with the audio `webm` file
- `video` with the video `webm` file

The API should return JSON results used by the popup.

## Recommended Next Steps

- Rename `Documentaion/handleBrowserExtention.md` to `popup.html` or copy its contents into a proper extension HTML file.
- Add a `manifest.json` to the root of the extension project.
- Implement or run a backend service at `localhost:8000` to handle audio/video analysis.
- Create `summary.html` to present the final summary stored in `localStorage`.

## Important Notes

- This README is documentation only; the code itself is unchanged.
- The popup code is currently stored as an HTML document inside the documentation folder.
- The `experiment` folder is unrelated to this popup extension documentation and should be ignored for this guide.
