# Deploy to Render Instructions

## Backend Web Service Settings

**Repository:** mbzesq/npl-vision-2
**Build Command:** cd backend && npm install
**Start Command:** cd backend && npm start

## Environment Variables

```
OPENAI_API_KEY = [YOUR_OPENAI_API_KEY]
DATABASE_URL = [YOUR_RENDER_POSTGRESQL_URL]
NODE_ENV = production
PORT = 5000
SECRET_KEY = npl-vision-secure-key-2024-production
CORS_ORIGIN = *
MAX_FILE_SIZE = 52428800
```

## Database Migration

After deployment, run in Shell:
```bash
cd backend && npm run migrate
```

## Vercel Frontend

**Repository:** mbzesq/npl-vision-2
**Root Directory:** frontend

**Environment Variables:**
```
NEXT_PUBLIC_API_URL = https://your-backend.onrender.com
NEXT_PUBLIC_APP_NAME = NPL Vision
```