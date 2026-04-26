# Community Resource Finder (SESMag)

Backend API for the CPS 3500 Community Resource Finder project.

## Quick Start

1. Copy `backend/.env.example` to `backend/.env` and fill your values.
2. Install dependencies:
   - `cd backend`
   - `npm install`
3. Create database schema and default categories:
   - `npm run init-db`
4. Seed resources from Google Places:
   - `npm run seed`
5. Start API:
   - `npm run dev`

## Google Setup Checklist

- **Google Places API**
  - Enable *Places API* in Google Cloud.
  - Create API key and assign it to `GOOGLE_PLACES_API_KEY`.
  - If key restrictions are enabled, allow Places API and your dev IP/app.

- **Google OAuth**
  - Create OAuth 2.0 credentials (Web application).
  - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

- **Gmail API**
  - Enable *Gmail API* in the same Google Cloud project.
  - Generate OAuth refresh token for the sender account.
  - Set `GMAIL_REFRESH_TOKEN` and `GMAIL_SENDER_EMAIL`.

## API Routes Implemented

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `GET /api/categories`
- `GET /api/resources/search`
- `GET /api/resources/:id`
- `GET /api/saved` (auth required)
- `POST /api/saved` (auth required)
- `DELETE /api/saved/:resourceId` (auth required)
- `GET /api/admin/resources` (admin required)
- `POST /api/admin/resources` (admin required)
- `PATCH /api/admin/resources/:id` (admin required)
- `GET /api/admin/resources/:id/audit-log` (admin required)
