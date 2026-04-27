import express from 'express';
import { sanitizeUserInput } from '../faq-chatbot/security.js';
import { trustedResourcesAiService } from './service.js';

const router = express.Router();

const toSafeTopic = (value: unknown): string =>
  sanitizeUserInput(String(value || '')).slice(0, 140);

router.post('/generate', async (req, res) => {
  try {
    const topic = toSafeTopic(req.body?.topic);

    if (!topic || topic.length < 2) {
      return res.status(400).json({
        error: 'A topic is required to find trusted resources.',
      });
    }

    const generated = await trustedResourcesAiService.generateTrustedResources({ topic });
    return res.json(generated);
  } catch (error) {
    console.error('Trusted Resources Finder AI /generate error:', error);
    return res.status(500).json({ error: 'Failed to generate trusted resources.' });
  }
});

export const trustedResourcesAiRouter = router;
