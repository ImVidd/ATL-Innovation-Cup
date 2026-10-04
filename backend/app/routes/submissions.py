from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import uuid
import os

from app.database import get_db
from app.auth import get_current_active_user, require_role
from app.models import Submission, Assignment, Course, User, SubmissionStatus
from app.schemas import SubmissionCreate, SubmissionResponse
from app.services.storage import upload_file

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post("/upload", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def upload_submission(
    assignment_id: int = Form(...),
    student_name: str = Form(...),
    student_id: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ta", "instructor", "admin"])),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value not in ["admin", "ta"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not file.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif')):
        raise HTTPException(status_code=400, detail="Only PDF and image files allowed")
    
    file_ext = os.path.splitext(file.filename)[1]
    storage_path = f"{assignment_id}/{uuid.uuid4()}{file_ext}"
    
    file_content = await file.read()
    upload_file(storage_path, file_content)
    
    submission = Submission(
        assignment_id=assignment_id,
        student_name=student_name,
        student_id=student_id,
        file_path=storage_path,
        original_filename=file.filename,
        uploaded_by_id=current_user.id,
        status=SubmissionStatus.UPLOADED,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.post("", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def create_submission(
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ta", "instructor", "admin"])),
):
    assignment = db.query(Assignment).filter(Assignment.id == submission_in.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value not in ["admin", "ta"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submission = Submission(**submission_in.model_dump(), uploaded_by_id=current_user.id)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("", response_model=List[SubmissionResponse])
def list_submissions(
    assignment_id: int = None,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(Submission)
    if assignment_id:
        query = query.filter(Submission.assignment_id == assignment_id)
    if status:
        query = query.filter(Submission.status == status)
    return query.all()


@router.get("/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.patch("/{submission_id}/status")
def update_submission_status(
    submission_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ta", "instructor", "admin"])),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    try:
        submission.status = SubmissionStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    db.commit()
    return {"status": submission.status}


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ta", "instructor", "admin"])),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value not in ["admin", "ta"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(submission)
    db.commit()