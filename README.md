# NPL Vision - Non-Performing Loan Data Management Platform

A modern SaaS platform for institutional investors and asset managers to upload, process, and manage non-performing loan (NPL) data. The platform extracts structured data from Excel files and PDF documents using AI-powered parsing.

## 🏗️ Architecture

- **Frontend**: Next.js 14 with React and Tailwind CSS
- **Backend**: FastAPI (Python) with PostgreSQL
- **AI Integration**: OpenAI GPT-4 for PDF document extraction
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Security**: No file retention policy - documents are discarded after processing

## 🚀 Features

### Data Ingestion
- **Excel Parsing**: Intelligent column mapping using fuzzy matching for standardized servicer data
- **PDF Extraction**: AI-powered extraction from loan documents (notes, mortgages, assignments, allonges)
- **Real-time Processing**: Upload feedback with data preview
- **Security**: Automatic file deletion after processing

### Document Types Supported
- Excel files (.xlsx, .xls) - Loan portfolio data
- PDF documents - Legal loan documents with structured data extraction

### Data Fields Extracted

#### From Excel Files:
```
borrower_name, co_borrower_name, address, city, state, zip_code,
loan_amount, interest_rate, maturity_date, date_of_loan,
current_upb, accrued_interest, total_balance,
last_paid_date, next_due_date, remaining_term,
legal_status, lien_position, investor_name
```

#### From PDF Documents:
```
document_type, borrower_name, co_borrower_name, date_of_loan,
recording_date, instrument_number, property_address,
loan_amount, interest_rate, maturity_date, original_lender,
assignor, assignee
```

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL 13+
- OpenAI API key

### 1. Clone Repository
```bash
git clone https://github.com/mbzesq/npl-vision-2.git
cd npl-vision-2
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb npl_vision_db

# Or using psql
psql -c "CREATE DATABASE npl_vision_db;"
```

### 3. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database URL and OpenAI API key
```

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local if needed (defaults to localhost:8000)
```

## 🔧 Configuration

### Backend Environment (.env)
```bash
DATABASE_URL=postgresql://user:password@localhost/npl_vision_db
OPENAI_API_KEY=your_openai_api_key_here
SECRET_KEY=your_secret_key_here
DEBUG=True
```

### Frontend Environment (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🚦 Running the Application

### Start Backend
```bash
cd backend
source venv/bin/activate
python main.py
```
Backend will be available at: http://localhost:8000

### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend will be available at: http://localhost:3000

## 🗄️ Database Schema

### Loans Table
```sql
CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    borrower_name VARCHAR,
    co_borrower_name VARCHAR,
    address VARCHAR,
    city VARCHAR,
    state VARCHAR,
    zip_code VARCHAR,
    loan_amount DECIMAL(15,2),
    interest_rate DECIMAL(5,4),
    maturity_date DATE,
    date_of_loan DATE,
    current_upb DECIMAL(15,2),
    accrued_interest DECIMAL(15,2),
    total_balance DECIMAL(15,2),
    last_paid_date DATE,
    next_due_date DATE,
    remaining_term INTEGER,
    legal_status VARCHAR,
    lien_position VARCHAR,
    investor_name VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Documents Table
```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id),
    document_type VARCHAR,
    recording_date DATE,
    instrument_number VARCHAR,
    original_lender VARCHAR,
    assignor VARCHAR,
    assignee VARCHAR,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔌 API Endpoints

### Upload Endpoints
- `POST /api/upload/excel` - Upload Excel files
- `POST /api/upload/pdf` - Upload PDF documents

### Data Endpoints
- `GET /api/loans` - List all loans
- `GET /api/loans/{loan_id}` - Get specific loan
- `GET /api/loans/{loan_id}/documents` - Get loan documents

## 🛡️ Security Features

- File size limits (50MB max)
- CORS protection
- Request logging
- Automatic file cleanup
- Input validation
- SQL injection protection via ORM

## 🚀 Deployment

### Backend Deployment (Fly.io/Railway/Render)
1. Update environment variables in deployment platform
2. Ensure PostgreSQL database is provisioned
3. Deploy using platform-specific commands

### Frontend Deployment (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel
```

## 📁 Project Structure

```
npl-vision-2/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── models/        # Database models
│   │   └── services/      # Business logic
│   ├── main.py           # FastAPI application
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js app directory
│   │   ├── components/   # React components
│   │   └── pages/        # Page components
│   └── package.json
└── README.md
```

## 🔮 Future Enhancements (v2)

- User authentication system
- Portfolio filtering and search
- Daily batch ingestion via secure file drop
- Advanced analytics dashboard
- Automated loan performance metrics
- Export functionality
- Audit trail and compliance features

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For technical support or questions, please contact the development team.

---

Built for institutional-grade NPL data management with modern development standards.