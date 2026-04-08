import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  ASK_LEARN_ASSISTANT_NAME,
  ASK_LEARN_OUT_OF_SCOPE_MESSAGE,
  ASK_LEARN_SYSTEM_PROMPT,
  FAQ_ASSISTANT_NAME,
  FAQ_OUT_OF_SCOPE_MESSAGE,
  FAQ_RESPONSE_FORMAT_RULES,
  FAQ_SYSTEM_PROMPT,
  PLATFORM_INFO_CONTEXT,
  ROADMAP_FINDER_ASSISTANT_NAME,
  ROADMAP_OUT_OF_SCOPE_MESSAGE,
  ROADMAP_SYSTEM_PROMPT,
} from './promptRules.js';
import { buildSafePlatformSnapshot } from './dataLayer.js';
import {
  getOutOfScopeReply,
  isAskLearnRestrictedTopic,
  isPromptInjectionAttempt,
  isRoadmapRequest,
  isTutorSphereScopeQuestion,
  sanitizeAssistantReply,
  sanitizeUserInput,
} from './security.js';
import { FaqAssistantMode, FaqChatContext, SafePlatformSnapshot } from './types.js';

const FALLBACK_REPLY =
  'Hi! Here is a clear overview for you.\n\n🧭 TutorSphere Help\n\n1. Platform Guidance\n   • Scope: Courses, tutors, bookings, resources, certificates\n   • Format: Structured response blocks\n   • Support: Step-by-step help\n\n👉 You can explore these in TutorSphere sections, and I can guide your next step.';

const ASK_LEARN_FALLBACK_REPLY =
  '📘 Learning Assistant\n\nI can explain this step by step in a student-friendly way.\n\n🔹 Main Concepts:\n1. Core idea and why it matters\n2. Key terms and how they connect\n3. Practical usage\n\n🔹 Example:\nI can also provide a simple practical or code example if you want.\n\n👉 Tell me your exact topic (for example: "OOP in Java", "binary search", or "networking basics") and I will break it down clearly.';

type AssistantIntent =
  | 'courses'
  | 'tutors'
  | 'bookings'
  | 'resources'
  | 'certificates'
  | 'platform';

type AssistantMode = FaqAssistantMode;

const normalizeAssistantMode = (value: unknown): AssistantMode => {
  if (value === 'ask_learn' || value === 'roadmap_finder' || value === 'platform') {
    return value;
  }
  return 'platform';
};

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

const toSafeContext = (context: FaqChatContext = {}) => ({
  currentTab: sanitizeUserInput(context.currentTab || '').slice(0, 40) || 'unknown',
  userRole: sanitizeUserInput(context.userRole || '').slice(0, 20) || 'guest',
  userName: sanitizeUserInput(context.userName || '').slice(0, 80) || 'Guest',
  aiMode: normalizeAssistantMode(context.aiMode),
});

const TARGET_ROLE_PATTERNS = [
  /(?:become|as|for|toward|towards)\s+(?:a|an)?\s*([a-z][a-z0-9\s/+\-]{2,50})/i,
  /roadmap\s+(?:for|to\s+become)\s+(?:a|an)?\s*([a-z][a-z0-9\s/+\-]{2,50})/i,
  /(?:role|career)\s*[:\-]\s*([a-z][a-z0-9\s/+\-]{2,50})/i,
];

const ROADMAP_SECTION_HEADERS = [
  '1. Career Goal',
  '2. What You Need to Learn First',
  '3. Core Skills',
  '4. Tools / Technologies',
  '5. Projects to Build',
  '6. Advanced Topics',
  '7. Portfolio / Experience Plan',
  '8. Job Preparation',
];

type RoadmapRoleProfile = {
  canonicalRole: string;
  aliases: string[];
  roleOverview: string;
  fundamentals: string[];
  coreSkills: string[];
  tools: string[];
  projects: string[];
  advancedTopics: string[];
  portfolioPlan: string[];
  certifications: string[];
  jobPreparation: string[];
  specializationPaths: string[];
};

const ROADMAP_ROLE_PROFILES: RoadmapRoleProfile[] = [
  {
    canonicalRole: 'Frontend Developer',
    aliases: ['frontend developer', 'front end developer', 'frontend', 'front end', 'ui developer', 'web frontend developer'],
    roleOverview: 'Build responsive, accessible, and high-performance user interfaces for web products.',
    fundamentals: [
      'Beginner: HTML5 semantics, CSS layout systems, and modern JavaScript fundamentals.',
      'Intermediate: TypeScript, component-based architecture, state management, and API integration.',
      'Advanced: Performance optimization, design systems, accessibility auditing, and frontend architecture decisions.',
    ],
    coreSkills: [
      'JavaScript and TypeScript proficiency',
      'Component architecture and reusable UI patterns',
      'Responsive design, accessibility (WCAG), and UX collaboration',
      'Testing with unit and end-to-end workflows',
      'Browser performance profiling and optimization',
    ],
    tools: ['React', 'Next.js or Vite', 'Tailwind CSS or CSS Modules', 'Jest/Vitest', 'Playwright/Cypress', 'Figma'],
    projects: [
      'Interactive dashboard with charts, filters, and role-based views',
      'E-commerce storefront with search, cart, and checkout UX',
      'Design-system driven component library with Storybook',
      'Accessibility-first landing page suite with Lighthouse targets',
    ],
    advancedTopics: ['Micro-frontend architecture', 'SSR/ISR strategies', 'Web performance budgets', 'Frontend observability and error monitoring'],
    portfolioPlan: ['Publish 3-4 polished frontend projects with case studies', 'Record before/after performance metrics', 'Document UI decisions, trade-offs, and accessibility work'],
    certifications: ['Meta Front-End Developer (optional)', 'Google UX Design (optional)'],
    jobPreparation: ['Practice React/TypeScript interview questions', 'Solve frontend coding tasks and UI debugging scenarios', 'Prepare project walkthroughs focused on architecture and impact'],
    specializationPaths: ['Frontend Performance Engineer', 'Design System Engineer', 'Web Accessibility Specialist'],
  },
  {
    canonicalRole: 'Backend Developer',
    aliases: ['backend developer', 'back end developer', 'backend', 'back end', 'api developer', 'server-side developer'],
    roleOverview: 'Design and build scalable APIs, business logic, and reliable data systems.',
    fundamentals: [
      'Beginner: One backend language deeply (Node.js, Java, Python, or Go), HTTP basics, and SQL fundamentals.',
      'Intermediate: API design, authentication, caching, and database modeling.',
      'Advanced: Distributed systems, observability, reliability engineering, and performance tuning.',
    ],
    coreSkills: [
      'REST/GraphQL API design and versioning',
      'Database schema design and query optimization',
      'Authentication, authorization, and security best practices',
      'Error handling, logging, and monitoring',
      'Background jobs and asynchronous processing',
    ],
    tools: ['Node.js/Express/NestJS or Spring Boot or FastAPI', 'PostgreSQL/MySQL', 'Redis', 'Docker', 'Kafka/RabbitMQ', 'OpenAPI'],
    projects: [
      'Production-ready API for booking/e-commerce workflow',
      'Auth service with JWT/refresh tokens and role-based access',
      'Event-driven processing pipeline with queues',
      'Analytics/reporting service with optimized queries',
    ],
    advancedTopics: ['System design fundamentals', 'Rate limiting and API gateway patterns', 'Horizontal scaling and eventual consistency', 'Secure coding and threat modeling'],
    portfolioPlan: ['Show API docs and architecture diagrams', 'Include load-testing and performance reports', 'Demonstrate secure auth and data protection patterns'],
    certifications: ['AWS Developer Associate (optional)', 'Google Associate Cloud Engineer (optional)'],
    jobPreparation: ['Practice backend coding and SQL tasks', 'Prepare system design mini-interviews', 'Explain API and database trade-offs from your projects'],
    specializationPaths: ['Platform Engineer', 'Distributed Systems Engineer', 'Security-focused Backend Engineer'],
  },
  {
    canonicalRole: 'Full Stack Developer',
    aliases: ['full stack developer', 'fullstack developer', 'full stack', 'full-stack engineer'],
    roleOverview: 'Build complete products across frontend, backend, and deployment workflows.',
    fundamentals: [
      'Beginner: HTML/CSS/JavaScript and one backend language with relational databases.',
      'Intermediate: End-to-end app architecture, auth flows, and CI/CD basics.',
      'Advanced: Scalability, cross-team architecture decisions, and production reliability.',
    ],
    coreSkills: [
      'Frontend and backend development workflow',
      'API integration and state management',
      'Database design and migrations',
      'Secure authentication and authorization',
      'Deployment, logging, and incident troubleshooting',
    ],
    tools: ['React + Node.js (or equivalent stack)', 'PostgreSQL/MongoDB', 'Docker', 'GitHub Actions', 'Cloud hosting (AWS/Azure/GCP)'],
    projects: [
      'Full SaaS app with auth, billing simulation, and dashboard',
      'Learning management or booking platform with admin panel',
      'Real-time collaboration app (chat/notifications)',
      'Portfolio CMS with analytics and A/B testing',
    ],
    advancedTopics: ['Monolith vs microservices decisions', 'Domain-driven design basics', 'Performance and cost optimization'],
    portfolioPlan: ['Create 2-3 end-to-end products with deployment links', 'Document architecture and scaling decisions', 'Show measurable product outcomes and user metrics'],
    certifications: ['AWS Cloud Practitioner (optional)', 'Meta Full-Stack Certificate (optional)'],
    jobPreparation: ['Practice mixed frontend/backend interview rounds', 'Prepare architecture walkthroughs', 'Demonstrate ownership from idea to deployment'],
    specializationPaths: ['Technical Product Engineer', 'Startup Generalist Engineer', 'Solutions Engineer'],
  },
  {
    canonicalRole: 'DevOps Engineer',
    aliases: ['devops engineer', 'devops', 'site reliability engineer', 'sre', 'platform engineer'],
    roleOverview: 'Automate infrastructure and delivery pipelines to improve reliability and velocity.',
    fundamentals: [
      'Beginner: Linux, networking, Git, and scripting (Bash/Python).',
      'Intermediate: CI/CD pipelines, containerization, and IaC.',
      'Advanced: Kubernetes operations, observability, incident management, and scalability planning.',
    ],
    coreSkills: ['Infrastructure as Code', 'Container orchestration', 'CI/CD automation', 'Monitoring and alerting', 'Cloud security and cost governance'],
    tools: ['Docker', 'Kubernetes', 'Terraform', 'GitHub Actions/Jenkins', 'Prometheus/Grafana', 'AWS/Azure/GCP'],
    projects: [
      'Automated CI/CD pipeline for multi-service application',
      'Infrastructure provisioning with Terraform modules',
      'Monitoring stack with SLO/SLA dashboards and alerts',
      'Blue/green or canary deployment demonstration',
    ],
    advancedTopics: ['Service mesh basics', 'Disaster recovery design', 'Chaos engineering fundamentals', 'Security hardening and secrets management'],
    portfolioPlan: ['Share reproducible infra repos and deployment docs', 'Add postmortem and incident response samples', 'Track uptime and release metrics'],
    certifications: ['AWS DevOps Engineer Professional (optional)', 'CKA/CKAD (optional)'],
    jobPreparation: ['Practice scenario-based reliability interviews', 'Explain trade-offs between speed, cost, and reliability', 'Show infra diagrams and runbooks'],
    specializationPaths: ['Platform Reliability Engineer', 'Cloud Security DevOps', 'Infrastructure Automation Specialist'],
  },
  {
    canonicalRole: 'AI Engineer',
    aliases: ['ai engineer', 'machine learning engineer', 'ml engineer', 'artificial intelligence engineer'],
    roleOverview: 'Build and deploy intelligent systems using machine learning and AI workflows.',
    fundamentals: [
      'Beginner: Python, linear algebra, probability, statistics, and data preprocessing.',
      'Intermediate: Supervised/unsupervised learning, model evaluation, and feature engineering.',
      'Advanced: MLOps, model deployment, LLM applications, and responsible AI practices.',
    ],
    coreSkills: ['Model training and evaluation', 'Data pipeline design', 'Experiment tracking', 'Model deployment and monitoring', 'Prompt engineering and AI safety basics'],
    tools: ['Python', 'scikit-learn', 'PyTorch/TensorFlow', 'Pandas', 'MLflow', 'FastAPI', 'Docker'],
    projects: [
      'End-to-end predictive model with deployment API',
      'Recommendation or classification engine with dashboard',
      'RAG/LLM assistant with retrieval and evaluation',
      'Model monitoring pipeline for drift detection',
    ],
    advancedTopics: ['Distributed training basics', 'Model optimization and quantization', 'LLM fine-tuning strategies', 'Ethics, bias, and fairness evaluation'],
    portfolioPlan: ['Publish reproducible notebooks and productionized services', 'Document metrics, baselines, and iteration logs', 'Create model cards and risk considerations'],
    certifications: ['Google Professional ML Engineer (optional)', 'Azure AI Engineer Associate (optional)'],
    jobPreparation: ['Practice ML case studies and coding rounds', 'Prepare deep dives on model decisions', 'Explain business impact of model improvements'],
    specializationPaths: ['NLP Engineer', 'Computer Vision Engineer', 'MLOps Engineer'],
  },
  {
    canonicalRole: 'Data Scientist',
    aliases: ['data scientist', 'data science', 'applied data scientist', 'machine learning scientist'],
    roleOverview: 'Extract insights, build predictive models, and communicate data-driven recommendations for business impact.',
    fundamentals: [
      'Beginner: Python, SQL, statistics, probability, and data cleaning workflows.',
      'Intermediate: Feature engineering, model selection, and rigorous evaluation metrics.',
      'Advanced: Experiment design, causal thinking, production model monitoring, and stakeholder storytelling.',
    ],
    coreSkills: ['Exploratory data analysis', 'Statistical inference', 'Machine learning modeling', 'Experimentation and hypothesis testing', 'Insight communication and business framing'],
    tools: ['Python', 'SQL', 'Pandas/NumPy', 'scikit-learn', 'Jupyter', 'Tableau/Power BI', 'MLflow'],
    projects: [
      'Customer churn prediction with explainability report',
      'Demand forecasting pipeline with model comparison',
      'A/B experiment analysis with actionable recommendations',
      'End-to-end data science case study with deployment demo',
    ],
    advancedTopics: ['Time-series modeling', 'Causal inference basics', 'Model interpretability and fairness', 'Data drift detection and retraining strategy'],
    portfolioPlan: ['Publish 3-4 case studies with business context', 'Include notebooks plus productionized scripts', 'Highlight measurable impact and decision outcomes'],
    certifications: ['IBM Data Science (optional)', 'Google Advanced Data Analytics (optional)', 'Azure Data Scientist Associate (optional)'],
    jobPreparation: ['Practice SQL + statistics + ML interviews', 'Prepare business storytelling around model impact', 'Walk through trade-offs in modeling choices and evaluation'],
    specializationPaths: ['NLP-focused Data Scientist', 'Experimentation Scientist', 'Product Data Scientist'],
  },
  {
    canonicalRole: 'Data Analyst',
    aliases: ['data analyst', 'business data analyst', 'bi analyst', 'analytics analyst'],
    roleOverview: 'Turn data into business insights, dashboards, and decision-ready narratives.',
    fundamentals: [
      'Beginner: SQL, spreadsheet analysis, and descriptive statistics.',
      'Intermediate: BI dashboards, cohort/funnel analysis, and experimentation basics.',
      'Advanced: Forecasting fundamentals, stakeholder storytelling, and analytics engineering collaboration.',
    ],
    coreSkills: ['SQL querying and data cleaning', 'Data visualization and dashboard design', 'KPI and metric design', 'A/B testing analysis', 'Insight communication'],
    tools: ['SQL', 'Excel/Google Sheets', 'Power BI/Tableau/Looker', 'Python (Pandas)', 'dbt basics'],
    projects: [
      'Sales or product performance dashboard with drill-downs',
      'Customer retention and churn analysis report',
      'A/B test evaluation with clear recommendations',
      'Executive-ready analytics case study deck',
    ],
    advancedTopics: ['Data modeling for analytics', 'Metric governance', 'Experimentation design quality', 'Forecasting and anomaly detection'],
    portfolioPlan: ['Build dashboard portfolio with business context', 'Write concise analysis memos and recommendations', 'Demonstrate stakeholder communication artifacts'],
    certifications: ['Google Data Analytics (optional)', 'Microsoft PL-300 (optional)'],
    jobPreparation: ['Practice SQL + analytics case interviews', 'Prepare business storytelling examples', 'Show measurable impact from your analysis'],
    specializationPaths: ['Product Analyst', 'Marketing Analyst', 'Analytics Engineer'],
  },
  {
    canonicalRole: 'QA Engineer',
    aliases: ['qa engineer', 'qa', 'quality assurance engineer', 'test engineer', 'software tester', 'automation tester'],
    roleOverview: 'Ensure product quality through strategic testing, automation, and release confidence.',
    fundamentals: [
      'Beginner: Testing fundamentals, bug lifecycle, and manual test design.',
      'Intermediate: Automated test frameworks, API testing, and CI integration.',
      'Advanced: Test architecture, performance/security testing, and quality strategy leadership.',
    ],
    coreSkills: ['Test planning and risk-based testing', 'UI/API automation', 'Defect triage and root-cause communication', 'Regression strategy', 'Quality metrics and release readiness'],
    tools: ['Selenium/Playwright/Cypress', 'Postman', 'JMeter/k6', 'JUnit/PyTest', 'TestRail/Jira', 'GitHub Actions'],
    projects: [
      'Automation suite for critical product workflows',
      'API contract and regression validation pipeline',
      'Performance test benchmark for key endpoints',
      'Quality dashboard tracking defect leakage and stability',
    ],
    advancedTopics: ['Shift-left testing in CI/CD', 'Test data management', 'Security testing collaboration', 'Flaky test reduction strategies'],
    portfolioPlan: ['Show automation repos and coverage reports', 'Share bug investigation write-ups', 'Document quality impact and release improvements'],
    certifications: ['ISTQB Foundation (optional)', 'Certified Selenium Tester (optional)'],
    jobPreparation: ['Practice test-case design interviews', 'Demonstrate debugging and triage process', 'Prepare quality strategy discussion examples'],
    specializationPaths: ['SDET', 'Performance Test Engineer', 'Quality Architect'],
  },
  {
    canonicalRole: 'Software Architect',
    aliases: ['software architect', 'solution architect', 'technical architect', 'systems architect', 'architect'],
    roleOverview: 'Design scalable systems and guide engineering teams through architectural decisions.',
    fundamentals: [
      'Beginner: Strong software engineering background and clean code principles.',
      'Intermediate: System design patterns, domain modeling, and API contracts.',
      'Advanced: Enterprise architecture, scalability governance, and technical leadership.',
    ],
    coreSkills: ['Architecture documentation', 'System design and trade-off analysis', 'Scalability and reliability planning', 'Security-by-design', 'Cross-team technical communication'],
    tools: ['C4 diagrams', 'ADR templates', 'Cloud architecture tools', 'Observability stacks', 'Threat modeling frameworks'],
    projects: [
      'Architecture blueprint for a multi-service platform',
      'Migration plan from monolith to modular architecture',
      'Reference architecture with scalability and resilience patterns',
      'Security and compliance architecture review report',
    ],
    advancedTopics: ['Event-driven architecture', 'Data consistency models', 'Governance and platform standards', 'Architecture fitness functions'],
    portfolioPlan: ['Publish architecture case studies and ADRs', 'Show measurable improvements from architecture changes', 'Highlight mentoring and design review outcomes'],
    certifications: ['AWS Solutions Architect Professional (optional)', 'TOGAF (optional)'],
    jobPreparation: ['Practice architecture whiteboard interviews', 'Prepare trade-off narratives from real systems', 'Demonstrate leadership in technical decision-making'],
    specializationPaths: ['Enterprise Architect', 'Cloud Architect', 'Platform Architect'],
  },
  {
    canonicalRole: 'Cyber Security Engineer',
    aliases: ['cyber security engineer', 'cybersecurity engineer', 'cyber security', 'cybersecurity', 'security engineer', 'information security engineer'],
    roleOverview: 'Protect systems and applications through proactive security engineering and incident readiness.',
    fundamentals: [
      'Beginner: Networking, operating systems, and basic security principles.',
      'Intermediate: Secure coding, vulnerability management, and SOC fundamentals.',
      'Advanced: Threat modeling, cloud security architecture, and incident response operations.',
    ],
    coreSkills: ['Security assessment and hardening', 'Identity and access management', 'Threat detection and response', 'Application security testing', 'Security automation'],
    tools: ['Wireshark', 'Burp Suite', 'SIEM platforms', 'OWASP ZAP', 'Splunk', 'Cloud security tooling'],
    projects: [
      'Security audit and remediation plan for web app',
      'Threat detection pipeline with alert workflows',
      'Secure CI/CD pipeline with scanning gates',
      'Incident response tabletop and post-incident report',
    ],
    advancedTopics: ['Zero trust architecture', 'Cloud threat modeling', 'Red vs blue team collaboration', 'Compliance mapping (ISO/NIST)'],
    portfolioPlan: ['Document security findings and remediation impact', 'Show security automation scripts/playbooks', 'Share CTF or lab challenge write-ups'],
    certifications: ['Security+ (optional)', 'CEH/CySA+ (optional)', 'AZ-500 (optional)'],
    jobPreparation: ['Practice security scenario interviews', 'Explain attack paths and mitigation plans', 'Prepare incident communication examples'],
    specializationPaths: ['Application Security Engineer', 'Cloud Security Engineer', 'Detection Engineering Specialist'],
  },
  {
    canonicalRole: 'UX Designer',
    aliases: ['ux designer', 'ux', 'ui ux', 'user experience designer', 'product designer', 'ui ux designer', 'ui designer'],
    roleOverview: 'Design intuitive, accessible digital experiences grounded in user research and business goals.',
    fundamentals: [
      'Beginner: Design principles, information architecture, and user research basics.',
      'Intermediate: Interaction design, prototyping, usability testing, and accessibility.',
      'Advanced: Design systems, experimentation, and cross-functional design leadership.',
    ],
    coreSkills: ['User research and synthesis', 'Wireframing and prototyping', 'Interaction and visual design', 'Usability testing', 'Design communication and storytelling'],
    tools: ['Figma', 'FigJam/Miro', 'Maze/UserTesting', 'Notion/Docs for research', 'Accessibility audit tools'],
    projects: [
      'End-to-end redesign case study of a complex workflow',
      'Mobile app UX concept with prototyping and testing',
      'Component-based design system starter',
      'Accessibility and usability improvement audit',
    ],
    advancedTopics: ['Design ops practices', 'Behavioral design principles', 'Data-informed design experiments', 'Inclusive design methods'],
    portfolioPlan: ['Publish 3-4 deep UX case studies', 'Show research insights to final decisions', 'Include measurable UX outcomes and iteration history'],
    certifications: ['Google UX Design (optional)', 'NN/g UX courses (optional)'],
    jobPreparation: ['Practice whiteboard and portfolio presentation interviews', 'Prepare rationale for design trade-offs', 'Demonstrate collaboration with engineers and PMs'],
    specializationPaths: ['Product Designer', 'UX Researcher', 'Design System Designer'],
  },
];

const NON_TECH_ROLE_PATTERN = /\b(doctor|nurse|lawyer|accountant|chef|pilot|pharmacist|dentist|civil\s+service|government\s+officer|police|soldier|architectural\s+engineer|fashion\s+designer|content\s+creator|actor|singer|athlete)\b/i;
const TECH_ROLE_HINT_PATTERN = /\b(developer|engineer|architect|analyst|scientist|devops|sre|qa|tester|security|cyber|ux|ui|data|ai|ml|software|cloud|network|frontend|backend|full\s*stack|web|mobile|it)\b/i;
const ROLE_FILLER_PATTERN = /\b(roadmap|career|path|future|role|roles|please|show|me|give|need|want|what|about|for|to|become|as|an|a|i|my|in|the|field|of|towards|toward)\b/gi;

type ResolvedRoadmapRole = {
  profile: RoadmapRoleProfile;
  requestedRole: string;
};

const formatRoleLabel = (value: string): string => {
  const acronymMap: Record<string, string> = {
    ai: 'AI',
    ml: 'ML',
    qa: 'QA',
    ui: 'UI',
    ux: 'UX',
    it: 'IT',
    sre: 'SRE',
    devops: 'DevOps',
  };

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase();
      if (acronymMap[lower]) {
        return acronymMap[lower];
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeRoleText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s/+\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeRequestedRole = (value: string): string =>
  normalizeRoleText(value)
    .replace(ROLE_FILLER_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const createGenericTechRoleProfile = (role: string): RoadmapRoleProfile => {
  const safeRole = role || 'Technology Professional';
  return {
    canonicalRole: safeRole,
    aliases: [safeRole.toLowerCase()],
    roleOverview: `Develop the technical and problem-solving capabilities needed to become a strong ${safeRole}.`,
    fundamentals: [
      'Beginner: Learn programming fundamentals, computer systems basics, and version control.',
      'Intermediate: Build production-like projects, collaborate with APIs/databases, and strengthen debugging.',
      'Advanced: Focus on architecture, performance, and role-specific specialization depth.',
    ],
    coreSkills: ['Problem solving and algorithms', 'Clean coding and software design', 'System-level thinking', 'Testing and quality habits', 'Technical communication'],
    tools: ['Git/GitHub', 'Primary programming language stack for this role', 'Cloud basics', 'Testing tools', 'Documentation tools'],
    projects: [
      'One beginner project to build confidence',
      'One intermediate project with real-world workflows',
      'One advanced capstone project with measurable outcomes',
      'One collaboration/open-source contribution',
    ],
    advancedTopics: ['Scalability and performance basics', 'Security fundamentals', 'Automation and CI/CD basics', 'Role-specific advanced patterns'],
    portfolioPlan: ['Publish project case studies with architecture notes', 'Track learning milestones monthly', 'Add certifications or challenge badges relevant to the role'],
    certifications: ['Choose 1-2 recognized certifications relevant to your stack and target role'],
    jobPreparation: ['Practice role-specific interview questions weekly', 'Prepare resume and LinkedIn around project impact', 'Conduct mock interviews and improve communication clarity'],
    specializationPaths: ['Choose one domain specialization after strong fundamentals', 'Pick one tooling specialization for career leverage'],
  };
};

const extractTargetRole = (message: string): string => {
  for (const pattern of TARGET_ROLE_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }

  const compact = message.trim().replace(/\s+/g, ' ');
  if (!compact) {
    return '';
  }

  return compact.length > 80 ? compact.slice(0, 80).trim() : compact;
};

const findRoadmapProfileByAlias = (text: string): RoadmapRoleProfile | null => {
  const normalized = normalizeRoleText(text);
  if (!normalized) {
    return null;
  }

  let bestMatch: { profile: RoadmapRoleProfile; aliasLength: number } | null = null;

  for (const profile of ROADMAP_ROLE_PROFILES) {
    for (const alias of profile.aliases) {
      const aliasPattern = new RegExp(`\\b${escapeRegex(normalizeRoleText(alias)).replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (!aliasPattern.test(normalized)) {
        continue;
      }

      const aliasLength = normalizeRoleText(alias).length;
      if (!bestMatch || aliasLength > bestMatch.aliasLength) {
        bestMatch = {
          profile,
          aliasLength,
        };
      }
    }
  }

  return bestMatch?.profile || null;
};

const resolveRoadmapRoleProfile = (message: string, extractedRole: string): ResolvedRoadmapRole | null => {
  const cleanedExtractedRole = normalizeRequestedRole(extractedRole);
  const cleanedMessageRole = normalizeRequestedRole(message);

  const profileFromExtractedRole = findRoadmapProfileByAlias(cleanedExtractedRole);
  if (profileFromExtractedRole) {
    return {
      profile: profileFromExtractedRole,
      requestedRole: profileFromExtractedRole.canonicalRole,
    };
  }

  const profileFromMessage = findRoadmapProfileByAlias(cleanedMessageRole);
  if (profileFromMessage) {
    return {
      profile: profileFromMessage,
      requestedRole: profileFromMessage.canonicalRole,
    };
  }

  const roleCandidate = cleanedExtractedRole || cleanedMessageRole;
  if (!roleCandidate) {
    return null;
  }

  if (NON_TECH_ROLE_PATTERN.test(roleCandidate) && !TECH_ROLE_HINT_PATTERN.test(roleCandidate)) {
    return null;
  }

  if (TECH_ROLE_HINT_PATTERN.test(roleCandidate)) {
    const requestedRole = formatRoleLabel(roleCandidate);
    return {
      profile: createGenericTechRoleProfile(requestedRole || 'Technology Professional'),
      requestedRole: requestedRole || 'Technology Professional',
    };
  }

  return null;
};

const isStructuredRoadmap = (reply: string): boolean => {
  const normalized = String(reply || '').replace(/\r\n?/g, '\n');
  const hasStages = /beginner|intermediate|advanced/i.test(normalized);
  const hasReasonableLength = normalized.length >= 700;
  const hasProjects = /project/i.test(normalized);

  return ROADMAP_SECTION_HEADERS.every((header) => normalized.includes(header)) && hasStages && hasReasonableLength && hasProjects;
};

const buildRoadmapFallback = (profile: RoadmapRoleProfile, userRole: string): string => {
  const resolvedRole = userRole || profile.canonicalRole;

  const bulletList = (items: string[]) => items.map((item) => `   • ${item}`).join('\n');

  return [
    `Great goal. Here is a detailed roadmap to become a ${resolvedRole}.`,
    '',
    '1. Career Goal',
    `   • Target Role: ${resolvedRole}`,
    `   • Role Overview: ${profile.roleOverview}`,
    '   • Outcome: Build job-ready skills, projects, and interview confidence.',
    '',
    '2. What You Need to Learn First',
    bulletList(profile.fundamentals),
    '',
    '3. Core Skills',
    bulletList(profile.coreSkills),
    '',
    '4. Tools / Technologies',
    bulletList(profile.tools),
    '',
    '5. Projects to Build',
    bulletList(profile.projects),
    '',
    '6. Advanced Topics',
    bulletList([
      ...profile.advancedTopics,
      `Optional Specialization Paths: ${profile.specializationPaths.join(', ')}`,
    ]),
    '',
    '7. Portfolio / Experience Plan',
    bulletList([
      ...profile.portfolioPlan,
      `Certification Suggestions: ${profile.certifications.join('; ')}`,
    ]),
    '',
    '8. Job Preparation',
    bulletList(profile.jobPreparation),
    '',
    '👉 Start this week by selecting one beginner milestone and one project deliverable, then track progress every 7 days.',
  ].join('\n');
};

export class FaqChatbotService {
  private async getPlatformReply(sanitizedMessage: string, context: FaqChatContext): Promise<string> {
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

  private async getAskLearnReply(sanitizedMessage: string, context: FaqChatContext): Promise<string> {
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

  private async getRoadmapReply(sanitizedMessage: string, context: FaqChatContext): Promise<string> {
    const safeContext = toSafeContext(context);
    const targetRole = extractTargetRole(sanitizedMessage);
    const resolvedRole = resolveRoadmapRoleProfile(sanitizedMessage, targetRole);

    if (!resolvedRole) {
      if (NON_TECH_ROLE_PATTERN.test(sanitizedMessage)) {
        return ROADMAP_OUT_OF_SCOPE_MESSAGE;
      }

      if (!isRoadmapRequest(sanitizedMessage) && !TECH_ROLE_HINT_PATTERN.test(sanitizedMessage)) {
        return ROADMAP_OUT_OF_SCOPE_MESSAGE;
      }

      return ROADMAP_OUT_OF_SCOPE_MESSAGE;
    }

    const { profile: roleProfile, requestedRole } = resolvedRole;
    const roadmapFallback = buildRoadmapFallback(roleProfile, requestedRole || roleProfile.canonicalRole);
    const composedUserPrompt = [
      'You are operating in Roadmap Finder mode.',
      'Treat this request as a fresh roadmap request. Do not reuse any previous role context.',
      `UserContext: ${JSON.stringify(safeContext)}`,
      `TargetRole: ${requestedRole}`,
      `RoleProfile: ${JSON.stringify(roleProfile)}`,
      `UserRequest: ${sanitizedMessage}`,
      `Use exactly these section headers: ${ROADMAP_SECTION_HEADERS.join(' | ')}`,
      'The response must be detailed, actionable, and include beginner, intermediate, and advanced progression.',
      'Include concrete projects, tools, portfolio/certification suggestions, job preparation, and optional specialization paths.',
    ].join('\n\n');

    const rawReply = await azureOpenAiClient.chat(
      [
        {
          role: 'system',
          content: ROADMAP_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: composedUserPrompt,
        },
      ],
      {
        temperature: 0.35,
        maxTokens: 900,
      }
    );

    const safeReply = sanitizeAssistantReply(rawReply);
    if (!safeReply) {
      return roadmapFallback;
    }

    if (!isStructuredRoadmap(safeReply)) {
      return roadmapFallback;
    }

    return safeReply;
  }

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
      return this.getAskLearnReply(sanitizedMessage, context);
    }

    if (mode === 'roadmap_finder') {
      return this.getRoadmapReply(sanitizedMessage, context);
    }

    return this.getPlatformReply(sanitizedMessage, context);
  }
}

export const faqChatbotService = new FaqChatbotService();
