"""
llm_service.py  –  LLM-powered meeting summary generator

CURRENT STATE: Uses simple heuristics to compute scores and observations
               without calling any LLM. The Summary Page will still render
               fully with these values.

HOW TO UPDATE (when LLM API key is ready):
  1. pip install groq  (or langchain-groq)
  2. Add your key to backend/.env:   GROQ_API_KEY=gsk_...
  3. Uncomment the real implementation below and delete the stub block.
"""

import os


# ─────────────────────────────────────────────────────────────────────────────
# STUB  (simple heuristics — no LLM required)
# ─────────────────────────────────────────────────────────────────────────────

def generate_summary(transcript: str, emotion_summary: dict) -> dict:
    """
    STUB: derives scores from simple text/emotion heuristics.
    Replace with real LLM call when ready.
    """
    # Very simple heuristics for demo purposes
    words = transcript.split()
    word_count = len(words)

    filler_words = ["um", "uh", "like", "you know", "basically", "literally"]
    filler_count = sum(transcript.lower().count(fw) for fw in filler_words)
    filler_ratio = filler_count / max(word_count, 1)

    # Scores (0.0 – 1.0)
    fluency_score = round(max(0.4, min(1.0, 1.0 - filler_ratio * 5)), 2)
    grammar_score = round(min(1.0, 0.65 + (word_count / 500) * 0.2), 2)
    confidence_score = round(emotion_summary.get("happy", 0.3) + emotion_summary.get("neutral", 0.2), 2)
    confidence_score = min(1.0, confidence_score)

    # Dominant emotion
    dominant = max(emotion_summary, key=emotion_summary.get) if emotion_summary else "neutral"
    emotion_map = {
        "happy": "Speaker appeared confident and enthusiastic throughout.",
        "neutral": "Speaker maintained a calm, composed tone.",
        "fear": "Speaker showed signs of nervousness at times.",
        "angry": "Speaker appeared tense in some moments.",
        "surprise": "Speaker showed varied emotional responses.",
        "sad": "Speaker's energy appeared low at points.",
        "disgust": "Speaker showed discomfort during parts of the session.",
    }
    emotion_observation = emotion_map.get(dominant, "Emotions were mixed throughout the session.")

    # Strengths and improvements based on scores
    strengths_list = []
    improvements_list = []

    if fluency_score >= 0.75:
        strengths_list.append("Fluent speech with minimal filler words")
    else:
        improvements_list.append("Reduce filler words (um, uh, like)")

    if grammar_score >= 0.75:
        strengths_list.append("Clear sentence structure")
    else:
        improvements_list.append("Work on sentence completeness")

    if confidence_score >= 0.65:
        strengths_list.append("Confident and positive body language")
    else:
        improvements_list.append("Build more confidence — practice eye contact and pacing")

    if word_count > 100:
        strengths_list.append("Good content depth and elaboration")
    else:
        improvements_list.append("Expand responses with more detail")

    return {
        "grammar_score": grammar_score,
        "fluency_score": fluency_score,
        "confidence_score": confidence_score,
        "emotion_observation": emotion_observation,
        "strengths": "; ".join(strengths_list) if strengths_list else "Overall good performance",
        "improvements": "; ".join(improvements_list) if improvements_list else "Keep up the good work",
    }


# ─────────────────────────────────────────────────────────────────────────────
# REAL IMPLEMENTATION  (uncomment when Groq API key is ready)
# ─────────────────────────────────────────────────────────────────────────────

# _client = None
#
# def _get_client():
#     global _client
#     if _client is None:
#         _client = Groq(api_key=os.environ["GROQ_API_KEY"])
#     return _client
#
# SYSTEM_PROMPT = """
# You are an expert communication coach. Given a meeting transcript and emotion data,
# return ONLY valid JSON (no markdown, no explanation) with exactly these fields:
# {
#   "grammar_score": float 0-1,
#   "fluency_score": float 0-1,
#   "confidence_score": float 0-1,
#   "emotion_observation": "1-2 sentence string",
#   "strengths": "comma-separated string",
#   "improvements": "comma-separated string"
# }
# """
#
# def generate_summary(transcript: str, emotion_summary: dict) -> dict:
#     client = _get_client()
#     user_msg = f"Transcript:\n{transcript}\n\nEmotion data:\n{json.dumps(emotion_summary)}"
#     response = client.chat.completions.create(
#         model="llama3-8b-8192",
#         messages=[
#             {"role": "system", "content": SYSTEM_PROMPT},
#             {"role": "user",   "content": user_msg},
#         ],
#         temperature=0.2,
#     )
#     raw = response.choices[0].message.content.strip()
#     # Strip any accidental markdown fences
#     raw = raw.replace("```json", "").replace("```", "").strip()
#     return json.loads(raw)