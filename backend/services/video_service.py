"""
video_service.py - CNN emotion analysis service (Niluminda's model)

Model: backend/models/emotion_model.keras
Input: 48x48 grayscale face crops
Output: 7-class softmax -> mapped to combined session metrics
"""

import os
import tempfile
import cv2
import numpy as np
from tensorflow.keras.models import load_model

EMOTION_LABELS = ["angry", "disgusted", "fearful", "happy", "neutral", "sad", "surprise"]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "emotion_model.keras")

_model = None
_face_cascade = None


def _get_model():
    global _model
    if _model is None:
        print("Loading real CNN model from:", MODEL_PATH)
        _model = load_model(MODEL_PATH)
        print("Model loaded. Input shape:", _model.input_shape)
    return _model


def _get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _face_cascade


def _compute_combined_emotions(avg_array):
    """Maps 7 base emotions -> 5 combined session metrics (from training notebook)."""
    E = np.array(avg_array, dtype=np.float32)

    labels = ["Confidence", "Nervousness", "Engagement", "Frustration", "Emotional_Stability"]

    W = np.array([
        [0.05, 0.20, 0.05, 0.50, 0.05],
        [0.00, 0.10, 0.00, 0.30, 0.00],
        [0.05, 0.45, 0.05, 0.05, 0.05],
        [0.45, 0.00, 0.50, 0.00, 0.25],
        [0.35, 0.10, 0.25, 0.05, 0.55],
        [0.00, 0.10, 0.00, 0.10, 0.05],
        [0.10, 0.05, 0.15, 0.00, 0.05]
    ], dtype=np.float32)

    W = W / np.sum(W, axis=0, keepdims=True)
    combined = (E @ W) * 100

    return {labels[i]: float(combined[i]) for i in range(len(labels))}


def analyze_emotion(video_bytes: bytes, filename: str = "video.webm") -> dict:
    ext = os.path.splitext(filename)[-1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    try:
        model = _get_model()
        face_cascade = _get_face_cascade()
        cap = cv2.VideoCapture(tmp_path)

        sum_dic = {label: 0 for label in EMOTION_LABELS}
        total = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

            for (x, y, w, h) in faces:
                roi = gray[y:y + h, x:x + w]
                cropped = np.expand_dims(np.expand_dims(cv2.resize(roi, (48, 48)), -1), 0)

                pred = model.predict(cropped, verbose=0)
                maxindex = int(np.argmax(pred))
                sum_dic[EMOTION_LABELS[maxindex]] += 1
                total += 1

        cap.release()

        if total == 0:
            base_emotions = {label: 0.0 for label in EMOTION_LABELS}
            combined = {k: 0.0 for k in ["Confidence", "Nervousness", "Engagement", "Frustration", "Emotional_Stability"]}
            return {**base_emotions, **combined}

        avg_dic = {label: sum_dic[label] / total for label in EMOTION_LABELS}
        avg_array = [avg_dic[label] for label in EMOTION_LABELS]
        combined = _compute_combined_emotions(avg_array)

        return {**avg_dic, **combined}

    finally:
        os.unlink(tmp_path)