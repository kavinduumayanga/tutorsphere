import {
  ASK_LEARN_ASSISTANT_NAME,
  ASK_LEARN_OUT_OF_SCOPE_MESSAGE,
  FAQ_ASSISTANT_NAME,
  ROADMAP_OUT_OF_SCOPE_MESSAGE,
} from './promptRules.js';
import {
  getOutOfScopeReply,
  isPromptInjectionAttempt,
  sanitizeUserInput,
} from './security.js';
import { normalizeAssistantMode } from './context.js';
import { FaqChatContext } from './types.js';
import { TutorSphereAssistantService } from '../tutorsphere-assistant/service.js';
import { AskAndLearnAiService } from '../ask-and-learn-ai/service.js';
import { RoadmapFinderService } from '../roadmap-finder/service.js';

export class FaqChatbotService {
  private readonly tutorSphereAssistantService = new TutorSphereAssistantService();
  private readonly askAndLearnAiService = new AskAndLearnAiService();
  private readonly roadmapFinderService = new RoadmapFinderService();

  async getReply(message: string, context: FaqChatContext = {}): Promise<string> {
    const sanitizedMessage = sanitizeUserInput(message);
    const mode = normalizeAssistantMode(context.aiMode);

    if (!sanitizedMessage) {
      if (mode === 'ask_learn') {
        return `${ASK_LEARN_ASSISTANT_NAME} is ready. Ask any learning question in programming, science, technology, mathematics, engineering, or ICT.`;
      }
      if (mode === 'roadmap_finder') {
        return 'Enter a clear future technology/IT role (for example: Frontend Developer, AI Engineer, or DevOps Engineer), and I will generate a detailed career roadmap.';
      }
      return `${FAQ_ASSISTANT_NAME} is ready. Ask me about TutorSphere courses, tutors, bookings, resources, certificates, or platform usage.`;
    }

    if (isPromptInjectionAttempt(sanitizedMessage)) {
      if (mode === 'ask_learn') {
        return ASK_LEARN_OUT_OF_SCOPE_MESSAGE;
      }
      if (mode === 'roadmap_finder') {
        return ROADMAP_OUT_OF_SCOPE_MESSAGE;
      }
      return getOutOfScopeReply();
    }

    if (mode === 'ask_learn') {
      return this.askAndLearnAiService.getReply(sanitizedMessage, context);
    }

    if (mode === 'roadmap_finder') {
      return this.roadmapFinderService.getReply(sanitizedMessage, context);
    }

    return this.tutorSphereAssistantService.getReply(sanitizedMessage, context);
  }
}

export const faqChatbotService = new FaqChatbotService();
