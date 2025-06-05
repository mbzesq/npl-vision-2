from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.loan import Loan, Document
from typing import List, Optional

router = APIRouter()

@router.get("/")
async def get_loans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    loans = db.query(Loan).offset(skip).limit(limit).all()
    return loans

@router.get("/{loan_id}")
async def get_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan

@router.get("/{loan_id}/documents")
async def get_loan_documents(loan_id: int, db: Session = Depends(get_db)):
    documents = db.query(Document).filter(Document.loan_id == loan_id).all()
    return documents