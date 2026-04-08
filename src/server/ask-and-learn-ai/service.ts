import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  ASK_LEARN_OUT_OF_SCOPE_MESSAGE,
  ASK_LEARN_SYSTEM_PROMPT,
} from './promptRules.js';
import {
  isAskLearnRestrictedTopic,
  sanitizeAssistantReply,
} from '../faq-chatbot/security.js';
import { toSafeContext } from '../faq-chatbot/context.js';
import { FaqChatContext } from '../faq-chatbot/types.js';

const ASK_LEARN_FALLBACK_REPLY =
  '📘 Learning Assistant\n\nI can explain this step by step in a student-friendly way.\n\n🔹 Main Concepts:\n1. Core idea and why it matters\n2. Key terms and how they connect\n3. Practical usage\n\n🔹 Example:\nI can also provide a simple practical or code example if you want.\n\n👉 Tell me your exact topic (for example: "OOP in Java", "binary search", or "networking basics") and I will break it down clearly.';

export class AskAndLearnAiService {
  async getReply(sanitizedMessage: string, context: FaqChatContext = {}): Promise<string> {
    if (isAskLearnRestrictedTopic(sanitizedMessage)) {
      return ASK_LEARN_OUT_OF_SCOPE_MESSAGE;
    }

    const safeContext = toSafeContext(context);
    const composedUserPrompt = [
      'You are operating in Ask & Learn AI mode.',
      `UserContext: ${JSON.stringify(safeContext)}`,
      `UserQuestion: ${sanitizedMessage}`,
      'Answer as a tutor for educational learning questions with clear step-by-step explanations.',
      'If the user asks something harmful, illegal, sexually explicit, violent, or unrelated to learning, refuse using the exact required out-of-scope sentence.',
      'Keep the answer practical and student-friendly. Include a short "Next Practice Step" line.',
    ].join('\n\n');

    const rawReply = await azureOpenAiClient.chat(
      [
        {
          role: 'system',
          content: ASK_LEARN_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: composedUserPrompt,
        },
      ],
      {
        temperature: 0.3,
        maxTokens: 700,
      }
    );

    const safeReply = sanitizeAssistantReply(rawReply);
    if (!safeReply) {
      return ASK_LEARN_FALLBACK_REPLY;
    }

    return safeReply;
  }
}
