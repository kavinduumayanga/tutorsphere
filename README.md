# TutorSphere

TutorSphere is a full-stack STEM tutoring platform built with React, TypeScript, Vite, Express, and MongoDB.

It includes role-based experiences for students and tutors, tutor discovery, bookings, courses, resources, quizzes, and profile management with avatar upload support.

## Highlights

- Student and tutor authentication
- Role-based navigation and access control
- Tutor discovery and session booking
- Course enrollment and learning resources
- Q&A and quiz workflows
- Study plans and skill progression tracking
- Profile settings with avatar upload and replacement
- REST API backed by MongoDB models

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Motion
- Backend: Express, TypeScript (tsx runtime), Multer, CORS
- Database: MongoDB with Mongoose
- Tooling: TypeScript, Vite build pipeline

## Project Structure

```text
tutorsphere/
|- server.ts
|- vite.config.ts
|- package.json
|- .env.example
|- src/
|  |- App.tsx
|  |- main.tsx
|  |- index.css
|  |- types.ts
|  |- database.ts
|  |- models/
|  |- services/
|  |- components/
|  |- data/
|- uploads/
```

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB database (Atlas or local)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Update `MONGODB_URI` in `.env` with your database connection string.

4. Start development server:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Environment Variables

Use `.env.example` as a template.

Required:

- `MONGODB_URI`: MongoDB connection string
- `GMAIL_USER`: Gmail address used for SMTP authentication
- `GMAIL_APP_PASSWORD`: Gmail App Password used for SMTP (not your normal Gmail password)
- `EMAIL_FROM`: Sender email address shown in OTP emails
- `OTP_EXPIRY_MINUTES`: OTP validity window in minutes (recommended: `5` to `10`)
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI resource endpoint
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT`: Azure OpenAI chat deployment name
- `AZURE_OPENAI_API_VERSION`: Azure OpenAI API version for chat completions

Common:

- `NODE_ENV=development`
- `APP_NAME=TutorSphere`
- `APP_VERSION=1.0.0`

Notes:

- Port is currently fixed to `3000` in server and Vite config.
- Keep secrets in `.env` only. Do not commit `.env`.

## Available Scripts

- `npm run dev`: Run Express + Vite middleware in development
- `npm run build`: Build frontend for production
- `npm run preview`: Preview built frontend
- `npm run lint`: Type-check project (`tsc --noEmit`)
- `npm run clean`: Remove `dist/`

## API Overview

Core groups exposed under `/api`:

- `auth`: signup, login, profile update, avatar retrieval
- `auth`: signup, login, profile update, avatar retrieval, forgot-password OTP flow
	- `POST /api/auth/forgot-password`
	- `POST /api/auth/resend-otp`
	- `POST /api/auth/verify-otp`
	- `POST /api/auth/reset-password`
- `tutors`: CRUD for tutor profiles
- `reviews`: CRUD for tutor reviews
- `courses`: CRUD and enroll endpoints
- `resources`: CRUD for study resources
- `bookings`: CRUD for session bookings
- `questions`: CRUD for student questions
- `quizzes`: CRUD for quizzes
- `study-plans`: CRUD for generated plans
- `skill-levels`: CRUD for student skill levels

## Build and Production

1. Build app:

```bash
npm run build
```

2. Run with production environment:

```bash
NODE_ENV=production npm run dev
```

This project currently uses `server.ts` as the runtime entrypoint for both development and server-side API handling.

## Troubleshooting

- `EADDRINUSE` on port `3000`: stop existing process using that port, then restart.
- MongoDB connection errors: verify `MONGODB_URI` and network/IP whitelist.
- Avatar upload issues: confirm file is PNG/JPEG and under 5MB.

## Contributing

1. Create a feature branch
2. Make focused changes
3. Run type checks and build
4. Open a pull request

## License

This project is licensed under the MIT License.
