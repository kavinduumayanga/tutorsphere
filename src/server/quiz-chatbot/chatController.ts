import express from 'express';
import { User } from '../../models/User.js';
import { QUIZ_OPENING_PROMPT } from './promptRules.js';
import { QuizSessionManager } from './quizSessionManager.js';
import { QuizChatUserRole } from './types.js';

const router = express.Router();
const sessionManager = new QuizSessionManager();

const isSupportedRole = (role: string): role is QuizChatUserRole => {
  return role === 'student' || role === 'tutor';
};

const validateAuthorizedQuizUser = async (
  userId: string,
  role: string
): Promise<{ isValid: boolean; error?: string }> => {
  if (!userId || !role) {
    return {
      isValid: false,
      error: 'Authentication is required to use the quiz chatbot.',
    };
  }

  if (!isSupportedRole(role)) {
    return {
      isValid: false,
      error: 'Only logged-in students and tutors can use the quiz chatbot.',
    };
  }

  const user = await User.findOne({ id: userId, role });
  if (!user) {
    return {
      isValid: false,
      error: 'Authorized user not found. Please log in again.',
    };
  }

  return { isValid: true };
};

router.post('/chat', async (req, res) => {
  try {
    const { message, userId, role } = req.body || {};

    const auth = await validateAuthorizedQuizUser(
      String(userId || '').trim(),
      String(role || '').trim()
    );

    if (!auth.isValid) {
      return res.status(403).json({ error: auth.error });
    }

    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'message must be a string.' });
    }

    const result = await sessionManager.handleMessage(userId, role, message);
    return res.json(result);
  } catch (error) {
    console.error('Quiz chatbot /chat error:', error);
    return res.status(500).json({ error: 'Failed to process quiz chatbot request.' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const { userId, role } = req.body || {};

    const auth = await validateAuthorizedQuizUser(
      String(userId || '').trim(),
      String(role || '').trim()
    );

    if (!auth.isValid) {
      return res.status(403).json({ error: auth.error });
    }

    const resetResult = sessionManager.resetSession(userId);
    return res.json({
      ...resetResult,
      reply: QUIZ_OPENING_PROMPT,
      stage: 'awaitingSubject',
      sessionEnded: false,
    });
  } catch (error) {
    console.error('Quiz chatbot /reset error:', error);
    return res.status(500).json({ error: 'Failed to reset quiz chatbot session.' });
  }
});

export const quizChatbotRouter = router;
