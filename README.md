# TutorSphere

TutorSphere is a full-stack tutoring and learning platform built with React, TypeScript, Express, and MongoDB. It combines tutor discovery, session booking, course delivery, study resources, direct messaging, notifications, password-reset email flows, and AI-assisted learning tools in a single application.

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Backend Domains](#backend-domains)
- [AI Modules](#ai-modules)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Runtime Notes](#runtime-notes)
- [Troubleshooting](#troubleshooting)

## Overview

TutorSphere supports both student and tutor workflows inside one codebase.

- Students can browse tutors, enroll in courses, access learning resources, book sessions, chat with tutors, track study progress, and use AI-driven learning tools.
- Tutors can manage profiles, availability, courses, learning materials, sessions, earnings, and learner communication.
- The platform persists its core entities in MongoDB and serves uploaded assets such as avatars, thumbnails, videos, and downloadable documents from the local `uploads/` directory.

## Core Capabilities

- Role-based student and tutor experience
- Tutor directory with profiles, subjects, ratings, and reviews
- Session booking lifecycle with status and payment-related fields
- Course creation, enrollment, coupon support, progress tracking, and certificate generation
- Resource publishing and download tracking
- Direct messaging with unread counts and presence pinging
- In-app notifications
- OTP-based forgot-password and password reset flow
- Avatar, course thumbnail, course video, and resource uploads
- AI-powered quiz/skill assessment and platform assistant features

## Architecture Overview

TutorSphere runs as a single full-stack TypeScript application.

- `server.ts` is the main runtime entry point. It loads environment variables, connects to MongoDB, runs startup data migration/normalization tasks, mounts Express routes, serves uploads, and enables Vite middleware in development.
- `src/App.tsx` is the main SPA shell. It handles app state, tab navigation, and URL synchronization directly instead of using a dedicated frontend route tree.
- `src/services/apiService.ts` is the frontend API client used across the UI.
- `src/services/localService.ts` provides local/mock helper implementations for selected AI-like features and fallback behavior.
- `src/models/` contains Mongoose models for the platform's persisted domain entities.
- `src/server/` contains backend feature modules for auth, messaging, security config, and the AI assistants.
- `uploads/` stores user-generated files and is exposed through `/uploads`.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide React |
| Backend | Express, TypeScript, `tsx`, Multer, Express Session |
| Database | MongoDB, Mongoose, `connect-mongo` |
| Auth and Email | JWT utilities, OTP workflow, Nodemailer with Gmail SMTP |
| AI | Azure OpenAI-backed assistant modules plus local/mock service fallbacks |
| Documents and Media | jsPDF, file uploads for avatars, videos, thumbnails, and resources |

## Repository Structure

```text
tutorsphere/
|- server.ts                     # Main Express server and API surface
|- package.json                  # Scripts and dependencies
|- vite.config.ts                # Vite frontend configuration
|- tsconfig.json                 # Frontend TypeScript config
|- tsconfig.server.json          # Server build config
|- .env.example                  # Example environment variables
|- src/
|  |- App.tsx                    # Main SPA shell and navigation logic
|  |- main.tsx                   # React bootstrap
|  |- index.css                  # Global styles
|  |- types.ts                   # Shared frontend data contracts
|  |- database.ts                # MongoDB connection setup
|  |- components/
|  |  |- common/                 # Shared UI elements
|  |  |- pages/                  # Page-level UI modules
|  |- data/
|  |  |- mockData.ts             # Seed-like mock data used by startup migration
|  |  |- tutorSubjects.ts        # Canonical tutor subject helpers
|  |- models/                    # Mongoose schemas and persistence models
|  |- services/
|  |  |- apiService.ts           # Frontend REST client
|  |  |- localService.ts         # Local/mock learning helpers
|  |  |- geminiService.ts        # Placeholder Gemini-style mock service
|  |- server/
|  |  |- auth/                   # Password, OTP, JWT, and auth route logic
|  |  |- config/                 # Runtime security config
|  |  |- messages/               # Direct messaging API
|  |  |- faq-chatbot/            # Platform assistant router and orchestration
|  |  |- quiz-chatbot/           # Quiz chatbot compatibility layer
|  |  |- skill-assessment-ai/    # Quiz/assessment implementation
|  |  |- ask-and-learn-ai/       # General learning assistant service
|  |  |- roadmap-finder/         # Career roadmap assistant service
|  |  |- tutorsphere-assistant/  # TutorSphere platform-aware assistant
|  |- utils/
|     |- currency.ts             # Currency formatting helpers
|- uploads/                      # Runtime upload storage
|- dist/                         # Production build output
```

### Notable repository notes

- `src/context/` and `src/pages/` currently exist but are empty.
- The root also contains several one-off patch or maintenance scripts such as `patch*.cjs`, `patch*.ts`, `patch.py`, and `fix_app.js`. These do not appear to be part of the normal application runtime.
- Files such as `server_out.log` and `current_tutor_prof.txt` look like local development artifacts rather than core source files.

## Backend Domains

Most backend endpoints live directly in `server.ts`, with a few route groups split into feature modules.

| Domain | Purpose |
| --- | --- |
| `/api/auth` | Signup, login, user profile updates, avatar access, change password, forgot-password OTP flow |
| `/api/tutors` | Tutor CRUD and tutor profile management |
| `/api/reviews` | Tutor review creation and maintenance |
| `/api/courses` | Course CRUD, coupons, enrollments, and payment-aware enrollment flow |
| `/api/course-enrollments` | Enrollment listing, progress updates, and certificate download |
| `/api/resources` | Resource CRUD and download counting |
| `/api/bookings` | Session booking lifecycle management |
| `/api/questions` | Student question and answer records |
| `/api/quizzes` | Stored quiz entities |
| `/api/study-plans` | Generated study plan persistence |
| `/api/skill-levels` | Subject skill progression tracking |
| `/api/notifications` | Notification listing and read state updates |
| `/api/messages` | Conversations, direct messages, read status, delete flows, and presence ping |
| `/api/withdrawals` | Tutor withdrawal requests and earnings summary |
| `/api/uploads/*` | Thumbnail, video, and resource upload endpoints |
| `/uploads/*` | Static serving for uploaded files |

## AI Modules

TutorSphere includes several AI-oriented modules under `src/server/`.

- `skill-assessment-ai/` powers the quiz chat flow that is exposed through `/api/quiz-chatbot`.
- `faq-chatbot/` exposes `/api/faq-chatbot/chat` and routes requests into different assistant modes.
- `tutorsphere-assistant/` focuses on platform-aware answers about tutors, courses, bookings, resources, and platform usage.
- `ask-and-learn-ai/` handles broader STEM, programming, and technology learning questions.
- `roadmap-finder/` generates future-tech or IT career roadmap guidance.
- `quiz-chatbot/azureOpenAiClient.ts` provides the Azure OpenAI chat client used by the AI services.

The frontend also includes `src/services/localService.ts`, which supplies local/mock behavior for selected learning features, and `src/services/geminiService.ts`, which looks like an older placeholder mock integration.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- A MongoDB instance
- Gmail SMTP credentials if you want password-reset emails to work
- Azure OpenAI credentials if you want AI assistant features enabled

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

```bash
cp .env.example .env
```

### 3. Fill in the required values

At minimum, configure:

- `MONGODB_URI`
- `JWT_SECRET`
- `SESSION_SECRET`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_FROM`
- `OTP_EXPIRY_MINUTES`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

### 4. Start the development server

```bash
npm run dev
```

This runs `server.ts` with `tsx`. In development, the Express server attempts to attach Vite in middleware mode, so the full stack is served from one process.

### 5. Open the app

```text
http://localhost:3000
```

## Environment Variables

Use `.env.example` as the starting point.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Recommended | Runtime mode. Defaults to development-style behavior when unset. |
| `PORT` | Optional | HTTP port for the Express server. Defaults to `3000`. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes in production | JWT signing secret. Development fallback exists, but setting it explicitly is recommended. |
| `SESSION_SECRET` | Yes in production | Express session secret. Development fallback exists, but setting it explicitly is recommended. |
| `GMAIL_USER` | Required for email flow | Gmail account used for OTP email delivery. |
| `GMAIL_APP_PASSWORD` | Required for email flow | Gmail app password used by Nodemailer. |
| `EMAIL_FROM` | Required for email flow | Sender address for TutorSphere security emails. |
| `OTP_EXPIRY_MINUTES` | Optional | OTP validity window. The code clamps this between 1 and 30 minutes. |
| `PASSWORD_RESET_FRONTEND_URL` | Optional | Legacy password-reset frontend URL setting included in `.env.example`. |
| `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` | Optional | Legacy token-expiry setting included in `.env.example`. |
| `AZURE_OPENAI_ENDPOINT` | Required for AI features | Azure OpenAI endpoint. |
| `AZURE_OPENAI_API_KEY` | Required for AI features | Azure OpenAI API key. |
| `AZURE_OPENAI_DEPLOYMENT` | Required for AI features | Azure OpenAI deployment name. |
| `AZURE_OPENAI_API_VERSION` | Required for AI features | Azure OpenAI API version string. |
| `VITE_API_BASE_URL` | Optional | Frontend API override used by `src/services/apiService.ts`. |

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the full stack in development via `npx tsx server.ts`. |
| `npm run build` | Builds the frontend and compiles the server into `dist/`. |
| `npm run build:client` | Creates the production frontend bundle with Vite. |
| `npm run build:server` | Compiles the backend TypeScript with `tsc -p tsconfig.server.json`. |
| `npm start` | Runs `dist/server.js` in production mode. Build first. |
| `npm run preview` | Runs `vite preview` for the frontend build only. This is not a full backend runtime. |
| `npm run lint` | Type-checks the project with TypeScript. |
| `npm run clean` | Removes the `dist/` directory. |

## Runtime Notes

- On startup, the server runs migration and normalization helpers for legacy users, mock data, course access flags, resource download counts, and booking state fields.
- In development, sessions are stored in memory. In production, sessions are stored in MongoDB through `connect-mongo`.
- Uploaded files are stored on disk in `uploads/`, and the server exposes them under `/uploads`.
- Production mode expects a built frontend in `dist/index.html`; `npm start` will fail if the frontend has not been built yet.
- The frontend uses custom URL parsing and `window.history` synchronization inside `src/App.tsx` rather than a standard route declaration setup.

## Troubleshooting

- If the server exits on startup, check that `MONGODB_URI` is set and that MongoDB is reachable.
- If forgot-password emails fail, verify `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM`.
- If AI assistant requests fail, verify all Azure OpenAI variables and confirm the configured deployment is active.
- If `npm start` fails in production mode, run `npm run build` first.
- If uploaded assets are not loading, confirm the `uploads/` directory exists and the app has permission to write to it.
