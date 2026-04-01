import {
  QUIZ_INVALID_OPTION_PROMPT,
  QUIZ_OPENING_PROMPT,
  QUIZ_RESTART_PROMPT,
  QUIZ_SESSION_END_MESSAGE,
  QUIZ_SYSTEM_PROMPT,
  QUIZ_TOPIC_PROMPT,
} from './promptRules.js';
import { azureOpenAiClient } from './azureOpenAiClient.js';
import {
  QuizAnswerOption,
  QuizChatResult,
  QuizChatUserRole,
  QuizQuestion,
  QuizScoreSummary,
  QuizSessionState,
  StructuredSummaryResponse,
} from './types.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 80;

const GREETING_PATTERN = /^(hi|hello|hey|yo|hola|good\s+(morning|afternoon|evening)|hii+|heyy+)[!,.\s]*$/i;
const AFFIRMATIVE_PATTERN = /^(yes|y|yeah|yep|sure|ok|okay|please|another|go\s+ahead)(\b|[^a-z])/i;
const NEGATIVE_PATTERN = /^(no|n|nope|nah|not\s+now|no\s+thanks?|thanks|thank\s+you|i'?m\s+done|done|exit|stop|quit)(\b|[^a-z])/i;
const END_SESSION_PATTERN = new RegExp(QUIZ_RESTART_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const ANSWER_PATTERN = /^[abcd]$/i;

type InitialQuestionModel = {
  question: string;
  options: Record<string, string>;
  correctOption: string;
  concept: string;
  difficulty: string;
  explanation: string;
};

type InitialQuestionResponse = {
  questions: InitialQuestionModel[];
};

type FinalSummaryModel = {
  weakAreas: string[];
  studyPlan: Array<{ day: string; focus: string }>;
  resources: Array<{ title: string; url: string; source: string }>;
};

type AdaptiveQuestionResponse = {
  question: InitialQuestionModel;
};

const toQuestionId = () => Math.random().toString(36).slice(2, 11);

const sanitizeText = (value: unknown, fallback = ''): string => {
  const asText = String(value ?? '').trim();
  return asText || fallback;
};

const cleanJsonPayload = (raw: string): string => {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  return trimmed;
};

const getScoreSummary = (score: number): QuizScoreSummary => {
  if (score <= 1) {
    return { score, total: 5, level: 'Beginner' };
  }
  if (score <= 3) {
    return { score, total: 5, level: 'Intermediate' };
  }
  return { score, total: 5, level: 'Advanced' };
};

const isGreeting = (input: string): boolean => GREETING_PATTERN.test(input.trim());

const isAnswerOption = (input: string): input is QuizAnswerOption => ANSWER_PATTERN.test(input.trim());

const normalizeAnswer = (input: string): QuizAnswerOption => input.trim().toUpperCase() as QuizAnswerOption;

const normalizeOptions = (options: Record<string, string>): Record<QuizAnswerOption, string> => {
  return {
    A: sanitizeText(options?.A),
    B: sanitizeText(options?.B),
    C: sanitizeText(options?.C),
    D: sanitizeText(options?.D),
  };
};

const normalizeQuestion = (
  question: InitialQuestionModel,
  fallbackDifficulty: string,
  fallbackConcept: string
): QuizQuestion => {
  const options = normalizeOptions(question.options || {});
  const providedCorrect = sanitizeText(question.correctOption, 'A').toUpperCase();
  const correctOption = (['A', 'B', 'C', 'D'].includes(providedCorrect)
    ? providedCorrect
    : 'A') as QuizAnswerOption;

  return {
    id: toQuestionId(),
    question: sanitizeText(question.question, 'Question unavailable.'),
    options,
    correctOption,
    concept: sanitizeText(question.concept, fallbackConcept),
    difficulty: sanitizeText(question.difficulty, fallbackDifficulty),
    explanation: sanitizeText(
      question.explanation,
      'Review the key concept and compare your choice with the correct method.'
    ),
  };
};

const formatQuestion = (question: QuizQuestion, questionNumber: number): string => {
  return [
    `Question ${questionNumber}/5 (${question.difficulty})`,
    question.question,
    `A. ${question.options.A}`,
    `B. ${question.options.B}`,
    `C. ${question.options.C}`,
    `D. ${question.options.D}`,
    'Answer with A, B, C, or D.',
  ].join('\n');
};

const isLikelyValidUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const defaultResourceFallback = (
  subject: string,
  topic: string
): Array<{ title: string; url: string; source: string }> => [
  {
    title: `${subject} ${topic} - Khan Academy`,
    url: 'https://www.khanacademy.org/',
    source: 'Khan Academy',
  },
  {
    title: `${subject} fundamentals - freeCodeCamp`,
    url: 'https://www.freecodecamp.org/learn/',
    source: 'freeCodeCamp',
  },
  {
    title: `${subject} documentation - Microsoft Learn`,
    url: 'https://learn.microsoft.com/',
    source: 'Microsoft Learn',
  },
  {
    title: `${subject} references - MDN`,
    url: 'https://developer.mozilla.org/',
    source: 'MDN',
  },
];

export class QuizSessionManager {
  private readonly sessions = new Map<string, QuizSessionState>();

  resetSession(userId: string): QuizChatResult {
    this.sessions.delete(userId);
    return {
      reply: QUIZ_OPENING_PROMPT,
      stage: 'awaitingSubject',
      sessionEnded: false,
    };
  }

  async handleMessage(
    userId: string,
    userRole: QuizChatUserRole,
    message: string
  ): Promise<QuizChatResult> {
    this.pruneExpiredSessions();

    const input = String(message || '').trim();
    const state = this.getOrCreateSession(userId, userRole);

    this.appendHistory(state, 'user', input);

    if (!input && state.stage === 'awaitingSubject') {
      return this.finalizeReply(state, QUIZ_OPENING_PROMPT);
    }

    if (state.stage === 'closed') {
      return this.finalizeReply(state, QUIZ_SESSION_END_MESSAGE, true);
    }

    if (state.stage === 'awaitingSubject') {
      return this.handleSubjectStage(state, input);
    }

    if (state.stage === 'awaitingTopic') {
      return this.handleTopicStage(state, input);
    }

    if (state.stage === 'quiz') {
      return this.handleQuizStage(state, input);
    }

    return this.handleRestartStage(state, input);
  }

  private getOrCreateSession(userId: string, userRole: QuizChatUserRole): QuizSessionState {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.updatedAt = Date.now();
      return existing;
    }

    const state: QuizSessionState = {
      userId,
      userRole,
      stage: 'awaitingSubject',
      questions: [],
      currentQuestionIndex: 0,
      attempts: [],
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(userId, state);
    return state;
  }

  private appendHistory(
    state: QuizSessionState,
    role: 'user' | 'assistant',
    content: string
  ): void {
    state.history.push({
      role,
      content,
      timestamp: Date.now(),
    });

    if (state.history.length > MAX_HISTORY_ITEMS) {
      state.history.splice(0, state.history.length - MAX_HISTORY_ITEMS);
    }

    state.updatedAt = Date.now();
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private finalizeReply(
    state: QuizSessionState,
    reply: string,
    sessionEnded = false
  ): QuizChatResult {
    this.appendHistory(state, 'assistant', reply);
    return {
      reply,
      stage: state.stage,
      sessionEnded,
    };
  }

  private async handleSubjectStage(
    state: QuizSessionState,
    input: string
  ): Promise<QuizChatResult> {
    if (!input || isGreeting(input)) {
      return this.finalizeReply(state, QUIZ_OPENING_PROMPT);
    }

    state.subject = input;
    state.stage = 'awaitingTopic';

    return this.finalizeReply(state, QUIZ_TOPIC_PROMPT);
  }

  private async handleTopicStage(
    state: QuizSessionState,
    input: string
  ): Promise<QuizChatResult> {
    if (!input || isGreeting(input)) {
      return this.finalizeReply(state, QUIZ_TOPIC_PROMPT);
    }

    state.topic = input;
    state.currentQuestionIndex = 0;
    state.attempts = [];

    const questions = await this.generateInitialQuestions(state.subject || 'General', state.topic);
    state.questions = questions;
    state.stage = 'quiz';

    const firstQuestion = formatQuestion(state.questions[0], 1);
    const response = [`Great. Let's begin the diagnostic for ${state.subject} (${state.topic}).`, firstQuestion].join(
      '\n\n'
    );

    return this.finalizeReply(state, response);
  }

  private async handleQuizStage(
    state: QuizSessionState,
    input: string
  ): Promise<QuizChatResult> {
    const currentQuestion = state.questions[state.currentQuestionIndex];

    if (!currentQuestion) {
      state.stage = 'awaitingSubject';
      state.questions = [];
      state.currentQuestionIndex = 0;
      state.attempts = [];
      state.subject = undefined;
      state.topic = undefined;
      return this.finalizeReply(state, QUIZ_OPENING_PROMPT);
    }

    if (!isAnswerOption(input)) {
      const repeatedQuestion = formatQuestion(currentQuestion, state.currentQuestionIndex + 1);
      return this.finalizeReply(
        state,
        `${QUIZ_INVALID_OPTION_PROMPT}\n\n${repeatedQuestion}`
      );
    }

    const normalizedAnswer = normalizeAnswer(input);
    const isCorrect = normalizedAnswer === currentQuestion.correctOption;
    const statusLine = isCorrect ? '✅ Correct' : '❌ Incorrect';

    state.attempts.push({
      questionId: currentQuestion.id,
      questionNumber: state.currentQuestionIndex + 1,
      selectedOption: normalizedAnswer,
      correctOption: currentQuestion.correctOption,
      isCorrect,
      concept: currentQuestion.concept,
    });

    if (state.currentQuestionIndex === 3 && state.questions.length === 4) {
      const adaptiveQuestion = await this.generateAdaptiveQuestion(
        state.subject || 'General',
        state.topic || 'General',
        state.attempts
      );
      state.questions.push(adaptiveQuestion);
    }

    if (state.currentQuestionIndex >= 4) {
      const score = state.attempts.filter((attempt) => attempt.isCorrect).length;
      const scoreSummary = getScoreSummary(score);
      const summary = await this.generateFinalSummary(state, scoreSummary);
      state.stage = 'awaitingRestart';

      const finalReply = [
        statusLine,
        currentQuestion.explanation,
        '',
        summary,
        '',
        QUIZ_RESTART_PROMPT,
      ].join('\n');

      return this.finalizeReply(state, finalReply);
    }

    state.currentQuestionIndex += 1;
    const nextQuestion = state.questions[state.currentQuestionIndex];
    const nextQuestionText = formatQuestion(nextQuestion, state.currentQuestionIndex + 1);

    const reply = [statusLine, currentQuestion.explanation, '', nextQuestionText].join('\n');

    return this.finalizeReply(state, reply);
  }

  private async handleRestartStage(
    state: QuizSessionState,
    input: string
  ): Promise<QuizChatResult> {
    const normalized = input.trim();
    const loweredInput = normalized.toLowerCase();

    if (END_SESSION_PATTERN.test(normalized) || NEGATIVE_PATTERN.test(loweredInput)) {
      state.stage = 'closed';
      return this.finalizeReply(state, QUIZ_SESSION_END_MESSAGE, true);
    }

    const extractedSubject = this.extractSubjectFromRestartInput(normalized);

    if (extractedSubject) {
      this.resetQuizProgress(state);
      state.subject = extractedSubject;
      state.stage = 'awaitingTopic';
      return this.finalizeReply(state, QUIZ_TOPIC_PROMPT);
    }

    if (AFFIRMATIVE_PATTERN.test(loweredInput)) {
      this.resetQuizProgress(state);
      state.stage = 'awaitingSubject';
      return this.finalizeReply(state, QUIZ_OPENING_PROMPT);
    }

    this.resetQuizProgress(state);
    state.subject = normalized;
    state.stage = 'awaitingTopic';
    return this.finalizeReply(state, QUIZ_TOPIC_PROMPT);
  }

  private resetQuizProgress(state: QuizSessionState): void {
    state.questions = [];
    state.attempts = [];
    state.currentQuestionIndex = 0;
    state.topic = undefined;
    state.subject = undefined;
  }

  private extractSubjectFromRestartInput(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    const lower = trimmed.toLowerCase();
    if (NEGATIVE_PATTERN.test(lower)) {
      return null;
    }

    if (AFFIRMATIVE_PATTERN.test(lower) && lower.split(/\s+/).length <= 2) {
      return null;
    }

    const cleaned = trimmed
      .replace(/^(yes|yeah|yep|sure|another\s+one|another\s+subject)\s*/i, '')
      .replace(/^(subject\s*[:\-]?\s*)/i, '')
      .replace(/^(i\s*am\s*weak\s*in\s*)/i, '')
      .trim();

    return cleaned || null;
  }

  private async generateInitialQuestions(subject: string, topic: string): Promise<QuizQuestion[]> {
    const modelResponse = await this.requestJson<InitialQuestionResponse>(
      [
        {
          role: 'system',
          content: QUIZ_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Generate exactly 4 diagnostic questions for subject "${subject}" and topic "${topic}".
Return JSON only with this schema:
{
  "questions": [
    {
      "question": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctOption": "A|B|C|D",
      "concept": "...",
      "difficulty": "easy|easy/medium|medium|medium/hard",
      "explanation": "1-2 sentence explanation"
    }
  ]
}
Rules:
- Output exactly 4 questions.
- Question 1 difficulty easy.
- Question 2 difficulty easy/medium.
- Question 3 difficulty medium.
- Question 4 difficulty medium/hard.
- Questions must be academically valid and concise.
- No markdown or extra text, JSON only.`,
        },
      ],
      { maxTokens: 1400 }
    );

    const incoming = Array.isArray(modelResponse.questions) ? modelResponse.questions : [];
    if (incoming.length !== 4) {
      throw new Error('Model did not return exactly 4 initial questions.');
    }

    const fallbackDifficulties = ['easy', 'easy/medium', 'medium', 'medium/hard'];
    return incoming.map((question, index) =>
      normalizeQuestion(question, fallbackDifficulties[index], `${topic} fundamentals`)
    );
  }

  private async generateAdaptiveQuestion(
    subject: string,
    topic: string,
    attempts: Array<{ concept: string; isCorrect: boolean; questionNumber: number; selectedOption: string; correctOption: string }>
  ): Promise<QuizQuestion> {
    const weakestConcept = this.deriveWeakestConcept(attempts) || topic;

    const modelResponse = await this.requestJson<AdaptiveQuestionResponse>(
      [
        {
          role: 'system',
          content: QUIZ_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Create question 5 for a diagnostic quiz.
Subject: "${subject}"
Topic: "${topic}"
Target weakest concept: "${weakestConcept}"
Prior attempts summary: ${JSON.stringify(attempts)}

Return JSON only:
{
  "question": {
    "question": "...",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correctOption": "A|B|C|D",
    "concept": "...",
    "difficulty": "targeted",
    "explanation": "1-2 sentence explanation"
  }
}
Rules:
- Exactly one question.
- Must target the weakest concept inferred from prior answers.
- Must still be concise, multiple choice, and answerable.
- JSON only.`,
        },
      ],
      { maxTokens: 700 }
    );

    return normalizeQuestion(
      modelResponse.question,
      'targeted',
      weakestConcept || `${topic} mastery`
    );
  }

  private async generateFinalSummary(
    state: QuizSessionState,
    scoreSummary: QuizScoreSummary
  ): Promise<string> {
    const finalSummary = await this.requestJson<FinalSummaryModel>(
      [
        {
          role: 'system',
          content: QUIZ_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Create final diagnostic summary.
Subject: "${state.subject || 'General'}"
Topic: "${state.topic || 'General'}"
Score: ${scoreSummary.score}/5
Level: ${scoreSummary.level}
Attempts: ${JSON.stringify(state.attempts)}

Return JSON only:
{
  "weakAreas": ["..."],
  "studyPlan": [
    { "day": "Day 1", "focus": "..." }
  ],
  "resources": [
    { "title": "...", "url": "https://...", "source": "..." }
  ]
}
Rules:
- weakAreas: 3 to 5 concise items.
- studyPlan: exactly 7 entries (Day 1 ... Day 7).
- resources: 3 to 6 entries.
- Prefer trusted sources including W3Schools, MDN, Microsoft Learn, freeCodeCamp, Khan Academy, and strong YouTube channels when relevant.
- JSON only.`,
        },
      ],
      { maxTokens: 1400 }
    );

    const structured = this.normalizeFinalSummary(finalSummary, state.subject || 'General', state.topic || 'General');

    return this.formatFinalSummary(
      state.subject || 'General',
      state.topic || 'General',
      scoreSummary,
      structured
    );
  }

  private normalizeFinalSummary(
    payload: FinalSummaryModel,
    subject: string,
    topic: string
  ): StructuredSummaryResponse {
    const weakAreas = (Array.isArray(payload.weakAreas) ? payload.weakAreas : [])
      .map((item) => sanitizeText(item))
      .filter(Boolean)
      .slice(0, 5);

    const normalizedWeakAreas = weakAreas.length >= 3
      ? weakAreas
      : [
          ...weakAreas,
          `${topic} core principles`,
          `${subject} problem-solving accuracy`,
          'Reasoning under timed questions',
        ].slice(0, 3);

    const rawPlan = Array.isArray(payload.studyPlan) ? payload.studyPlan : [];
    const studyPlan = Array.from({ length: 7 }).map((_, index) => {
      const fallbackDay = `Day ${index + 1}`;
      const planned = rawPlan[index];
      return {
        day: sanitizeText(planned?.day, fallbackDay),
        focus: sanitizeText(
          planned?.focus,
          `${topic} focused practice and review block ${index + 1}`
        ),
      };
    });

    const resources = (Array.isArray(payload.resources) ? payload.resources : [])
      .map((resource) => ({
        title: sanitizeText(resource?.title),
        url: sanitizeText(resource?.url),
        source: sanitizeText(resource?.source),
      }))
      .filter((resource) => resource.title && resource.source && isLikelyValidUrl(resource.url))
      .slice(0, 6);

    const normalizedResources = resources.length >= 3
      ? resources
      : defaultResourceFallback(subject, topic).slice(0, 6);

    return {
      weakAreas: normalizedWeakAreas,
      studyPlan,
      resources: normalizedResources,
    };
  }

  private formatFinalSummary(
    subject: string,
    topic: string,
    scoreSummary: QuizScoreSummary,
    summary: StructuredSummaryResponse
  ): string {
    const scoreBlock = [
      '1) Score Summary',
      `- Subject: ${subject}`,
      `- Topic: ${topic}`,
      `- Score: ${scoreSummary.score}/${scoreSummary.total}`,
      `- Level: ${scoreSummary.level}`,
    ].join('\n');

    const weakAreaBlock = [
      '2) Weak Areas',
      ...summary.weakAreas.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n');

    const studyPlanBlock = [
      '3) 7-Day Study Plan',
      ...summary.studyPlan.map((entry) => `${entry.day}: ${entry.focus}`),
    ].join('\n');

    const resourcesBlock = [
      '4) Trusted Study Resources',
      ...summary.resources
        .slice(0, 6)
        .map((resource, index) => `${index + 1}. ${resource.title} (${resource.source}) - ${resource.url}`),
    ].join('\n');

    return [scoreBlock, weakAreaBlock, studyPlanBlock, resourcesBlock].join('\n\n');
  }

  private deriveWeakestConcept(
    attempts: Array<{ concept: string; isCorrect: boolean }>
  ): string | null {
    if (!attempts.length) {
      return null;
    }

    const conceptScores = new Map<string, { wrong: number; total: number }>();

    for (const attempt of attempts) {
      const key = sanitizeText(attempt.concept, 'core concept');
      const current = conceptScores.get(key) || { wrong: 0, total: 0 };
      conceptScores.set(key, {
        wrong: current.wrong + (attempt.isCorrect ? 0 : 1),
        total: current.total + 1,
      });
    }

    let selectedConcept: string | null = null;
    let maxWrongRatio = -1;

    for (const [concept, score] of conceptScores.entries()) {
      const wrongRatio = score.total ? score.wrong / score.total : 0;
      if (wrongRatio > maxWrongRatio) {
        maxWrongRatio = wrongRatio;
        selectedConcept = concept;
      }
    }

    return selectedConcept;
  }

  private async requestJson<T>(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    options: { maxTokens?: number } = {}
  ): Promise<T> {
    const raw = await azureOpenAiClient.chat(messages, {
      temperature: 0.3,
      maxTokens: options.maxTokens ?? 900,
      jsonResponse: true,
    });

    const cleaned = cleanJsonPayload(raw);

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse model JSON response: ${(error as Error).message}`
      );
    }
  }
}
