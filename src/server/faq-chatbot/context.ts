import { FaqAssistantMode, FaqChatContext } from './types.js';
import { sanitizeUserInput } from './security.js';

export type AssistantMode = FaqAssistantMode;

export const normalizeAssistantMode = (value: unknown): AssistantMode => {
  if (value === 'ask_learn' || value === 'roadmap_finder' || value === 'platform') {
    return value;
  }
  return 'platform';
};

export const toSafeContext = (context: FaqChatContext = {}) => ({
  currentTab: sanitizeUserInput(context.currentTab || '').slice(0, 40) || 'unknown',
  userRole: sanitizeUserInput(context.userRole || '').slice(0, 20) || 'guest',
  userName: sanitizeUserInput(context.userName || '').slice(0, 80) || 'Guest',
  aiMode: normalizeAssistantMode(context.aiMode),
});
