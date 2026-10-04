from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    TA = "ta"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.TA


class UserCreate(UserBase):
    clerk_id: str


class UserResponse(UserBase):
    id: int
    clerk_id: str
    created_at: datetime

    class Config:
        orm_mode = True


class CourseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class CourseResponse(CourseBase):
    id: int
    instructor_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class AssignmentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    max_score: int = Field(100, ge=1)
    due_date: Optional[datetime] = None


class AssignmentCreate(AssignmentBase):
    course_id: int


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    max_score: Optional[int] = Field(None, ge=1)
    due_date: Optional[datetime] = None


class AssignmentResponse(AssignmentBase):
    id: int
    course_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class RubricCriterion(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str
    weight: float = Field(..., ge=0, le=1)
    max_score: int = Field(..., ge=1)


class RubricBase(BaseModel):
    criteria: List[RubricCriterion]


class RubricCreate(RubricBase):
    assignment_id: int


class RubricUpdate(BaseModel):
    criteria: Optional[List[RubricCriterion]] = None


class RubricResponse(RubricBase):
    id: int
    assignment_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class SubmissionStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    GRADED = "graded"
    FAILED = "failed"


class SubmissionBase(BaseModel):
    student_name: str = Field(..., min_length=1, max_length=255)
    student_id: Optional[str] = Field(None, max_length=100)


class SubmissionCreate(SubmissionBase):
    assignment_id: int
    file_path: str
    original_filename: str
    extracted_text: Optional[str] = None


class SubmissionResponse(SubmissionBase):
    id: int
    assignment_id: int
    status: SubmissionStatus
    uploaded_by_id: int
    graded_by_id: Optional[int] = None
    created_at: datetime

    class Config:
        orm_mode = True


class CriterionScore(BaseModel):
    criterion: str
    score: float = Field(..., ge=0, le=100)
    weight: float = Field(..., ge=0, le=1)
    feedback: str


class GradeBase(BaseModel):
    criterion_scores: List[CriterionScore]
    overall_score: float = Field(..., ge=0, le=100)
    strengths: List[str] = []
    weaknesses: List[str] = []
    summary_feedback: str


class GradeCreate(GradeBase):
    submission_id: int


class GradeResponse(GradeBase):
    id: int
    submission_id: int
    graded_by_id: int
    graded_at: datetime

    class Config:
        orm_mode = True


class GradingRequest(BaseModel):
    submission_id: int
    rubric_id: int


class GradingResult(BaseModel):
    criterion_scores: List[CriterionScore]
    overall_score: float
    strengths: List[str]
    weaknesses: List[str]
    summary_feedback: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    clerk_id: Optional[str] = None
    user_id: Optional[int] = None