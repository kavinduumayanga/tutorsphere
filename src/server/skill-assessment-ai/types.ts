export type QuizChatUserRole = 'student' | 'tutor';

export type QuizAnswerOption = 'A' | 'B' | 'C' | 'D';

export type QuizSessionStage =
  | 'awaitingSubject'
  | 'awaitingTopic'
  | 'quiz'
  | 'awaitingRestart'
  | 'closed';

export type ChatHistoryRole = 'user' | 'assistant';

export interface QuizQuestion {
  id: string;
  question: string;
  options: Record<QuizAnswerOption, string>;
  correctOption: QuizAnswerOption;
  concept: string;
  difficulty: string;
  explanation: string;
}

export interface QuizAttempt {
  questionId: string;
  questionNumber: number;
  selectedOption: QuizAnswerOption;
  correctOption: QuizAnswerOption;
  isCorrect: boolean;
  concept: string;
}

export interface QuizHistoryItem {
  role: ChatHistoryRole;
  content: string;
  timestamp: number;
}

export interface QuizSessionState {
  userId: string;
  userRole: QuizChatUserRole;
  stage: QuizSessionStage;
  subject?: string;
  topic?: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  attempts: QuizAttempt[];
  history: QuizHistoryItem[];
  createdAt: number;
  updatedAt: number;
}

export interface QuizChatResult {
  reply: string;
  stage: QuizSessionStage;
  sessionEnded: boolean;
}

export interface QuizScoreSummary {
  score: number;
  total: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface StructuredSummaryResponse {
  weakAreas: string[];
  studyPlan: Array<{ day: string; focus: string }>;
  resources: Array<{ title: string; url: string; source: string }>;
}
