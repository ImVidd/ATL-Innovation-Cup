import json
from typing import List, Dict, Any
from openai import OpenAI

from app.config import settings


GRADING_SYSTEM_PROMPT = """You are an expert Teaching Assistant grading student assignments. 
Evaluate the student's answer against the provided rubric criteria.

Your task:
1. Read the assignment context and rubric carefully
2. Evaluate the student's answer against EACH criterion
3. Assign a score (0-100) for each criterion based on its weight and max_score
4. Provide specific, constructive feedback for each criterion
5. Identify overall strengths and weaknesses
6. Write a summary feedback paragraph

Output MUST be valid JSON only. No markdown, no extra text."""


GRADING_USER_PROMPT = """ASSIGNMENT: {assignment_title}
DESCRIPTION: {assignment_description}

RUBRIC CRITERIA:
{rubric_json}

STUDENT ANSWER:
{student_text}

Output JSON with this exact structure:
{{
  "criterion_scores": [
    {{
      "criterion": "exact criterion name from rubric",
      "score": 0-100,
      "weight": 0-1,
      "feedback": "specific feedback for this criterion"
    }}
  ],
  "overall_score": 0-100,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "summary_feedback": "Overall feedback paragraph..."
}}"""


def format_rubric_for_prompt(criteria: List[Dict[str, Any]]) -> str:
    lines = []
    for i, c in enumerate(criteria, 1):
        lines.append(f"{i}. {c['name']} (Weight: {c['weight']}, Max Score: {c['max_score']})")
        lines.append(f"   Description: {c['description']}")
    return "\n".join(lines)


def grade_submission(
    student_text: str,
    rubric: List[Dict[str, Any]],
    assignment_title: str,
    assignment_description: str = "",
) -> dict:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    rubric_json = format_rubric_for_prompt(rubric)
    
    messages = [
        {"role": "system", "content": GRADING_SYSTEM_PROMPT},
        {"role": "user", "content": GRADING_USER_PROMPT.format(
            assignment_title=assignment_title,
            assignment_description=assignment_description or "No description provided",
            rubric_json=rubric_json,
            student_text=student_text[:8000],
        )},
    ]
    
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.1,
        max_tokens=2000,
    )
    
    content = response.choices[0].message.content
    
    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        result = parse_grading_fallback(content, rubric)
    
    validate_and_normalize(result, rubric)
    return result


def validate_and_normalize(result: dict, rubric: List[Dict[str, Any]]) -> None:
    if "criterion_scores" not in result:
        result["criterion_scores"] = []
    
    rubric_names = {c["name"] for c in rubric}
    for cs in result["criterion_scores"]:
        if cs["criterion"] not in rubric_names:
            cs["criterion"] = list(rubric_names)[0] if rubric_names else "Unknown"
        cs["score"] = max(0, min(100, float(cs.get("score", 0))))
        cs["weight"] = max(0, min(1, float(cs.get("weight", 0))))
        cs["feedback"] = cs.get("feedback", "")
    
    result["overall_score"] = max(0, min(100, float(result.get("overall_score", 0))))
    result["strengths"] = result.get("strengths", [])[:5]
    result["weaknesses"] = result.get("weaknesses", [])[:5]
    result["summary_feedback"] = result.get("summary_feedback", "")


def parse_grading_fallback(content: str, rubric: List[Dict[str, Any]]) -> dict:
    result = {
        "criterion_scores": [],
        "overall_score": 50,
        "strengths": ["Attempted the assignment"],
        "weaknesses": ["Could not parse detailed grading"],
        "summary_feedback": "Grading completed with limited parsing. Please review manually.",
    }
    
    for c in rubric:
        result["criterion_scores"].append({
            "criterion": c["name"],
            "score": 50,
            "weight": c["weight"],
            "feedback": "Automatic fallback score - please review manually",
        })
    
    return result