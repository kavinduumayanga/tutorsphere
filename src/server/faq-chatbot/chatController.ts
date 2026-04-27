import express from 'express';
import { faqChatbotService } from './faqChatbotService.js';

const ALLOWED_AI_MODES = new Set(['platform', 'ask_learn', 'roadmap_finder']);

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'message must be a string.' });
    }

    const replyOrStructured = await faqChatbotService.getReply(message, {
      currentTab: typeof context?.currentTab === 'string' ? context.currentTab : undefined,
      userRole: typeof context?.userRole === 'string' ? context.userRole : undefined,
      userName: typeof context?.userName === 'string' ? context.userName : undefined,
      aiMode:
        typeof context?.aiMode === 'string' && ALLOWED_AI_MODES.has(context.aiMode)
          ? context.aiMode
          : undefined,
    });

    // Support both legacy string reply and structured roadmap reply
    if (typeof replyOrStructured === 'string') {
      return res.json({ reply: replyOrStructured });
    }

    // structured object expected to have { reply: string, references?: TrustedResource[] }
    return res.json(replyOrStructured);
  } catch (error) {
    console.error('FAQ chatbot /chat error:', error);
    return res.status(500).json({ error: 'Failed to process FAQ chatbot request.' });
  }
});

export const faqChatbotRouter = router;
