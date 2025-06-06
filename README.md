# NPL Vision 2 - Data Extraction Platform

A powerful, intelligent data extraction tool for managing portfolios of non-performing loans.

## Project Overview

NPL Vision 2 is designed to streamline the process of extracting and managing loan data from Excel files and PDF documents. The platform uses intelligent column mapping, OpenAI-powered PDF extraction, and comprehensive data validation to ensure accurate data capture.

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **AI/ML**: OpenAI API for PDF extraction
- **Deployment**: Vercel (Frontend), Render (Backend)

## Features

- **Multi-file Upload**: Support for Excel (.xlsx, .xls) and PDF files
- **Intelligent Column Mapping**: Automatic detection of column headers with fuzzy matching
- **PDF Processing**: OpenAI-powered extraction from mortgage documents, assignments, and other loan-related PDFs
- **Data Validation**: Comprehensive validation with business rule checking
- **Duplicate Detection**: Prevent data pollution with intelligent duplicate detection
- **Editable Preview**: Review and edit extracted data before saving
- **Audit Trail**: Complete extraction logs for compliance and troubleshooting

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mbzesq/npl-vision-2.git
cd npl-vision-2
```

2. Install dependencies:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

3. Set up environment variables:
```bash
# Backend (.env)
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://...
SECRET_KEY=your_secret_key
NODE_ENV=development
PORT=5000

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000
```

4. Run the development servers:
```bash
# Frontend (in frontend directory)
npm run dev

# Backend (in backend directory)
npm run dev
```

## Deployment

The project uses GitHub Actions for CI/CD:
- Frontend deploys automatically to Vercel on push to main
- Backend deploys automatically to Render on push to main

## Contributing

1. Create a feature branch from main
2. Make your changes
3. Submit a pull request

## License

Proprietary - All rights reserved