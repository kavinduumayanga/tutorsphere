import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  FAQ_OUT_OF_SCOPE_MESSAGE,
  FAQ_RESPONSE_FORMAT_RULES,
  FAQ_SYSTEM_PROMPT,
  PLATFORM_INFO_CONTEXT,
} from './promptRules.js';
import { buildSafePlatformSnapshot } from './dataLayer.js';
import {
  isTutorSphereScopeQuestion,
  sanitizeAssistantReply,
} from '../faq-chatbot/security.js';
import { toSafeContext } from '../faq-chatbot/context.js';
import { FaqChatContext, SafePlatformSnapshot } from '../faq-chatbot/types.js';

const FALLBACK_REPLY =
  'Hi! Here is a clear overview for you.\n\n🧭 TutorSphere Help\n\n1. Platform Guidance\n   • Scope: Courses, tutors, bookings, resources, certificates\n   • Format: Structured response blocks\n   • Support: Step-by-step help\n\n👉 You can explore these in TutorSphere sections, and I can guide your next step.';

type AssistantIntent =
  | 'courses'
  | 'tutors'
  | 'bookings'
  | 'resources'
  | 'certificates'
  | 'platform';

const INTENT_PATTERNS: Record<AssistantIntent, RegExp> = {
  courses: /\b(course|courses|enroll|enrollment|module|lesson|price|paid|free)\b/i,
  tutors: /\b(tutor|tutors|teacher|mentor|availability|profile|review|reviews|price\s*per\s*hour)\b/i,
  bookings: /\b(booking|bookings|book|session|slot|pending|confirmed|completed|cancelled|canceled)\b/i,
  resources: /\b(resource|resources|library|download|paper|article|note)\b/i,
  certificates: /\b(certificate|certificates|completion|completed\s*course)\b/i,
  platform: /\b(platform|dashboard|settings|how\s+to|usage|use\s+this\s+app|help|section)\b/i,
};

const SECTION_LINE_PATTERN = /^(📚|👩‍🏫|📅|📄|🏅|🧭|🛡️)\s+.+/;
const ITEM_BLOCK_PATTERN = /(^|\n)\d+\.\s.+\n\s*•\s.+\n\s*•\s.+/m;
const INLINE_LIST_PATTERN = /\d+\.\s[^\n]+\s-\s[^\n]+/;
const LABELED_BULLET_PATTERN = /^\s*•\s[^:\n]+:\s.+$/m;
const UNLABELED_BULLET_PATTERN = /^\s*•\s(?![^:\n]+:\s).+$/m;

const toLkr = (value: number): string => {
  const amount = Number(value) || 0;
  return amount <= 0 ? 'Free' : `LKR ${Math.round(amount)}`;
};

const toStatusTitle = (status: string): string => {
  const text = String(status || '').trim();
  if (!text) {
    return 'Status';
  }
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

const formatItemBlock = (
  index: number,
  title: string,
  details: Array<{ label: string; value: string | number }>
): string => {
  const safeTitle = String(title || 'Item').trim() || 'Item';
  const detailLines = details
    .map((detail) => `   • ${detail.label}: ${String(detail.value).trim()}`)
    .join('\n');

  return `${index}. ${safeTitle}\n${detailLines}`;
};

const intentSectionTitle: Record<AssistantIntent, string> = {
  courses: '📚 Available Courses',
  tutors: '👩‍🏫 Available Tutors',
  bookings: '📅 Booking Overview',
  resources: '📄 Resource Library',
  certificates: '🏅 Certificate Help',
  platform: '🧭 TutorSphere Guide',
};

const intentCta: Record<AssistantIntent, string> = {
  courses: '👉 You can explore these in the Courses section.',
  tutors: '👉 You can explore these in the Find Tutors section.',
  bookings: '👉 You can manage these in the booking flow and dashboard sections.',
  resources: '👉 You can explore these in the Resources section.',
  certificates: '👉 You can access this from the Courses learning flow after completion.',
  platform: '👉 You can explore these sections in TutorSphere, and I can guide your next step.',
};

const detectIntent = (message: string): AssistantIntent => {
  if (INTENT_PATTERNS.certificates.test(message)) {
    return 'certificates';
  }
  if (INTENT_PATTERNS.bookings.test(message)) {
    return 'bookings';
  }
  if (INTENT_PATTERNS.resources.test(message)) {
    return 'resources';
  }
  if (INTENT_PATTERNS.tutors.test(message)) {
    return 'tutors';
  }
  if (INTENT_PATTERNS.courses.test(message)) {
    return 'courses';
  }
  return 'platform';
};

const buildCoursesResponse = (snapshot: SafePlatformSnapshot): string => {
  const items = snapshot.courses.slice(0, 5);

  if (!items.length) {
    return [
      'Hi! Here is a clear overview for you.',
      '',
      intentSectionTitle.courses,
      '',
      '1. No courses found right now',
      '   • Subject: N/A',
      '   • Price: N/A',
      '   • Modules: 0',
      '',
      intentCta.courses,
    ].join('\n');
  }

  const blocks = items.map((course, index) =>
    formatItemBlock(index + 1, course.title, [
      { label: 'Subject', value: course.subject || 'N/A' },
      { label: 'Price', value: course.accessType === 'free' ? 'Free' : toLkr(course.price) },
      { label: 'Modules', value: course.moduleCount },
    ])
  );

  return [
    'Hi! Here is a clear overview for you.',
    '',
    intentSectionTitle.courses,
    '',
    blocks.join('\n\n'),
    '',
    intentCta.courses,
  ].join('\n');
};

const buildTutorsResponse = (snapshot: SafePlatformSnapshot): string => {
  const items = snapshot.tutors.slice(0, 5);

  if (!items.length) {
    return [
      'Hi! Here is a clear overview for you.',
      '',
      intentSectionTitle.tutors,
      '',
      '1. No tutors found right now',
      '   • Subjects: N/A',
      '   • Rate: N/A',
      '   • Rating: N/A',
      '',
      intentCta.tutors,
    ].join('\n');
  }

  const blocks = items.map((tutor, index) =>
    formatItemBlock(index + 1, tutor.name, [
      { label: 'Subjects', value: tutor.subjects.join(', ') || 'N/A' },
      { label: 'Rate', value: toLkr(tutor.pricePerHour) },
      { label: 'Rating', value: `${tutor.rating || 0} (${tutor.reviewCount || 0} reviews)` },
    ])
  );

  return [
    'Hi! Here is a clear overview for you.',
    '',
    intentSectionTitle.tutors,
    '',
    blocks.join('\n\n'),
    '',
    intentCta.tutors,
  ].join('\n');
};

const buildBookingsResponse = (snapshot: SafePlatformSnapshot): string => {
  const statusEntries = Object.entries(snapshot.bookingStatusCounts);
  const blocks = statusEntries.map(([status, count], index) =>
    formatItemBlock(index + 1, `${toStatusTitle(status)} Bookings`, [
      { label: 'Count', value: count },
      { label: 'Category', value: 'Booking status' },
      { label: 'Scope', value: 'TutorSphere sessions' },
    ])
  );

  return [
    'Hi! Here is a clear overview for you.',
    '',
    intentSectionTitle.bookings,
    '',
    blocks.join('\n\n'),
    '',
    intentCta.bookings,
  ].join('\n');
};

const buildResourcesResponse = (snapshot: SafePlatformSnapshot): string => {
  const items = [...snapshot.resources]
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, 5);

  if (!items.length) {
    return [
      'Hi! Here is a clear overview for you.',
      '',
      intentSectionTitle.resources,
      '',
      '1. No resources found right now',
      '   • Subject: N/A',
      '   • Type: N/A',
      '   • Downloads: 0',
      '',
      intentCta.resources,
    ].join('\n');
  }

  const blocks = items.map((resource, index) =>
    formatItemBlock(index + 1, resource.title, [
      { label: 'Subject', value: resource.subject || 'N/A' },
      { label: 'Type', value: resource.type || 'N/A' },
      { label: 'Downloads', value: resource.downloadCount },
    ])
  );

  return [
    'Hi! Here is a clear overview for you.',
    '',
    intentSectionTitle.resources,
    '',
    blocks.join('\n\n'),
    '',
    intentCta.resources,
  ].join('\n');
};

const buildCertificateResponse = (): string => {
  const blocks = [
    formatItemBlock(1, 'Complete All Modules', [
      { label: 'Requirement', value: 'Finish every lesson in the enrolled course' },
      { label: 'Progress Target', value: '100%' },
      { label: 'Location', value: 'Course Learning page' },
    ]),
    formatItemBlock(2, 'Open Certificate Action', [
      { label: 'Action', value: 'Use the certificate button after completion' },
      { label: 'Availability', value: 'Only after course completion' },
      { label: 'Output', value: 'Downloadable PDF certificate' },
    ]),
    formatItemBlock(3, 'If Download Fails', [
      { label: 'Check', value: 'Login as the enrolled student account' },
      { label: 'Check', value: 'Course progress must still be 100%' },
      { label: 'Next Step', value: 'Retry from the course learning screen' },
    ]),
  ];

  return [
    'Hi! Here is a clear overview for you.',
    '',
    intentSectionTitle.certificates,
    '',
    blocks.join('\n\n'),
    '',
    intentCta.certificates,
  ].join('\n');
};

const buildPlatformResponse = (): string => {
  const sections = PLATFORM_INFO_CONTEXT.knownSections;
  const sectionBlocks = [
    formatItemBlock(1, 'Find Learning Content', [
      { label: 'Sections', value: sections.filter((s) => ['Courses', 'Resources', 'AI Assistant'].includes(s)).join(', ') },
      { label: 'Use Case', value: 'Explore study content and practice' },
      { label: 'Audience', value: 'Students and tutors' },
    ]),
    formatItemBlock(2, 'Find and Book Tutors', [
      { label: 'Section', value: 'Find Tutors' },
      { label: 'Use Case', value: 'Browse tutor profiles and book sessions' },
      { label: 'Status Flow', value: 'Pending, confirmed, completed, cancelled' },
    ]),
    formatItemBlock(3, 'Track Progress and Settings', [
      { label: 'Sections', value: 'Dashboard, Settings' },
      { label: 'Use Case', value: 'Track learning progress and manage account' },
      { label: 'Certificates', value: 'Available after full course completion' },
    ]),
  ];

  return [
    'Hi! Here is a clear overview for you.',
    '',
    intentSectionTitle.platform,
    '',
    sectionBlocks.join('\n\n'),
    '',
    intentCta.platform,
  ].join('\n');
};

const buildStructuredFallback = (
  intent: AssistantIntent,
  snapshot: SafePlatformSnapshot
): string => {
  switch (intent) {
    case 'courses':
      return buildCoursesResponse(snapshot);
    case 'tutors':
      return buildTutorsResponse(snapshot);
    case 'bookings':
      return buildBookingsResponse(snapshot);
    case 'resources':
      return buildResourcesResponse(snapshot);
    case 'certificates':
      return buildCertificateResponse();
    case 'platform':
    default:
      return buildPlatformResponse();
  }
};

const normalizeStructuredSpacing = (value: string): string => {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^\s*-\s+/gm, '   • ')
    .replace(/^\s*•\s+/gm, '   • ')
    .replace(/\n(?:[ \t]*\n){2,}/g, '\n\n')
    .replace(/\n+(?=\d+\.\s)/g, '\n\n')
    .trim();
};

const isStrictStructuredOutput = (value: string): boolean => {
  const text = normalizeStructuredSpacing(value);
  const lines = text.split('\n').map((line) => line.trim());

  if (!lines.length) {
    return false;
  }

  const firstLine = lines[0];
  if (!firstLine || firstLine.length > 110) {
    return false;
  }

  const hasSectionTitle = lines.some((line) => SECTION_LINE_PATTERN.test(line));
  const hasItemBlock = ITEM_BLOCK_PATTERN.test(text);
  const hasLabeledBullets = LABELED_BULLET_PATTERN.test(text);
  const hasUnlabeledBullets = UNLABELED_BULLET_PATTERN.test(text);
  const hasInlineCompression = INLINE_LIST_PATTERN.test(text);
  const hasCta = /\n👉\s.+$/.test(text);
  const hasLongParagraph = text
    .split('\n\n')
    .some((block) => !block.includes('\n') && block.length > 140 && !block.startsWith('👉'));

  return (
    hasSectionTitle &&
    hasItemBlock &&
    hasLabeledBullets &&
    hasCta &&
    !hasUnlabeledBullets &&
    !hasInlineCompression &&
    !hasLongParagraph
  );
};

const enforceStrictStructuredOutput = (
  rawReply: string,
  intent: AssistantIntent,
  snapshot: SafePlatformSnapshot
): string => {
  const cleaned = sanitizeAssistantReply(rawReply);
  const normalized = normalizeStructuredSpacing(cleaned);

  if (isStrictStructuredOutput(normalized)) {
    return normalized;
  }

  return buildStructuredFallback(intent, snapshot);
};

export class TutorSphereAssistantService {
  async getReply(sanitizedMessage: string, context: FaqChatContext = {}): Promise<string> {
    if (!isTutorSphereScopeQuestion(sanitizedMessage)) {
      return FAQ_OUT_OF_SCOPE_MESSAGE;
    }

    const intent = detectIntent(sanitizedMessage);
    const safeContext = toSafeContext(context);
    const safeSnapshot = await buildSafePlatformSnapshot();

    const composedUserPrompt = [
      'Use the context below to answer the TutorSphere platform question.',
      FAQ_RESPONSE_FORMAT_RULES,
      `PrimaryIntent: ${intent}`,
      `UserContext: ${JSON.stringify(safeContext)}`,
      `PlatformInfo: ${JSON.stringify(PLATFORM_INFO_CONTEXT)}`,
      `SafePlatformData: ${JSON.stringify(safeSnapshot)}`,
      `UserQuestion: ${sanitizedMessage}`,
      'Return a direct answer focused on TutorSphere usage. If the question is out of scope, reply with the out-of-scope message.',
    ].join('\n\n');

    const rawReply = await azureOpenAiClient.chat(
      [
        {
          role: 'system',
          content: FAQ_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: composedUserPrompt,
        },
      ],
      {
        temperature: 0.2,
        maxTokens: 800,
      }
    );

    const safeReply = enforceStrictStructuredOutput(rawReply, intent, safeSnapshot);
    if (!safeReply) {
      return FALLBACK_REPLY;
    }

    if (!isTutorSphereScopeQuestion(`${sanitizedMessage} ${safeReply}`)) {
      return FAQ_OUT_OF_SCOPE_MESSAGE;
    }

    return safeReply;
  }
}
