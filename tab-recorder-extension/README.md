# Tab Recorder Extension README

This directory contains the Chrome extension used to record the active browser tab and pass the recording into the project workflow.

## Purpose

The extension provides a simple interface with Start Recording and Stop Recording actions. It captures the current tab's audio/video and prepares the recording for use by the backend or frontend application.

## Files

- manifest.json: Chrome extension manifest
- background.js: handles recording state and extension logic
- popup.html / popup.js: popup UI
- offscreen.html / offscreen.js: offscreen document used for recording

## Setup

1. Open Google Chrome.
2. Go to chrome://extensions.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this folder: tab-recorder-extension.

## Usage

- Click the extension icon.
- Press Start Recording to begin capturing the current tab.
- Press Stop Recording to stop and finalize the recording.

## Notes

- The extension may require permission to access the tab and recording features in Chrome.
- Make sure the target application or page is configured correctly if the recording is meant to be sent somewhere after capture.
- If you modify the extension behavior, update this README accordingly.
