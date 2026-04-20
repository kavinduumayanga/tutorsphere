# TutorSphere

TutorSphere is a full-stack tutoring platform that connects students and tutors for live sessions, structured courses, resource sharing, and AI-assisted learning.

It combines a React + TypeScript frontend with an Express + MongoDB backend in one repository, with Azure Blob Storage for media uploads.

## Highlights

- Dual user roles: student and tutor
- Tutor discovery, profiles, reviews, and ratings
- Session booking and schedule management
- Course publishing, enrollment, progress, and certificates
- Resource library and downloadable study materials
- Direct messaging and in-app notifications
- OTP-based password reset via email
- AI-powered assistants (quiz, FAQ, roadmap, and learning help)

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Express, TypeScript, tsx |
| Database | MongoDB, Mongoose |
| Auth and Sessions | JWT, express-session, connect-mongo |
| Storage | Azure Blob Storage |
| Email | Nodemailer (Gmail SMTP) |
| AI | Azure OpenAI integrations + local fallback services |

## Project Structure

```text
tutorsphere/
|- server.ts
|- package.json
|- .env.example
|- src/
|  |- App.tsx
|  |- main.tsx
|  |- database.ts
|  |- models/
|  |- components/
|  |  |- common/
|  |  |- pages/
|  |- services/
|  |- server/
|  |  |- auth/
|  |  |- messages/
|  |  |- faq-chatbot/
|  |  |- quiz-chatbot/
|  |  |- ask-and-learn-ai/
|  |  |- roadmap-finder/
|  |  |- skill-assessment-ai/
|  |  |- tutorsphere-assistant/
|  |  |- storage/
|  |- utils/
|- scripts/
```

## Quick Start

### 1. Prerequisites

- Node.js 20+
- npm
- MongoDB instance
- Azure Storage account (for uploads)
- Azure OpenAI credentials (for AI features)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a .env file from .env.example, then set required values.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

At minimum, configure:

- `MONGODB_URI`
- `JWT_SECRET`
- `SESSION_SECRET`
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_BLOB_CONTAINER_PROFILE_IMAGES`
- `AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS`
- `AZURE_BLOB_CONTAINER_VIDEOS`
- `AZURE_BLOB_CONTAINER_RESOURCES`
- `AZURE_BLOB_CONTAINER_RECORDED_LESSONS`
- `AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES`

For email and AI features, also configure:

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_FROM`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

### 4. Start development server

```bash
npm run dev
```

Default app URL:

```text
http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run full stack in development (`tsx server.ts`) |
| `npm run build` | Build client and server |
| `npm run build:client` | Build frontend with Vite |
| `npm run build:server` | Compile backend TypeScript |
| `npm start` | Start compiled production server |
| `npm run preview` | Preview frontend build only |
| `npm run lint` | Type-check project |
| `npm run clean` | Remove `dist/` |
| `npm run migrate:uploads` | Migrate legacy local uploads to Azure Blob |
| `npm run migrate:uploads:dry` | Dry-run upload migration |

## Core API Areas

- `/api/auth` - authentication, profile updates, password reset
- `/api/tutors` - tutor profiles and management
- `/api/courses` - courses, coupons, enrollment flow
- `/api/resources` - resource CRUD and download tracking
- `/api/bookings` - booking lifecycle
- `/api/messages` - conversations and direct messages
- `/api/notifications` - read/unread notification state
- `/api/quiz-chatbot` and `/api/faq-chatbot` - AI endpoints

## Deployment Notes

- Build before production start:

```bash
npm run build
npm start
```

- Production should provide explicit values for security and CORS settings:
  - `JWT_SECRET`
  - `SESSION_SECRET`
  - `ALLOWED_ORIGINS`

## Troubleshooting

- Server fails at startup: verify `MONGODB_URI` and database connectivity.
- Uploads fail: verify Azure connection string and container names.
- Password reset emails fail: verify Gmail SMTP env values.
- AI endpoints fail: verify Azure OpenAI env values and deployment name.
- `npm start` fails: ensure build output exists by running `npm run build` first.

## License

No license is currently specified in this repository.
