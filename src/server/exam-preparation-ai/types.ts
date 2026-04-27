export type ExamDifficulty = 'easy' | 'medium' | 'hard';

export type ExamQuestionCount = 5 | 10 | 15;

export type ExamOptionLabel = 'A' | 'B' | 'C' | 'D';

export type ExamQuestionOptions = {
  A: string;
  B: string;
  C: string;
  D: string;
};

export type ExamPreparationQuestion = {
  id: string;
  question: string;
  options: ExamQuestionOptions;
  correctOption: ExamOptionLabel;
  explanation: string;
  concept: string;
};

export type GenerateExamSetInput = {
  subject: string;
  topic: string;
  difficulty: ExamDifficulty;
  questionCount: ExamQuestionCount;
};

export type GenerateExamSetResponse = {
  assistant: string;
  setTitle: string;
  instructions: string;
  questions: ExamPreparationQuestion[];
};

export type ImprovementTipsInput = {
  subject: string;
  topic: string;
  difficulty: ExamDifficulty;
  score: number;
  totalQuestions: number;
  weakAreas: string[];
};

export type ImprovementTipsResponse = {
  weakAreas: string[];
  improvementTips: string[];
  encouragement: string;
  nextPracticePlan: string;
};
