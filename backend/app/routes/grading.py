from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_active_user, require_role
from app.models import Submission, Grade, Rubric, Assignment, Course, User, SubmissionStatus
from app.schemas import GradingRequest, GradingResult, GradeResponse
from app.services.grader import grade_submission

router = APIRouter(prefix="/grading", tags=["grading"])


@router.post("/grade", response_model=GradingResult)
def grade_submission_endpoint(
    request: GradingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ta", "instructor", "admin"])),
):
    submission = db.query(Submission).filter(Submission.id == request.submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    rubric = db.query(Rubric).filter(Rubric.id == request.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    if not submission.extracted_text:
        raise HTTPException(status_code=400, detail="Submission text not extracted yet")
    
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value not in ["admin", "ta"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submission.status = SubmissionStatus.PROCESSING
    db.commit()
    
    try:
        result = grade_submission(
            student_text=submission.extracted_text,
            rubric=rubric.criteria,
            assignment_title=assignment.title,
            assignment_description=assignment.description,
        )
        
        grade = Grade(
            submission_id=submission.id,
            criterion_scores=[c.model_dump() for c in result.criterion_scores],
            overall_score=result.overall_score,
            strengths=result.strengths,
            weaknesses=result.weaknesses,
            summary_feedback=result.summary_feedback,
            graded_by_id=current_user.id,
        )
        db.add(grade)
        
        submission.status = SubmissionStatus.GRADED
        submission.graded_by_id = current_user.id
        db.commit()
        
        return result
    
    except Exception as e:
        submission.status = SubmissionStatus.FAILED
        db.commit()
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")


@router.get("/submission/{submission_id}", response_model=GradeResponse)
def get_grade(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    grade = db.query(Grade).filter(Grade.submission_id == submission_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")
    return grade


@router.get("/assignment/{assignment_id}", response_model=List[GradeResponse])
def list_grades_by_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    submissions = db.query(Submission).filter(Submission.assignment_id == assignment_id).all()
    submission_ids = [s.id for s in submissions]
    grades = db.query(Grade).filter(Grade.submission_id.in_(submission_ids)).all()
    return grades


@router.delete("/submission/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grade(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["instructor", "admin"])),
):
    grade = db.query(Grade).filter(Grade.submission_id == submission_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")
    
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submission.status = SubmissionStatus.UPLOADED
    submission.graded_by_id = None
    db.delete(grade)
    db.commit()