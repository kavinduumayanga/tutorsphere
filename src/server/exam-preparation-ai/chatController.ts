import express from 'express';
import { sanitizeUserInput } from '../faq-chatbot/security.js';
import { examPreparationAiService } from './service.js';
import { type ExamDifficulty, type ExamQuestionCount } from './types.js';

const router = express.Router();

const ALLOWED_DIFFICULTIES = new Set<ExamDifficulty>(['easy', 'medium', 'hard']);
const ALLOWED_QUESTION_COUNTS = new Set<ExamQuestionCount>([5, 10, 15]);

const toSafeField = (value: unknown, maxLength: number): string =>
  sanitizeUserInput(String(value || '')).slice(0, maxLength);

const toDifficulty = (value: unknown): ExamDifficulty | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (ALLOWED_DIFFICULTIES.has(normalized as ExamDifficulty)) {
    return normalized as ExamDifficulty;
  }

  return null;
};

const toQuestionCount = (value: unknown): ExamQuestionCount | null => {
  const normalized = Number(value);
  if (ALLOWED_QUESTION_COUNTS.has(normalized as ExamQuestionCount)) {
    return normalized as ExamQuestionCount;
  }

  return null;
};

const handleGenerateSet: express.RequestHandler = async (req, res) => {
  try {
    const subject = toSafeField(req.body?.subject, 80);
    const topic = toSafeField(req.body?.topic, 120);
    const difficulty = toDifficulty(req.body?.difficulty);
    const questionCount = toQuestionCount(req.body?.questionCount);

    if (!subject || !topic || !difficulty || !questionCount) {
      return res.status(400).json({
        error: 'subject, topic, difficulty (easy|medium|hard), and questionCount (5|10|15) are required.',
      });
    }

    const generatedSet = await examPreparationAiService.generateQuestionSet({
      subject,
      topic,
      difficulty,
      questionCount,
    });

    return res.json(generatedSet);
  } catch (error) {
    console.error('Exam Preparation AI /generate-set error:', error);
    return res.status(500).json({ error: 'Failed to generate exam preparation question set.' });
  }
};

// Canonical endpoint used by the current frontend.
router.post('/generate-set', handleGenerateSet);

// Compatibility aliases for older or alternative route contracts.
router.post('/generate', handleGenerateSet);
router.post('/generate-test', handleGenerateSet);

router.post('/improvement-tips', async (req, res) => {
  try {
    const subject = toSafeField(req.body?.subject, 80);
    const topic = toSafeField(req.body?.topic, 120);
    const difficulty = toDifficulty(req.body?.difficulty);
    const scoreValue = Number(req.body?.score);
    const totalQuestionsValue = Number(req.body?.totalQuestions);

    if (!subject || !topic || !difficulty || !Number.isFinite(scoreValue) || !Number.isFinite(totalQuestionsValue)) {
      return res.status(400).json({
        error: 'subject, topic, difficulty, score, and totalQuestions are required.',
      });
    }

    const totalQuestions = Math.max(1, Math.round(totalQuestionsValue));
    const score = Math.max(0, Math.min(totalQuestions, Math.round(scoreValue)));
    const weakAreas = Array.isArray(req.body?.weakAreas)
      ? req.body.weakAreas
          .map((entry: unknown) => toSafeField(entry, 90))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const tips = await examPreparationAiService.generateImprovementTips({
      subject,
      topic,
      difficulty,
      score,
      totalQuestions,
      weakAreas,
    });

    return res.json(tips);
  } catch (error) {
    console.error('Exam Preparation AI /improvement-tips error:', error);
    return res.status(500).json({ error: 'Failed to generate exam preparation improvement tips.' });
  }
});

export const examPreparationAiRouter = router;
