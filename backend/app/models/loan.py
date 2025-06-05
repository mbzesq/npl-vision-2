from sqlalchemy import Column, Integer, String, Decimal, Date, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Loan(Base):
    __tablename__ = "loans"
    
    id = Column(Integer, primary_key=True, index=True)
    borrower_name = Column(String, index=True)
    co_borrower_name = Column(String)
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    loan_amount = Column(Decimal(15, 2))
    interest_rate = Column(Decimal(5, 4))
    maturity_date = Column(Date)
    date_of_loan = Column(Date)
    current_upb = Column(Decimal(15, 2))
    accrued_interest = Column(Decimal(15, 2))
    total_balance = Column(Decimal(15, 2))
    last_paid_date = Column(Date)
    next_due_date = Column(Date)
    remaining_term = Column(Integer)
    legal_status = Column(String)
    lien_position = Column(String)
    investor_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    documents = relationship("Document", back_populates="loan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    document_type = Column(String)
    recording_date = Column(Date)
    instrument_number = Column(String)
    original_lender = Column(String)
    assignor = Column(String)
    assignee = Column(String)
    confidence_score = Column(Decimal(3, 2))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    loan = relationship("Loan", back_populates="documents")