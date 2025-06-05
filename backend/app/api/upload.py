from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.excel_processor import ExcelProcessor
from app.services.pdf_processor import PDFProcessor
import os
import tempfile

router = APIRouter()

@router.post("/excel")
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are allowed")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()
            
            processor = ExcelProcessor(db)
            result = await processor.process_file(temp_file.name)
            
            os.unlink(temp_file.name)
            
            return {
                "message": "Excel file processed successfully",
                "loans_created": result["loans_created"],
                "preview": result["preview"]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()
            
            processor = PDFProcessor(db)
            result = await processor.process_file(temp_file.name)
            
            os.unlink(temp_file.name)
            
            return {
                "message": "PDF file processed successfully",
                "document_data": result["document_data"],
                "confidence": result["confidence"]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))