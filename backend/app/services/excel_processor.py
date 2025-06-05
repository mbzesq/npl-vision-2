import pandas as pd
from sqlalchemy.orm import Session
from app.models.loan import Loan
from difflib import get_close_matches
from datetime import datetime
from decimal import Decimal
import logging

class ExcelProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.column_mapping = {
            'borrower_name': ['borrower', 'borrower name', 'borrower_name', 'primary borrower', 'mortgagor'],
            'co_borrower_name': ['co-borrower', 'co borrower', 'co_borrower', 'secondary borrower', 'co-mortgagor'],
            'address': ['address', 'property address', 'street address', 'property_address'],
            'city': ['city'],
            'state': ['state', 'st'],
            'zip_code': ['zip', 'zip code', 'zipcode', 'postal code'],
            'loan_amount': ['loan amount', 'original balance', 'principal amount', 'loan_amount'],
            'interest_rate': ['interest rate', 'rate', 'int rate', 'interest_rate'],
            'maturity_date': ['maturity date', 'due date', 'maturity_date'],
            'date_of_loan': ['loan date', 'origination date', 'date_of_loan'],
            'current_upb': ['current balance', 'unpaid balance', 'current upb', 'upb'],
            'accrued_interest': ['accrued interest', 'interest accrued'],
            'total_balance': ['total balance', 'total amount due'],
            'last_paid_date': ['last payment date', 'last paid', 'last_paid_date'],
            'next_due_date': ['next due date', 'next payment date', 'next_due_date'],
            'remaining_term': ['remaining term', 'months remaining'],
            'legal_status': ['status', 'legal status', 'loan status'],
            'lien_position': ['lien position', 'position'],
            'investor_name': ['investor', 'investor name', 'owner']
        }

    async def process_file(self, file_path: str):
        try:
            df = pd.read_excel(file_path)
            
            mapped_columns = self._map_columns(df.columns)
            
            loans_created = 0
            preview_data = []
            
            for _, row in df.iterrows():
                loan_data = self._extract_loan_data(row, mapped_columns)
                if loan_data:
                    loan = Loan(**loan_data)
                    self.db.add(loan)
                    loans_created += 1
                    
                    if len(preview_data) < 5:
                        preview_data.append(loan_data)
            
            self.db.commit()
            
            return {
                "loans_created": loans_created,
                "preview": preview_data
            }
            
        except Exception as e:
            self.db.rollback()
            logging.error(f"Error processing Excel file: {str(e)}")
            raise e

    def _map_columns(self, columns):
        mapped = {}
        columns_lower = [col.lower().strip() for col in columns]
        
        for field, possible_names in self.column_mapping.items():
            best_match = None
            best_score = 0
            
            for col_name in possible_names:
                matches = get_close_matches(col_name.lower(), columns_lower, n=1, cutoff=0.6)
                if matches:
                    score = self._similarity_score(col_name.lower(), matches[0])
                    if score > best_score:
                        best_match = columns[columns_lower.index(matches[0])]
                        best_score = score
            
            if best_match:
                mapped[field] = best_match
        
        return mapped

    def _similarity_score(self, a, b):
        return len(set(a) & set(b)) / len(set(a) | set(b))

    def _extract_loan_data(self, row, mapped_columns):
        try:
            loan_data = {}
            
            for field, column in mapped_columns.items():
                if column in row.index and pd.notna(row[column]):
                    value = row[column]
                    
                    if field in ['loan_amount', 'current_upb', 'accrued_interest', 'total_balance']:
                        try:
                            loan_data[field] = Decimal(str(float(value)))
                        except (ValueError, TypeError):
                            loan_data[field] = None
                    elif field == 'interest_rate':
                        try:
                            rate = float(value)
                            if rate > 1:
                                rate = rate / 100
                            loan_data[field] = Decimal(str(rate))
                        except (ValueError, TypeError):
                            loan_data[field] = None
                    elif field in ['maturity_date', 'date_of_loan', 'last_paid_date', 'next_due_date']:
                        try:
                            if isinstance(value, str):
                                loan_data[field] = datetime.strptime(value, '%Y-%m-%d').date()
                            else:
                                loan_data[field] = value.date() if hasattr(value, 'date') else value
                        except (ValueError, TypeError):
                            loan_data[field] = None
                    elif field == 'remaining_term':
                        try:
                            loan_data[field] = int(float(value))
                        except (ValueError, TypeError):
                            loan_data[field] = None
                    else:
                        loan_data[field] = str(value).strip() if value else None
            
            return loan_data if any(loan_data.values()) else None
            
        except Exception as e:
            logging.error(f"Error extracting loan data from row: {str(e)}")
            return None