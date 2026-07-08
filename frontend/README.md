# Frontend README

This directory contains the React-based frontend for the meeting analysis project.

## Purpose

The frontend provides a simple user interface for viewing the generated performance summary after the backend analyzes a recording.

## Project Structure

- perfomance-summary-ui/: the main Vite + React application

## Prerequisites

Make sure you have the following installed:

- Node.js 18+
- npm

## Setup

Navigate to the UI project folder and install dependencies:

```bash
cd perfomance-summary-ui
npm install
```

## Run the Frontend

Start the development server:

```bash
npm run dev
```

Then open the local URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Build for Production

To create a production build:

```bash
npm run build
```

## Linting

To check for basic code issues:

```bash
npm run lint
```

## Notes

- The frontend expects the backend to be running so it can communicate with the analysis API.
- If you change the app structure or add new components, update this file accordingly.
