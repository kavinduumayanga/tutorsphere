import express from 'express';
import { faqChatbotService } from './faqChatbotService.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'message must be a string.' });
    }

    const reply = await faqChatbotService.getReply(message, {
      currentTab: typeof context?.currentTab === 'string' ? context.currentTab : undefined,
      userRole: typeof context?.userRole === 'string' ? context.userRole : undefined,
      userName: typeof context?.userName === 'string' ? context.userName : undefined,
    });

    return res.json({ reply });
  } catch (error) {
    console.error('FAQ chatbot /chat error:', error);
    return res.status(500).json({ error: 'Failed to process FAQ chatbot request.' });
  }
});

export const faqChatbotRouter = router;
