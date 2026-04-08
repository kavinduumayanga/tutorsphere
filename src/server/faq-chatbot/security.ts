import {
  FAQ_OUT_OF_SCOPE_MESSAGE,
  FAQ_SECURITY_GUARD_MESSAGE,
} from './promptRules.js';

const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MULTI_SPACE_PATTERN = /\s+/g;
const INLINE_SPACE_PATTERN = /[ \t]{2,}/g;
const MAX_INPUT_LENGTH = 900;
const MAX_OUTPUT_LENGTH = 1800;

const INJECTION_PATTERN =
  /(ignore\s+(all\s+)?(previous|prior|above)?\s*instructions|reveal\s+(system|developer|hidden)\s*prompt|show\s+internal|dump\s+database|raw\s+(json|document)|bypass\s+rules|jailbreak|api\s*key|access\s*token|password|secret)/i;

const SCOPE_KEYWORD_PATTERN =
  /\b(tutorsphere|course|courses|module|lesson|tutor|tutors|booking|bookings|resource|resources|certificate|certificates|dashboard|quiz|assistant|profile|availability|review|reviews|enroll|enrollment|payment|download|library|signup|register|login|account|settings|platform)\b/i;

const ASK_LEARN_HARMFUL_OR_ILLEGAL_PATTERN =
  /\b(how\s+to\s+make\s+(a\s+)?bomb|build\s+(a\s+)?bomb|how\s+to\s+kill|how\s+to\s+murder|assassinate|terror(ism|ist)?|buy\s+illegal\s+drugs|drug\s+trafficking|phishing|ransomware|malware|ddos|steal\s+password|bypass\s+password|credit\s+card\s+fraud|porn|explicit\s+sexual|rape)\b/i;

const ASK_LEARN_UNRELATED_PATTERN =
  /\b(politics?|election|politician|party\s+manifesto|celebrity\s+gossip|dating\s+advice|horoscope|astrology|adult\s+chat)\b/i;

const ROADMAP_REQUEST_PATTERN =
  /\b(roadmap|career\s*path|learning\s*path|how\s+to\s+become|become\s+a?n?|future\s+role|job\s+role|career\s+goal|transition\s+to|plan\s+to\s+become|what\s+should\s+i\s+learn\s+to\s+become)\b/i;

const ROLE_HINT_PATTERN =
  /\b(software\s+engineer|data\s+scientist|data\s+analyst|ai\s+engineer|ml\s+engineer|cybersecurity\s+analyst|network\s+engineer|devops\s+engineer|cloud\s+engineer|frontend\s+developer|backend\s+developer|full\s*stack\s+developer|mobile\s+developer|game\s+developer|qa\s+engineer|site\s+reliability\s+engineer|product\s+manager|ux\s+designer|ui\s+designer)\b/i;

const APP_REFERENCE_PATTERN = /\b(this\s+app|this\s+platform|website|portal|here)\b/i;

const SENSITIVE_OUTPUT_PATTERN =
  /(mongodb(\+srv)?:\/\/|"_id"\s*:|"__v"\s*:|api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|refresh[_-]?token\s*[:=]|password\s*[:=]|secret\s*[:=])/i;

const KEY_VALUE_SECRET_PATTERN =
  /\b(password|token|api[_-]?key|secret|authorization)\b\s*[:=]\s*[^\s,;]+/gi;

const stripControlChars = (value: string): string => value.replace(CONTROL_CHAR_PATTERN, ' ');

const normalizeAssistantLayout = (value: string): string => {
  const normalizedNewlines = value.replace(/\r\n?/g, '\n');
  const lines = normalizedNewlines
    .split('\n')
    .map((line) => line.replace(INLINE_SPACE_PATTERN, ' ').trimEnd());

  const collapsed = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Ensure visible spacing between numbered card-style items.
  return collapsed.replace(/\n(?=\d+\.\s)/g, '\n\n');
};

export const sanitizeUserInput = (value: unknown): string => {
  const text = stripControlChars(String(value ?? ''))
    .replace(MULTI_SPACE_PATTERN, ' ')
    .trim();

  if (!text) {
    return '';
  }

  return text.slice(0, MAX_INPUT_LENGTH);
};

export const isPromptInjectionAttempt = (message: string): boolean => {
  return INJECTION_PATTERN.test(message);
};

export const isTutorSphereScopeQuestion = (message: string): boolean => {
  const text = message.trim();
  if (!text) {
    return false;
  }

  return SCOPE_KEYWORD_PATTERN.test(text) || APP_REFERENCE_PATTERN.test(text);
};

export const isAskLearnRestrictedTopic = (message: string): boolean => {
  const text = message.trim();
  if (!text) {
    return false;
  }

  return ASK_LEARN_HARMFUL_OR_ILLEGAL_PATTERN.test(text) || ASK_LEARN_UNRELATED_PATTERN.test(text);
};

export const isRoadmapRequest = (message: string): boolean => {
  const text = message.trim();
  if (!text) {
    return false;
  }

  return ROADMAP_REQUEST_PATTERN.test(text) || ROLE_HINT_PATTERN.test(text);
};

export const getOutOfScopeReply = (): string => FAQ_OUT_OF_SCOPE_MESSAGE;

export const sanitizeAssistantReply = (value: unknown): string => {
  const normalized = normalizeAssistantLayout(
    stripControlChars(String(value ?? ''))
    .replace(KEY_VALUE_SECRET_PATTERN, '[REDACTED]')
    .slice(0, MAX_OUTPUT_LENGTH)
  );

  if (!normalized) {
    return FAQ_SECURITY_GUARD_MESSAGE;
  }

  if (SENSITIVE_OUTPUT_PATTERN.test(normalized)) {
    return FAQ_SECURITY_GUARD_MESSAGE;
  }

  return normalized;
};
