"""
video_service.py  –  CNN emotion analysis service

CURRENT STATE: Returns dummy emotion scores so the app works
               without needing the Keras model.

HOW TO UPDATE (when Niluminda's CNN model is ready):
  1. pip install tensorflow opencv-python-headless
  2. Place your trained model at: backend/models/emotion_cnn.keras
  3. Uncomment the real implementation below and delete the stub block.
  4. Adjust EMOTION_LABELS to match the classes your model was trained on.
"""

import tempfile
import os

EMOTION_LABELS = ["happy", "neutral", "fear", "angry", "surprise", "sad", "disgust"]


# ─────────────────────────────────────────────────────────────────────────────
# STUB  (replace this whole block when the CNN model is ready)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_emotion(video_bytes: bytes, filename: str = "video.webm") -> dict:
    """
    STUB: returns dummy emotion distribution.
    When the CNN model is ready, delete this and uncomment the real one below.
    """
    print(f"[STUB] analyze_emotion called for {filename} ({len(video_bytes)} bytes)")
    return {
        "happy": 0.45,
        "neutral": 0.30,
        "fear": 0.08,
        "angry": 0.05,
        "surprise": 0.07,
        "sad": 0.03,
        "disgust": 0.02
    }


# ─────────────────────────────────────────────────────────────────────────────
# REAL IMPLEMENTATION  (uncomment when model is available)
# ─────────────────────────────────────────────────────────────────────────────

# import cv2
# import numpy as np
# from tensorflow import keras
#
# _model = None
# MODEL_PATH = os.path.join(os.path.dirname(file), "models", "emotion_cnn.keras")
#
# def _get_model():
#     global _model
#     if _model is None:
#         _model = keras.models.load_model(MODEL_PATH)
#     return _model
#
# def analyze_emotion(video_bytes: bytes, filename: str = "video.webm") -> dict:
#     ext = os.path.splitext(filename)[-1] or ".webm"
#     with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
#         tmp.write(video_bytes)
#         tmp_path = tmp.name
#     try:
#         cap = cv2.VideoCapture(tmp_path)
#         frame_preds = []
#         face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
#         model = _get_model()
#         while cap.isOpened():
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
#             faces = face_cascade.detectMultiScale(gray, 1.1, 4)
#             for (x, y, w, h) in faces:
#                 face_roi = gray[y:y+h, x:x+w]
#                 face_roi = cv2.resize(face_roi, (48, 48))
#                 face_roi = face_roi.astype("float32") / 255.0
#                 face_roi = np.expand_dims(face_roi, axis=(0, -1))
#                 preds = model.predict(face_roi, verbose=0)[0]
#                 frame_preds.append(preds)
#         cap.release()
#         if not frame_preds:
#             return {label: 0.0 for label in EMOTION_LABELS}
#         avg = np.mean(frame_preds, axis=0)
#         return {label: float(round(avg[i], 3)) for i, label in enumerate(EMOTION_LABELS)}
#     finally:
#         os.unlink(tmp_path)