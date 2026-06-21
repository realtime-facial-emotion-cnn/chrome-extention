let audioRecorder;
let videoRecorder;

let tabStream;
let micStream;
let webcamStream;

let audioContext;
let destination;

let recordedChunks = [];
let recordedAudioBlob = null;

let videoChunks = [];
let recordedVideoBlob = null;


// AUDIO HANDLING
// --------------------------------------------------------------------------------

document.getElementById("startBtn").onclick = async () => {

    try {

        console.log("Requesting system audio and microphone access...");

        // Capture system/tab audio
        tabStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        // Capture microphone audio
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        // Create audio mixer
        audioContext = new AudioContext();

        destination = audioContext.createMediaStreamDestination();

        const tabSource =
            audioContext.createMediaStreamSource(tabStream);

        const micSource =
            audioContext.createMediaStreamSource(micStream);

        // Mix both audio streams
        tabSource.connect(destination);
        micSource.connect(destination);

        // Check supported mime type
        let audioMimeType = "audio/webm";

        if (!MediaRecorder.isTypeSupported(audioMimeType)) {
            alert("audio/webm is not supported in this browser");
            return;
        }

        // Create recorder
        audioRecorder = new MediaRecorder(destination.stream, {
            mimeType: audioMimeType
        });

        recordedChunks = [];

        audioRecorder.ondataavailable = (event) => {

            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }

        };

        audioRecorder.onstop = () => {

            recordedAudioBlob = new Blob(recordedChunks, {
                type: audioMimeType
            });

            console.log("Audio recording saved!");

            // Stop all tracks
            if (tabStream) {
                tabStream.getTracks().forEach(track => track.stop());
            }

            if (micStream) {
                micStream.getTracks().forEach(track => track.stop());
            }

            // Close audio context
            if (audioContext) {
                audioContext.close();
            }

        };

        audioRecorder.start();

        console.log("Audio recording started!");

    } catch (error) {

        console.error("Error starting audio recording:", error);

        if (error.name === "NotAllowedError") {

            alert("Permission denied. Please allow screen and microphone access.");

        } else if (error.name === "NotFoundError") {

            alert("No microphone or audio source found.");

        } else {

            alert("Error starting audio recording: " + error.message);

        }

    }

};


document.getElementById("stopBtn").onclick = () => {

    if (audioRecorder && audioRecorder.state === "recording") {

        audioRecorder.stop();

        console.log("Audio recording stopped.");

    } else {

        alert("No active audio recording.");

    }

};


// VIDEO HANDLING
// --------------------------------------------------------------------------------

document.getElementById("startVideoBtn").onclick = async () => {

    try {

        console.log("Requesting webcam access...");

        // Capture webcam video
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        let videoMimeType = "video/webm";

        if (!MediaRecorder.isTypeSupported(videoMimeType)) {
            alert("video/webm is not supported in this browser");
            return;
        }

        // Create video recorder
        videoRecorder = new MediaRecorder(webcamStream, {
            mimeType: videoMimeType
        });

        videoChunks = [];

        videoRecorder.ondataavailable = (event) => {

            if (event.data.size > 0) {
                videoChunks.push(event.data);
            }

        };

        videoRecorder.onstop = () => {

            recordedVideoBlob = new Blob(videoChunks, {
                type: videoMimeType
            });

            console.log("Video recording saved!");

            // Stop webcam tracks
            if (webcamStream) {
                webcamStream.getTracks().forEach(track => track.stop());
            }

        };

        videoRecorder.start();

        console.log("Video recording started!");

    } catch (error) {

        console.error("Error starting video recording:", error);

        if (error.name === "NotAllowedError") {

            alert("Permission denied. Please allow webcam access.");

        } else if (error.name === "NotFoundError") {

            alert("No webcam found.");

        } else {

            alert("Error starting video recording: " + error.message);

        }

    }

};


document.getElementById("stopVideoBtn").onclick = () => {

    if (videoRecorder && videoRecorder.state === "recording") {

        videoRecorder.stop();

        console.log("Video recording stopped.");

    } else {

        alert("No active video recording.");

    }

};


// INSIGHT BUTTON
// --------------------------------------------------------------------------------

document.getElementById("insightBtn").onclick = async () => {

    try {

        // Process audio
        const audioText = await handleAudio();

        // Process video
        const videoFacialSummaryText = await handleVideo();

        // Combine results
        const finalSummary = {
            audioSummary: audioText,
            videoSummary: videoFacialSummaryText
        };

        // Store locally
        localStorage.setItem(
            "meetingSummary",
            JSON.stringify(finalSummary)
        );

        // Redirect
        window.location.href = "summary.html";

    } catch (error) {

        console.error("Insight generation failed:", error);

        alert("Failed to generate insights.");

    }

};


// AUDIO API CALL
// --------------------------------------------------------------------------------

const handleAudio = async () => {

    if (!recordedAudioBlob) {

        alert("No audio recording available.");

        return null;

    }

    try {

        const formData = new FormData();

        formData.append(
            "audio",
            recordedAudioBlob,
            "meeting-audio.webm"
        );

        const response = await fetch(
            "http://localhost:8000/analyze-audio",
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error("Audio API request failed");
        }

        const result = await response.json();

        return result;

    } catch (error) {

        console.error("Audio processing error:", error);

        alert("Failed to process audio.");

        return null;

    }

};


// VIDEO API CALL
// --------------------------------------------------------------------------------

const handleVideo = async () => {

    if (!recordedVideoBlob) {

        alert("No video recording available.");

        return null;

    }

    try {

        const formData = new FormData();

        formData.append(
            "video",
            recordedVideoBlob,
            "meeting-video.webm"
        );

        const response = await fetch(
            "http://localhost:8000/analyze-video",
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error("Video API request failed");
        }

        const result = await response.json();

        return result;

    } catch (error) {

        console.error("Video processing error:", error);

        alert("Failed to process video.");

        return null;

    }

};

