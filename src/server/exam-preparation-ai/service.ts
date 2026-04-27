import { sanitizeUserInput } from '../faq-chatbot/security.js';
import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  EXAM_PREPARATION_ASSISTANT_NAME,
  EXAM_PREPARATION_IMPROVEMENT_PROMPT,
  EXAM_PREPARATION_QUESTION_SET_PROMPT,
  EXAM_PREPARATION_SYSTEM_PROMPT,
} from './promptRules.js';
import {
  type ExamOptionLabel,
  type ExamPreparationQuestion,
  type GenerateExamSetInput,
  type GenerateExamSetResponse,
  type ImprovementTipsInput,
  type ImprovementTipsResponse,
} from './types.js';

const toSafeText = (value: unknown, fallback: string, maxLength = 180): string => {
  const normalized = sanitizeUserInput(String(value ?? '')).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
};

const tryParseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall back to extraction attempts.
  }

  return null;
};

const extractJsonObject = (rawReply: string): Record<string, unknown> => {
  const direct = tryParseJsonObject(rawReply);
  if (direct) {
    return direct;
  }

  const fenced = rawReply.match(/```json\s*([\s\S]*?)```/i) || rawReply.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParseJsonObject(fenced[1]);
    if (fromFence) {
      return fromFence;
    }
  }

  const startIndex = rawReply.indexOf('{');
  const endIndex = rawReply.lastIndexOf('}');
  if (startIndex >= 0 && endIndex > startIndex) {
    const candidate = rawReply.slice(startIndex, endIndex + 1);
    const extracted = tryParseJsonObject(candidate);
    if (extracted) {
      return extracted;
    }
  }

  throw new Error('Exam Preparation AI returned invalid JSON content.');
};

const normalizeOptionLabel = (value: unknown): ExamOptionLabel => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'A' || normalized === 'B' || normalized === 'C' || normalized === 'D') {
    return normalized;
  }

  return 'A';
};

const normalizeOptions = (value: unknown): ExamPreparationQuestion['options'] | null => {
  if (Array.isArray(value)) {
    if (value.length < 4) {
      return null;
    }

    return {
      A: toSafeText(value[0], 'Option A', 220),
      B: toSafeText(value[1], 'Option B', 220),
      C: toSafeText(value[2], 'Option C', 220),
      D: toSafeText(value[3], 'Option D', 220),
    };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const optionObject = value as Record<string, unknown>;
  return {
    A: toSafeText(optionObject.A, 'Option A', 220),
    B: toSafeText(optionObject.B, 'Option B', 220),
    C: toSafeText(optionObject.C, 'Option C', 220),
    D: toSafeText(optionObject.D, 'Option D', 220),
  };
};

const normalizeQuestion = (value: unknown, index: number): ExamPreparationQuestion | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const question = toSafeText(raw.question, '', 320);
  if (!question) {
    return null;
  }

  const options = normalizeOptions(raw.options);
  if (!options) {
    return null;
  }

  const correctOption = normalizeOptionLabel(raw.correctOption);
  const explanation = toSafeText(raw.explanation, 'Review the underlying concept and retry a similar question.', 380);
  const concept = toSafeText(raw.concept, 'Core Concept', 120);

  return {
    id: `question-${index + 1}`,
    question,
    options,
    correctOption,
    explanation,
    concept,
  };
};

const normalizeWeakAreas = (weakAreas: string[]): string[] => {
  const uniqueWeakAreas = new Set<string>();

  for (const weakArea of weakAreas) {
    const normalized = toSafeText(weakArea, '', 90);
    if (normalized) {
      uniqueWeakAreas.add(normalized);
    }
  }

  return Array.from(uniqueWeakAreas).slice(0, 8);
};

const buildFallbackTips = (weakAreas: string[]): string[] => {
  if (weakAreas.length === 0) {
    return [
      'Increase challenge gradually by practicing mixed medium and hard questions.',
      'Review every explanation and write one key takeaway after each question.',
      'Do a timed mini-test to improve both speed and accuracy.',
    ];
  }

  return weakAreas.map((area) => `Revise ${area} with a short summary note, then solve 5 focused MCQs on that area.`);
};

export class ExamPreparationAiService {
  async generateQuestionSet(
    input: GenerateExamSetInput
  ): Promise<GenerateExamSetResponse> {
    const subject = toSafeText(input.subject, 'General STEM', 80);
    const topic = toSafeText(input.topic, 'Core Topic', 120);
    const difficulty = toSafeText(input.difficulty, 'medium', 20).toLowerCase();

    const userPrompt = [
      EXAM_PREPARATION_QUESTION_SET_PROMPT,
      `Subject: ${subject}`,
      `Topic: ${topic}`,
      `Difficulty: ${difficulty}`,
      `QuestionCount: ${input.questionCount}`,
    ].join('\n');

    const rawReply = await azureOpenAiClient.chat(
      [
        {
          role: 'system',
          content: EXAM_PREPARATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      {
        temperature: 0.25,
        maxTokens: 2500,
        jsonResponse: true,
      }
    );

    const parsed = extractJsonObject(rawReply);
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const normalizedQuestions = rawQuestions
      .map((question, index) => normalizeQuestion(question, index))
      .filter((question): question is ExamPreparationQuestion => Boolean(question));

    if (normalizedQuestions.length < input.questionCount) {
      throw new Error('Exam Preparation AI returned an incomplete question set. Please try again.');
    }

    return {
      assistant: EXAM_PREPARATION_ASSISTANT_NAME,
      setTitle: toSafeText(
        parsed.setTitle,
        `${subject} - ${topic} Exam Practice`,
        120
      ),
      instructions: toSafeText(
        parsed.instructions,
        'Answer each MCQ, review the explanation, and continue to complete your practice set.',
        220
      ),
      questions: normalizedQuestions.slice(0, input.questionCount),
    };
  }

  async generateImprovementTips(
    input: ImprovementTipsInput
  ): Promise<ImprovementTipsResponse> {
    const subject = toSafeText(input.subject, 'General STEM', 80);
    const topic = toSafeText(input.topic, 'Core Topic', 120);
    const difficulty = toSafeText(input.difficulty, 'medium', 20).toLowerCase();
    const weakAreas = normalizeWeakAreas(input.weakAreas);

    const userPrompt = [
      EXAM_PREPARATION_IMPROVEMENT_PROMPT,
      `Subject: ${subject}`,
      `Topic: ${topic}`,
      `Difficulty: ${difficulty}`,
      `Score: ${input.score}/${input.totalQuestions}`,
      `WeakAreas: ${weakAreas.length > 0 ? weakAreas.join(', ') : 'None identified'}`,
    ].join('\n');

    const rawReply = await azureOpenAiClient.chat(
      [
        {
          role: 'system',
          content: EXAM_PREPARATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      {
        temperature: 0.3,
        maxTokens: 900,
        jsonResponse: true,
      }
    );

    const parsed = extractJsonObject(rawReply);

    const modelWeakAreas = Array.isArray(parsed.weakAreas)
      ? normalizeWeakAreas(parsed.weakAreas.map((entry) => String(entry || '')))
      : weakAreas;

    const rawTips = Array.isArray(parsed.improvementTips)
      ? parsed.improvementTips
      : [];

    const improvementTips = rawTips
      .map((tip) => toSafeText(tip, '', 260))
      .filter(Boolean)
      .slice(0, 8);

    return {
      weakAreas: modelWeakAreas.length > 0 ? modelWeakAreas : weakAreas,
      improvementTips: improvementTips.length > 0 ? improvementTips : buildFallbackTips(weakAreas),
      encouragement: toSafeText(
        parsed.encouragement,
        'Consistent practice is improving your exam readiness. Keep going.',
        180
      ),
      nextPracticePlan: toSafeText(
        parsed.nextPracticePlan,
        'Practice one focused set on your weakest area, then complete one mixed-topic timed set.',
        220
      ),
    };
  }
}

export const examPreparationAiService = new ExamPreparationAiService();
