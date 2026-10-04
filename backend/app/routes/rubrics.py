from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_active_user, require_role
from app.models import Rubric, Assignment, Course, User
from app.schemas import RubricCreate, RubricUpdate, RubricResponse, RubricCriterion

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.post("", response_model=RubricResponse, status_code=status.HTTP_201_CREATED)
def create_rubric(
    rubric_in: RubricCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["instructor", "admin", "ta"])),
):
    assignment = db.query(Assignment).filter(Assignment.id == rubric_in.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value not in ["admin", "ta"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = db.query(Rubric).filter(Rubric.assignment_id == rubric_in.assignment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rubric already exists for this assignment")
    
    criteria_data = [c.model_dump() for c in rubric_in.criteria]
    total_weight = sum(c.weight for c in rubric_in.criteria)
    if abs(total_weight - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail="Criteria weights must sum to 1.0")
    
    rubric = Rubric(assignment_id=rubric_in.assignment_id, criteria=criteria_data)
    db.add(rubric)
    db.commit()
    db.refresh(rubric)
    return rubric


@router.get("/assignment/{assignment_id}", response_model=RubricResponse)
def get_rubric_by_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rubric = db.query(Rubric).filter(Rubric.assignment_id == assignment_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    return rubric


@router.get("/{rubric_id}", response_model=RubricResponse)
def get_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    return rubric


@router.patch("/{rubric_id}", response_model=RubricResponse)
def update_rubric(
    rubric_id: int,
    rubric_in: RubricUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["instructor", "admin", "ta"])),
):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    assignment = db.query(Assignment).filter(Assignment.id == rubric.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value not in ["admin", "ta"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if rubric_in.criteria is not None:
        criteria_data = [c.model_dump() for c in rubric_in.criteria]
        total_weight = sum(c.weight for c in rubric_in.criteria)
        if abs(total_weight - 1.0) > 0.01:
            raise HTTPException(status_code=400, detail="Criteria weights must sum to 1.0")
        rubric.criteria = criteria_data
    
    db.commit()
    db.refresh(rubric)
    return rubric


@router.delete("/{rubric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["instructor", "admin"])),
):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    assignment = db.query(Assignment).filter(Assignment.id == rubric.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.instructor_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(rubric)
    db.commit()