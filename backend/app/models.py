from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON, Enum as SQLEnum
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    TA = "ta"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class SubmissionStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    GRADED = "graded"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255))
    role = Column(SQLEnum(UserRole), default=UserRole.TA)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    courses = relationship("Course", back_populates="instructor")
    graded_submissions = relationship("Submission", foreign_keys="Submission.graded_by_id", back_populates="grader")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), index=True)
    description = Column(Text)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    instructor = relationship("User", back_populates="courses")
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    max_score = Column(Integer, default=100)
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = relationship("Course", back_populates="assignments")
    rubric = relationship("Rubric", back_populates="assignment", uselist=False, cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")


class Rubric(Base):
    __tablename__ = "rubrics"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), unique=True, nullable=False)
    criteria = Column(JSON, nullable=False)  # List of {name, description, weight, max_score}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = relationship("Assignment", back_populates="rubric")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_name = Column(String(255), nullable=False)
    student_id = Column(String(100), index=True)  # Student ID number
    file_path = Column(String(500), nullable=False)  # Supabase storage path
    original_filename = Column(String(255))
    extracted_text = Column(Text)
    status = Column(SQLEnum(SubmissionStatus), default=SubmissionStatus.UPLOADED)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    graded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = relationship("Assignment", back_populates="submissions")
    uploader = relationship("User", foreign_keys=[uploaded_by_id])
    grader = relationship("User", foreign_keys=[graded_by_id], back_populates="graded_submissions")
    grade = relationship("Grade", back_populates="submission", uselist=False, cascade="all, delete-orphan")


class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), unique=True, nullable=False)
    criterion_scores = Column(JSON, nullable=False)  # List of {criterion, score, weight, feedback}
    overall_score = Column(Float, nullable=False)
    strengths = Column(JSON)  # List of strings
    weaknesses = Column(JSON)  # List of strings
    summary_feedback = Column(Text)
    graded_at = Column(DateTime, default=datetime.utcnow)
    graded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    submission = relationship("Submission", back_populates="grade")
    grader = relationship("User")