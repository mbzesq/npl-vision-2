import PyPDF2
import openai
import json
import os
from sqlalchemy.orm import Session
from app.models.loan import Document
from datetime import datetime
from decimal import Decimal
import logging

class PDFProcessor:
    def __init__(self, db: Session):
        self.db = db
        openai.api_key = os.getenv("OPENAI_API_KEY")

    async def process_file(self, file_path: str):
        try:
            text_content = self._extract_text_from_pdf(file_path)
            
            if not text_content.strip():
                raise ValueError("No text content extracted from PDF")

            extracted_data = await self._extract_data_with_openai(text_content)
            
            document_data = self._process_extracted_data(extracted_data)
            
            return {
                "document_data": document_data,
                "confidence": extracted_data.get("confidence", 0.0)
            }
            
        except Exception as e:
            logging.error(f"Error processing PDF file: {str(e)}")
            raise e

    def _extract_text_from_pdf(self, file_path: str):
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                
                return text
                
        except Exception as e:
            logging.error(f"Error extracting text from PDF: {str(e)}")
            raise e

    async def _extract_data_with_openai(self, text_content: str):
        try:
            prompt = f"""
            Extract structured data from this loan document. Return a JSON object with the following fields:
            
            - document_type: The type of document (note, mortgage, assignment, allonge, etc.)
            - borrower_name: Primary borrower name
            - co_borrower_name: Co-borrower name if present
            - date_of_loan: Date when the loan was originated
            - recording_date: Date when the document was recorded
            - instrument_number: Recording or instrument number
            - property_address: Full property address (split into components if possible)
            - city: Property city
            - state: Property state
            - zip_code: Property zip code
            - loan_amount: Original loan amount
            - interest_rate: Interest rate (as decimal, e.g., 0.05 for 5%)
            - maturity_date: Loan maturity date
            - original_lender: Original lender name
            - assignor: Entity assigning the loan (if assignment document)
            - assignee: Entity receiving the assignment (if assignment document)
            - confidence: Your confidence in the extraction (0.0 to 1.0)
            
            If a field is not found or unclear, set it to null. For dates, use YYYY-MM-DD format.
            For multiple assignments, provide the most recent assignor and assignee.
            
            Document text:
            {text_content[:4000]}  # Limit to first 4000 chars to stay within token limits
            
            Return only valid JSON:
            """

            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert at extracting structured data from loan documents. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Try to extract JSON from the response
            try:
                # Remove any markdown code block formatting
                if content.startswith("```json"):
                    content = content[7:]
                if content.endswith("```"):
                    content = content[:-3]
                
                extracted_data = json.loads(content)
                return extracted_data
                
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse OpenAI response as JSON: {e}")
                logging.error(f"Response content: {content}")
                
                # Return a basic structure with low confidence
                return {
                    "document_type": "unknown",
                    "confidence": 0.1,
                    "error": "Failed to parse extraction results"
                }
                
        except Exception as e:
            logging.error(f"Error calling OpenAI API: {str(e)}")
            raise e

    def _process_extracted_data(self, extracted_data):
        try:
            processed = {}
            
            # Process each field appropriately
            for field, value in extracted_data.items():
                if value is None or value == "null":
                    processed[field] = None
                elif field in ['date_of_loan', 'recording_date', 'maturity_date']:
                    try:
                        if isinstance(value, str) and value:
                            processed[field] = datetime.strptime(value, '%Y-%m-%d').date()
                        else:
                            processed[field] = None
                    except ValueError:
                        processed[field] = None
                elif field == 'loan_amount':
                    try:
                        if value:
                            # Remove currency symbols and commas
                            clean_value = str(value).replace('$', '').replace(',', '')
                            processed[field] = Decimal(clean_value)
                        else:
                            processed[field] = None
                    except (ValueError, TypeError):
                        processed[field] = None
                elif field == 'interest_rate':
                    try:
                        if value:
                            rate = float(value)
                            # If rate is greater than 1, assume it's a percentage
                            if rate > 1:
                                rate = rate / 100
                            processed[field] = Decimal(str(rate))
                        else:
                            processed[field] = None
                    except (ValueError, TypeError):
                        processed[field] = None
                elif field == 'confidence':
                    try:
                        processed[field] = float(value) if value else 0.0
                    except (ValueError, TypeError):
                        processed[field] = 0.0
                else:
                    processed[field] = str(value).strip() if value else None
            
            return processed
            
        except Exception as e:
            logging.error(f"Error processing extracted data: {str(e)}")
            return extracted_data