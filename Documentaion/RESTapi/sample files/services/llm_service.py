from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()


class InterviewSummary(BaseModel):
    overall_summary: str
    grammar_score: int = Field(ge=0, le=100)
    fluency_score: int = Field(ge=0, le=100)
    confidence_score: int = Field(ge=0, le=100)
    emotion_observation: str
    strengths: list[str]
    improvements: list[str]


llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0
)

structured_llm = llm.with_structured_output(InterviewSummary)


def generate_interview_summary(transcript: str, emotion_summary: dict):
    prompt = f"""
    Analyze this interview session.

    Transcript:
    {transcript}

    Emotion summary:
    {emotion_summary}

    Return a structured interview performance report.
    """

    result = structured_llm.invoke(prompt)

    return result.model_dump()