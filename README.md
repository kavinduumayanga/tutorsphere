# TutorSphere

TutorSphere is a full-stack web platform for STEM learning and tutoring. It combines student and tutor workflows in one app: tutor discovery, bookings, courses, resources, AI-assisted learning tools, quizzes, and profile/account management.

## Table of Contents

- [Overview](#overview)
- [Web Experience](#web-experience)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Authentication and Account Security](#authentication-and-account-security)
- [API Overview](#api-overview)
- [Scripts](#scripts)
- [Build and Deployment Notes](#build-and-deployment-notes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

TutorSphere is designed as a role-based web application:

- Students can find tutors, book sessions, access courses/resources, ask questions, and take quizzes.
- Tutors can manage their profile, availability, courses, resources, and learner interactions.
- Both roles can manage account settings and secure their credentials.

## Web Experience

### Student Journey

1. Sign up or sign in.
2. Explore tutors, courses, and resources.
3. Book tutoring sessions.
4. Ask questions and use quiz/study tools.
5. Track learning progress.

### Tutor Journey

1. Sign up as a tutor.
2. Complete profile and qualifications.
3. Set availability and hourly rates.
4. Manage courses and resources.
5. Respond to learner demand and grow visibility.

### Core Web Pages

- Home
- Find Tutors
- Tutor Profile
- Booking
- Courses and Course Learning
- Resource Library
- Quizzes and Q&A
- Dashboard
- Settings / Account Management

## Key Features

- Student and tutor authentication
- Role-based access and navigation
- Tutor discovery with review support
- Session booking and booking state updates
- Course browsing, enrollment, and learning flow
- Study resource management and downloads
- Quiz and Q&A experiences
- AI chatbot integrations (Quiz + FAQ domains)
- Avatar upload and profile management
- Certificate generation for course progress

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Motion (`motion/react`)

### Backend

- Express
- TypeScript runtime via `tsx`
- Mongoose
- Multer (file uploads)
- Nodemailer (OTP email)

### Data and Tooling

- MongoDB
- TypeScript (`tsc --noEmit` for checks)

## Architecture

- `server.ts` runs the Express API and Vite middleware in development.
- Frontend code is in `src/`.
- REST endpoints are exposed under `/api/*`.
- MongoDB models live in `src/models/`.
- Auth-specific logic for OTP/password reset is in `src/server/auth/`.
- Uploaded files are stored in `uploads/`.

## Project Structure

```text
tutorsphere/
|- server.ts
|- vite.config.ts
|- package.json
|- tsconfig.json
|- .env.example
|- README.md
|- src/
|  |- App.tsx
|  |- main.tsx
|  |- index.css
|  |- types.ts
|  |- database.ts
|  |- components/
|  |  |- common/
|  |  |- pages/
|  |- models/
|  |- services/
|  |- server/
|  |  |- auth/
|  |  |- quiz-chatbot/
|  |  |- faq-chatbot/
|  |- data/
|  |- utils/
|- uploads/
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB Atlas or local MongoDB

### 1) Install dependencies

```bash
npm install
```

### 2) Create environment file

```bash
cp .env.example .env
```

### 3) Configure required values

At minimum, set:

- `MONGODB_URI`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_FROM`
- `OTP_EXPIRY_MINUTES`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

### 4) Run development server

```bash
npm run dev
```

### 5) Open the web app

- `http://localhost:3000`

## Environment Variables

Use `.env.example` as the source of truth.

### Required

- `MONGODB_URI`: MongoDB connection string
- `GMAIL_USER`: Gmail address for SMTP authentication
- `GMAIL_APP_PASSWORD`: Gmail App Password (not your normal Gmail password)
- `EMAIL_FROM`: Sender address used in OTP email
- `OTP_EXPIRY_MINUTES`: OTP expiration window (recommended `5`-`10`)
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT`: Azure OpenAI deployment name
- `AZURE_OPENAI_API_VERSION`: Azure OpenAI API version

### Common

- `NODE_ENV=development`
- `APP_NAME=TutorSphere`
- `APP_VERSION=1.0.0`

### Notes

- Server listens on `process.env.PORT` with fallback to `3000` for local runs.
- Keep secrets in `.env` only.
- Never commit `.env`.

## Authentication and Account Security

TutorSphere includes secure auth and account flows:

- Login and signup with hashed password storage
- Forgot password flow with OTP email verification
- OTP resend and expiration handling
- Password reset with token verification
- Change password from account settings
- Remember me support for 30-day persistent sessions
- Non-remembered sessions stored as browser session-only
- Sri Lankan phone normalization in settings (`+94` format)

### Password Reset Endpoints

- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/reset-password`

### Account Password Update Endpoint

- `POST /api/auth/change-password`

## API Overview

Main route groups under `/api`:

- `auth`: signup, login, profile updates, avatar, password flows
- `tutors`: tutor profile management
- `reviews`: tutor review operations
- `courses`: course CRUD + enrollments
- `resources`: resource CRUD and downloads
- `bookings`: booking lifecycle management
- `questions`: question and answer workflows
- `quizzes`: quiz operations
- `study-plans`: study plan tracking
- `skill-levels`: learner skill progression

## Scripts

- `npm run dev`: Start Express + Vite in development (`npx tsx server.ts`)
- `npm start`: Start production server for single-app deployment (`NODE_ENV=production tsx server.ts`)
- `npm run build`: Build frontend bundle with Vite
- `npm run preview`: Preview built frontend
- `npm run lint`: Type-check with TypeScript (`tsc --noEmit`)
- `npm run clean`: Remove `dist/`

## Build and Deployment Notes

### Build

```bash
npm run build
```

### Run in production mode (current setup)

```bash
npm run build && npm start
```

The production server serves static files from `dist/` and falls back to `dist/index.html` for non-API SPA routes.

### Azure App Service (Single Full-Stack App)

Use one Azure App Service for both frontend and backend:

1. Configure App Service for Node.js 20+.
2. Deploy this repository as-is (single app).
3. Ensure build runs (`npm run build`) during deployment.
4. Set startup command to `npm start` (or leave blank if App Service auto-detects `start`).
5. Add required app settings (environment variables) in Azure.

Keep `uploads/` as local filesystem storage for demo/testing only in this setup.

## Troubleshooting

- Port already in use (`EADDRINUSE`): stop the process on port `3000`, then restart.
- MongoDB connection issues: verify `MONGODB_URI` and whitelist/network access.
- OTP email issues: verify Gmail App Password and `EMAIL_FROM`.
- API route changes not reflected: restart `npm run dev` after backend edits.
- Avatar upload failures: ensure image is PNG/JPEG and within size limits.

## Contributing

1. Create a feature branch.
2. Make focused, testable changes.
3. Run checks (`npm run lint`).
4. Open a pull request.

## License

This project is licensed under the MIT License.
