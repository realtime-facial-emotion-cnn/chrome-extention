import tempfile
import cv2
import tensorflow as tf

emotion_model = tf.keras.models.load_model("models/emotion_cnn.keras")

emotion_labels = ["angry", "happy", "neutral", "sad", "surprise"]


async def analyze_video_emotions(video_file):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_video:
        content = await video_file.read()
        temp_video.write(content)
        temp_video_path = temp_video.name

    cap = cv2.VideoCapture(temp_video_path)

    frame_count = 0
    emotion_counts = {}

    while True:
        ret, frame = cap.read()

        if not ret:
            break

        frame_count += 1

        if frame_count % 30 != 0:
            continue

        # TODO:
        # 1. detect face
        # 2. crop face
        # 3. resize to CNN input size
        # 4. normalize
        # 5. predict emotion

    cap.release()

    return {
        "message": "Video received. CNN prediction logic goes here.",
        "processed_frames": frame_count
    }