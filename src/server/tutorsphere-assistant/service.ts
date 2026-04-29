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
const NO_DATA_INFO_MESSAGE = "I couldn't find that information on TutorSphere right now.";

type AssistantIntent =
  | 'courses'
  | 'tutors'
  | 'course_enrollment_help'
  | 'booking_help'
  | 'resource_download_help'
  | 'bookings'
  | 'resources'
  | 'certificates'
  | 'platform';

const INTENT_PATTERNS: Record<AssistantIntent, RegExp> = {
  courses: /\b(course|courses|enroll|enrollment|module|lesson|price|paid|free)\b/i,
  tutors: /\b(tutor|tutors|teacher|mentor|availability|profile|review|reviews|price\s*per\s*hour)\b/i,
  course_enrollment_help: /\b(course|courses|enroll|enrollment|join|start)\b/i,
  booking_help: /\b(book|booking|session|slot|schedule|reserve)\b/i,
  resource_download_help: /\b(resource|resources|download|file)\b/i,
  bookings: /\b(booking|bookings|book|session|slot|pending|confirmed|completed|cancelled|canceled)\b/i,
  resources: /\b(resource|resources|library|download|paper|article|note)\b/i,
  certificates: /\b(certificate|certificates|completion|completed\s*course)\b/i,
  platform: /\b(platform|dashboard|settings|how\s+to|usage|use\s+this\s+app|help|section)\b/i,
};

const HOW_TO_PHRASE_PATTERN = /\b(how\s+to|how\s+do\s+i|how\s+can\s+i|steps?\s+to|guide\s+to)\b/i;

const COURSE_ENROLLMENT_HELP_PATTERNS: RegExp[] = [
  /\bhow\s+(do|can)\s+i\s+(enroll|join|start)\b/i,
  /\bhow\s+to\s+(enroll|join|start)\b/i,
  /\bsteps?\s+(to|for)\s+(enroll|enrollment|join|start)\b/i,
  /\b(enroll|enrollment)\s+(in|into)\s+(a\s+)?course\b/i,
  /\bhelp\s+(me\s+)?(enroll|enrollment|join)\b/i,
];

const BOOKING_HELP_PATTERNS: RegExp[] = [
  /\bhow\s+(do|can)\s+i\s+(book|schedule|reserve)\b/i,
  /\bhow\s+to\s+(book|schedule|reserve)\b/i,
  /\bsteps?\s+(to|for)\s+(book|booking|schedule|reserve)\b/i,
  /\b(book|booking)\s+(a\s+)?tutor\b/i,
  /\bhelp\s+(me\s+)?(book|booking|schedule)\b/i,
  /\bbooking\s+process\b/i,
];

const RESOURCE_DOWNLOAD_HELP_PATTERNS: RegExp[] = [
  /\bdownload(?:ing)?\s+(a\s+)?resource\b/i,
  /\bdownload(?:ing)?\s+resources\b/i,
  /\b(get|save)\s+(a\s+)?resource\b/i,
  /\bresource\s+download\b/i,
  /\bdownload\s+from\s+resources?\b/i,
];

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

const toVerificationLabel = (isVerified: boolean): string => {
  return isVerified ? 'Verified' : 'Not verified';
};

const toRatingSummary = (rating: number, reviewCount: number): string => {
  const safeRating = Number.isFinite(rating) ? rating : 0;
  const safeReviews = Number.isFinite(reviewCount) ? reviewCount : 0;
  return `${safeRating.toFixed(1)} (${safeReviews} reviews)`;
};

const hasPatternMatch = (message: string, patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => pattern.test(message));
};

const isBookingHelpQuestion = (message: string): boolean => {
  if (!INTENT_PATTERNS.booking_help.test(message)) {
    return false;
  }

  return hasPatternMatch(message, BOOKING_HELP_PATTERNS);
};

const isCourseEnrollmentHelpQuestion = (message: string): boolean => {
  if (!INTENT_PATTERNS.course_enrollment_help.test(message)) {
    return false;
  }

  return hasPatternMatch(message, COURSE_ENROLLMENT_HELP_PATTERNS);
};

const isResourceDownloadHelpQuestion = (message: string): boolean => {
  if (!INTENT_PATTERNS.resource_download_help.test(message)) {
    return false;
  }

  if (!HOW_TO_PHRASE_PATTERN.test(message)) {
    return false;
  }

  return hasPatternMatch(message, RESOURCE_DOWNLOAD_HELP_PATTERNS);
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
  course_enrollment_help: '📚 Course Enrollment Guide',
  booking_help: '📅 Tutor Booking Guide',
  resource_download_help: '📄 Resource Download Guide',
  bookings: '📅 Booking Overview',
  resources: '📄 Resource Library',
  certificates: '🏅 Certificate Help',
  platform: '🧭 TutorSphere Guide',
};

const intentCta: Record<AssistantIntent, string> = {
  courses: '👉 You can explore these in the Courses section.',
  tutors: '👉 You can explore these in the Find Tutors section.',
  course_enrollment_help: '👉 Next step: open Browse Courses and pick a course to enroll.',
  booking_help:
    '👉 Next step: ask "What tutors are available on this platform?" and I will list tutor options here.',
  resource_download_help:
    '👉 Next step: open Resources and choose the file you want to download.',
  bookings: '👉 You can manage these in the booking flow and dashboard sections.',
  resources: '👉 You can explore these in the Resources section.',
  certificates: '👉 You can access this from the Courses learning flow after completion.',
  platform: '👉 You can explore these sections in TutorSphere, and I can guide your next step.',
};

const detectIntent = (message: string): AssistantIntent => {
  if (INTENT_PATTERNS.certificates.test(message)) {
    return 'certificates';
  }
  if (isCourseEnrollmentHelpQuestion(message)) {
    return 'course_enrollment_help';
  }
  if (isBookingHelpQuestion(message)) {
    return 'booking_help';
  }
  if (isResourceDownloadHelpQuestion(message)) {
    return 'resource_download_help';
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
  if (INTENT_PATTERNS.bookings.test(message)) {
    return 'bookings';
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
      `1. ${NO_DATA_INFO_MESSAGE}`,
      '   • Area: Courses',
      '   • Status: No course records available',
      '   • Next Step: Try again later in Browse Courses',
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
      "1. I couldn't find any tutors right now.",
      '   • Area: Tutors',
      '   • Status: No tutor records available',
      '   • Next Step: Try again later in Find Tutors',
      '',
      intentCta.tutors,
    ].join('\n');
  }

  const blocks = items.map((tutor, index) =>
    formatItemBlock(index + 1, tutor.name, [
      { label: 'Subjects', value: tutor.subjects.join(', ') || 'N/A' },
      { label: 'Teaching Level', value: tutor.teachingLevel || 'Not specified' },
      { label: 'Hourly Rate', value: toLkr(tutor.pricePerHour) },
      { label: 'Rating', value: toRatingSummary(tutor.rating, tutor.reviewCount) },
      { label: 'Verified', value: toVerificationLabel(tutor.isVerified) },
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

const buildCourseEnrollmentHelpResponse = (): string => {
  const steps = [
    formatItemBlock(1, 'Go to Browse Courses', [
      { label: 'Action', value: 'Open the Courses section' },
      { label: 'Goal', value: 'Find a course by subject or title' },
      { label: 'Output', value: 'Choose a course card' },
    ]),
    formatItemBlock(2, 'Open Course Details', [
      { label: 'Action', value: 'Select the course you want to join' },
      { label: 'Check', value: 'Review modules, tutor, and pricing' },
      { label: 'Output', value: 'Continue to enrollment' },
    ]),
    formatItemBlock(3, 'Complete Enrollment', [
      { label: 'Action', value: 'Click enroll and complete payment if required' },
      { label: 'Result', value: 'Enrollment is saved to your account' },
      { label: 'Output', value: 'Course appears in your learning area' },
    ]),
    formatItemBlock(4, 'Start Learning', [
      { label: 'Action', value: 'Open the enrolled course modules' },
      { label: 'Progress', value: 'Track completion from your dashboard' },
      { label: 'Result', value: 'Continue lessons at your own pace' },
    ]),
  ];

  return [
    'Hi! Here is the course enrollment flow.',
    '',
    intentSectionTitle.course_enrollment_help,
    '',
    steps.join('\n\n'),
    '',
    intentCta.course_enrollment_help,
  ].join('\n');
};

const buildBookingHelpResponse = (): string => {
  const steps = [
    formatItemBlock(1, 'Go to Find Tutors', [
      { label: 'Action', value: 'Open the Find Tutors section' },
      { label: 'Goal', value: 'Filter tutors by subject, level, and price' },
      { label: 'Output', value: 'Choose a tutor profile to continue' },
    ]),
    formatItemBlock(2, 'Select a Tutor', [
      { label: 'Action', value: 'Open your preferred tutor profile' },
      { label: 'Check', value: 'Review subjects, rating, and hourly rate' },
      { label: 'Output', value: 'Start the booking flow from the profile' },
    ]),
    formatItemBlock(3, 'Choose Available Date and Time', [
      { label: 'Action', value: 'Pick an available slot from the tutor calendar' },
      { label: 'Check', value: 'Confirm your selected date and time' },
      { label: 'Output', value: 'Proceed to payment' },
    ]),
    formatItemBlock(4, 'Complete Payment', [
      { label: 'Action', value: 'Use the platform checkout to confirm the booking' },
      { label: 'Result', value: 'Booking is saved with a valid status' },
      { label: 'Output', value: 'Session appears in your bookings' },
    ]),
    formatItemBlock(5, 'Join the Session', [
      { label: 'Action', value: 'Open your booking at session time' },
      { label: 'Requirement', value: 'Tutor must add the meeting link' },
      { label: 'Result', value: 'Join directly from your booking record' },
    ]),
  ];

  return [
    'Hi! Here is the tutor booking flow.',
    '',
    intentSectionTitle.booking_help,
    '',
    steps.join('\n\n'),
    '',
    intentCta.booking_help,
  ].join('\n');
};

const buildResourceDownloadHelpResponse = (): string => {
  const steps = [
    formatItemBlock(1, 'Go to the Resources section', [
      { label: 'Action', value: 'Open Resources in TutorSphere' },
      { label: 'Goal', value: 'Access your resource library' },
      { label: 'Output', value: 'Resource cards are visible' },
    ]),
    formatItemBlock(2, 'Browse or search for the resource', [
      { label: 'Action', value: 'Use filters or search by title/subject' },
      { label: 'Goal', value: 'Find the exact file you need' },
      { label: 'Output', value: 'Target resource is selected' },
    ]),
    formatItemBlock(3, 'Open or select the resource card', [
      { label: 'Action', value: 'Click the resource card' },
      { label: 'Check', value: 'Confirm the correct resource details' },
      { label: 'Output', value: 'Locate the download action' },
    ]),
    formatItemBlock(4, 'Click Download', [
      { label: 'Action', value: 'Press the Download button' },
      { label: 'Result', value: 'Download starts immediately' },
      { label: 'Output', value: 'File begins saving locally' },
    ]),
    formatItemBlock(5, 'The file will download to your device', [
      { label: 'Location', value: 'Usually your Downloads folder' },
      { label: 'Status', value: 'Ready to open after download completes' },
      { label: 'Next Step', value: 'Use it for your study session' },
    ]),
  ];

  return [
    'Hi! Here are the resource download steps.',
    '',
    intentSectionTitle.resource_download_help,
    '',
    steps.join('\n\n'),
    '',
    intentCta.resource_download_help,
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
      `1. ${NO_DATA_INFO_MESSAGE}`,
      '   • Area: Resources',
      '   • Status: No resource records available',
      '   • Next Step: Check the Resources section later',
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
    case 'course_enrollment_help':
      return buildCourseEnrollmentHelpResponse();
    case 'booking_help':
      return buildBookingHelpResponse();
    case 'resource_download_help':
      return buildResourceDownloadHelpResponse();
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

const DETERMINISTIC_INTENTS = new Set<AssistantIntent>([
  'courses',
  'tutors',
  'course_enrollment_help',
  'booking_help',
  'resource_download_help',
  'bookings',
  'resources',
  'certificates',
  'platform',
]);

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

    if (DETERMINISTIC_INTENTS.has(intent)) {
      return buildStructuredFallback(intent, safeSnapshot);
    }

    const composedUserPrompt = [
      'Use the context below to answer the TutorSphere platform question.',
      FAQ_RESPONSE_FORMAT_RULES,
      `PrimaryIntent: ${intent}`,
      `UserContext: ${JSON.stringify(safeContext)}`,
      `PlatformInfo: ${JSON.stringify(PLATFORM_INFO_CONTEXT)}`,
      `SafePlatformData: ${JSON.stringify(safeSnapshot)}`,
      `UserQuestion: ${sanitizedMessage}`,
      `If the question is outside TutorSphere platform scope, reply exactly with: "${FAQ_OUT_OF_SCOPE_MESSAGE}"`,
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
