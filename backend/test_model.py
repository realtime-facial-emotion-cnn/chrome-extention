from tensorflow.keras.models import load_model
import os

MODEL_PATH = os.path.join("models", "emotion_model.keras")

model = load_model(MODEL_PATH)

print("Model loaded successfully")
model.summary()