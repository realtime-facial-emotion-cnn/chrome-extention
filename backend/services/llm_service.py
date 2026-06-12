import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


SYSTEM_PROMPT = """
You are an expert communication coach analyzing a meeting.

Return ONLY valid JSON (no markdown, no explanation) with EXACTLY:

{
  "grammar_score": float (0-1),
  "fluency_score": float (0-1),
  "confidence_score": float (0-1),
  "emotion_observation": string (1-2 sentences),
  "strengths": string (semicolon separated),
  "improvements": string (semicolon separated)
}
"""


def generate_summary(transcript: str, emotion_summary: dict) -> dict:
    client = _get_client()

    user_msg = f"""
Transcript:
{transcript}

Emotion Data:
{json.dumps(emotion_summary)}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",   # ✅ FIXED HERE
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()

    # clean markdown if model adds it
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(raw)

    except Exception as e:
        return {
            "grammar_score": 0.5,
            "fluency_score": 0.5,
            "confidence_score": 0.5,
            "emotion_observation": "LLM parsing failed, fallback used.",
            "strengths": "System fallback mode",
            "improvements": "Check model output format",
            "error": str(e),
            "raw_output": raw
        }