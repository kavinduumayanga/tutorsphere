TutorSphere
===========

TutorSphere is a comprehensive STEM education platform built with React and TypeScript. This is a fully local web application that provides tutoring services, Q&A support, courses, and quizzes without requiring any external AI services or dependencies.

## Features

- **Find Tutors**: Browse and book sessions with verified STEM tutors
- **Q&A Support**: Ask questions and get answers from subject matter experts
- **Courses**: Enroll in structured learning paths
- **Quizzes**: Take assessments to test your knowledge
- **Study Plans**: Get personalized learning schedules
- **Local Operation**: Runs completely offline without external dependencies

## Folder Structure

```
├── index.html           # Main HTML file
├── metadata.json        # Project metadata
├── package.json         # Node.js dependencies and scripts
├── README.md            # Project documentation
├── server.ts            # Express server with API endpoints
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
└── src/
    ├── App.tsx          # Main React application
    ├── index.css        # Global styles with Tailwind CSS
    ├── main.tsx         # React app entry point
    ├── types.ts         # TypeScript type definitions
    └── services/
        └── localService.ts   # Local service (no external AI)
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)

### Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`.

### Build for Production

To build the app for production, run:

```bash
npm run build
npm run preview
```

## Architecture

- **Frontend**: React 19 with TypeScript, styled with Tailwind CSS
- **Backend**: Express.js server with REST API
- **Build Tool**: Vite for fast development and optimized builds
- **State Management**: React hooks for local state
- **Data Storage**: In-memory storage (can be extended to use local databases)

## API Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User authentication

## Local Features

All AI-powered features now work locally with mock data:
- Q&A responses based on predefined knowledge base
- Quiz generation with curated questions
- Study plan creation based on skill levels
- Tutor validation using rule-based logic
- Chatbot responses using pattern matching

## Development

The project uses modern development practices:
- TypeScript for type safety
- ESLint for code quality
- Hot module replacement during development
- Responsive design with Tailwind CSS
```

## Project Structure Overview

- **index.html**: The main HTML file loaded by Vite.
- **server.ts**: Entry point for the backend server (if used).
- **src/**: Contains all frontend source code.
  - **App.tsx**: Main React component.
  - **main.tsx**: Entry point for rendering the React app.
  - **index.css**: Global CSS styles.
  - **types.ts**: Shared TypeScript types.
  - **services/**: Contains service modules for API calls and business logic.

## Contributing

Feel free to fork this repository and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License.
