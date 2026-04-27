import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  ROADMAP_OUT_OF_SCOPE_MESSAGE,
  ROADMAP_SYSTEM_PROMPT,
} from './promptRules.js';
import {
  isRoadmapRequest,
  sanitizeAssistantReply,
} from '../faq-chatbot/security.js';
import { toSafeContext } from '../faq-chatbot/context.js';
import { FaqChatContext } from '../faq-chatbot/types.js';

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
  '9. Trusted Resources',
];

type TrustedResource = {
  title: string;
  reason: string;
  url: string;
};

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
  const avoidsOpenEndedEnding = !/if you want,\s*i can/i.test(normalized);
  const trustedResourcesSectionMatch = normalized.match(/9\.\s*Trusted Resources\s*\n([\s\S]*)$/i);
  const trustedResourcesSection = trustedResourcesSectionMatch?.[1] || '';
  const trustedResourceLines = trustedResourcesSection
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter((line) => /^[^:\n]+ — [^:\n].*:\s*https?:\/\/\S+$/i.test(line));
  const hasTrustedResources = trustedResourceLines.length >= 5 && trustedResourceLines.length <= 8;

  return ROADMAP_SECTION_HEADERS.every((header) => normalized.includes(header))
    && hasStages
    && hasReasonableLength
    && hasProjects
    && hasTrustedResources
    && avoidsOpenEndedEnding;
};

const formatTrustedResourceLine = (resource: TrustedResource): string =>
  `${resource.title} — ${resource.reason}: ${resource.url}`;

const getTrustedResourcesForRole = (profile: RoadmapRoleProfile, userRole: string): TrustedResource[] => {
  const normalizedRole = (userRole || profile.canonicalRole).toLowerCase();

  if (/devops|site reliability|sre|platform|cloud/.test(normalizedRole)) {
    return [
      {
        title: 'Kubernetes Documentation',
        reason: 'Official guide for deploying, operating, and troubleshooting Kubernetes workloads',
        url: 'https://kubernetes.io/docs/',
      },
      {
        title: 'Docker Docs',
        reason: 'Authoritative reference for container fundamentals, image builds, and runtime operations',
        url: 'https://docs.docker.com/',
      },
      {
        title: 'Terraform Documentation',
        reason: 'Primary source for infrastructure-as-code workflows and reusable provisioning patterns',
        url: 'https://developer.hashicorp.com/terraform/docs',
      },
      {
        title: 'AWS Training and Certification',
        reason: 'Role-based cloud operations paths aligned with DevOps and reliability practice',
        url: 'https://aws.amazon.com/training/',
      },
      {
        title: 'Google SRE Book',
        reason: 'Long-form engineering guidance on reliability principles and operational excellence',
        url: 'https://sre.google/books/',
      },
      {
        title: 'Linux Foundation Training',
        reason: 'Hands-on Linux and cloud-native training suited for production platform engineering',
        url: 'https://training.linuxfoundation.org/',
      },
    ];
  }

  if (/data scientist|machine learning|ml engineer|ai engineer/.test(normalizedRole)) {
    return [
      {
        title: 'Python Documentation',
        reason: 'Official language reference for production-quality Python used across data and ML stacks',
        url: 'https://docs.python.org/3/',
      },
      {
        title: 'scikit-learn User Guide',
        reason: 'Trusted ML reference for model selection, evaluation, and practical algorithms',
        url: 'https://scikit-learn.org/stable/user_guide.html',
      },
      {
        title: 'PyTorch Tutorials',
        reason: 'Official deep learning tutorials with reproducible code and model training workflows',
        url: 'https://pytorch.org/tutorials/',
      },
      {
        title: 'Coursera Machine Learning Specialization',
        reason: 'Structured, high-quality pathway for core ML theory and applied implementation',
        url: 'https://www.coursera.org/specializations/machine-learning-introduction',
      },
      {
        title: "Hands-On Machine Learning (Aurelien Geron)",
        reason: 'Book plus companion notebooks that bridge theory and practical model development',
        url: 'https://github.com/ageron/handson-ml3',
      },
      {
        title: 'Google AI Engineering Blog',
        reason: 'Long-form engineering insights on modern ML systems and research-to-production practices',
        url: 'https://ai.googleblog.com/',
      },
    ];
  }

  if (/data analyst|analytics/.test(normalizedRole)) {
    return [
      {
        title: 'Microsoft Learn Data Analyst Paths',
        reason: 'Role-focused analytics learning tracks covering data modeling, dashboards, and reporting',
        url: 'https://learn.microsoft.com/training/career-paths/data-analyst/',
      },
      {
        title: 'Python Documentation',
        reason: 'Official reference for reliable scripting and analysis workflows with Python',
        url: 'https://docs.python.org/3/',
      },
      {
        title: 'Pandas Documentation',
        reason: 'Authoritative guide for data cleaning, transformation, and analysis pipelines',
        url: 'https://pandas.pydata.org/docs/',
      },
      {
        title: 'Kaggle Learn',
        reason: 'Hands-on mini-courses for SQL, data analysis, and practical model-driven insights',
        url: 'https://www.kaggle.com/learn',
      },
      {
        title: 'Google Data Analytics Certificate',
        reason: 'Structured entry path for analytics fundamentals, SQL, and dashboard storytelling',
        url: 'https://www.coursera.org/professional-certificates/google-data-analytics',
      },
      {
        title: 'Designing Data-Intensive Applications',
        reason: 'Foundational systems thinking that strengthens data modeling and reliability decisions',
        url: 'https://dataintensive.net/',
      },
    ];
  }

  if (/cyber|security/.test(normalizedRole)) {
    return [
      {
        title: 'OWASP Top 10',
        reason: 'Industry-standard web application risk reference for secure engineering priorities',
        url: 'https://owasp.org/www-project-top-ten/',
      },
      {
        title: 'NIST Cybersecurity Framework',
        reason: 'Authoritative framework for building and maturing security programs and controls',
        url: 'https://www.nist.gov/cyberframework',
      },
      {
        title: 'MITRE ATT&CK',
        reason: 'Trusted knowledge base for adversary tactics and defensive detection planning',
        url: 'https://attack.mitre.org/',
      },
      {
        title: 'CompTIA Security+',
        reason: 'Widely recognized certification baseline for foundational security competencies',
        url: 'https://www.comptia.org/certifications/security',
      },
      {
        title: 'Cisco Networking Academy Cybersecurity',
        reason: 'Structured training content for practical security operations and network defense',
        url: 'https://www.netacad.com/courses/cybersecurity',
      },
      {
        title: 'Google Cloud Security Best Practices',
        reason: 'Long-form guidance for securing cloud workloads with modern controls and architecture',
        url: 'https://cloud.google.com/security/best-practices',
      },
    ];
  }

  if (/qa|quality assurance|test/.test(normalizedRole)) {
    return [
      {
        title: 'Playwright Documentation',
        reason: 'Official automation reference for robust end-to-end browser testing workflows',
        url: 'https://playwright.dev/docs/intro',
      },
      {
        title: 'Cypress Documentation',
        reason: 'Authoritative test framework guide for modern frontend and API testing setups',
        url: 'https://docs.cypress.io/',
      },
      {
        title: 'Selenium Documentation',
        reason: 'Core reference for cross-browser UI automation and legacy enterprise test stacks',
        url: 'https://www.selenium.dev/documentation/',
      },
      {
        title: 'ISTQB Certifications',
        reason: 'Recognized quality-assurance certification paths for test design and process rigor',
        url: 'https://www.istqb.org/certifications/',
      },
      {
        title: 'Test Automation University',
        reason: 'High-quality practical courses for automation frameworks and quality engineering',
        url: 'https://testautomationu.applitools.com/',
      },
      {
        title: 'k6 Documentation',
        reason: 'Official guide for performance testing and reproducible load-testing scripts',
        url: 'https://k6.io/docs/',
      },
    ];
  }

  if (/ux|ui|designer|product designer/.test(normalizedRole)) {
    return [
      {
        title: 'Nielsen Norman Group Articles',
        reason: 'Respected UX research and design guidance for evidence-based product decisions',
        url: 'https://www.nngroup.com/articles/',
      },
      {
        title: 'Figma Help Center',
        reason: 'Official documentation for prototyping, design systems, and collaboration workflows',
        url: 'https://help.figma.com/',
      },
      {
        title: 'Google UX Design Certificate',
        reason: 'Structured UX path covering research, wireframing, prototyping, and portfolio work',
        url: 'https://www.coursera.org/professional-certificates/google-ux-design',
      },
      {
        title: 'Smashing Magazine UX',
        reason: 'High-quality long-form UX and interface design guides from experienced practitioners',
        url: 'https://www.smashingmagazine.com/category/uxdesign',
      },
      {
        title: 'WCAG Quick Reference',
        reason: 'Authoritative accessibility standard to ensure inclusive interaction and interface design',
        url: 'https://www.w3.org/WAI/WCAG22/quickref/',
      },
      {
        title: 'Material Design Guidelines',
        reason: 'Comprehensive design system reference for components, patterns, and usability consistency',
        url: 'https://m3.material.io/',
      },
    ];
  }

  if (/software architect|solution architect|architect/.test(normalizedRole)) {
    return [
      {
        title: 'C4 Model',
        reason: 'Clear architecture diagramming method for communicating systems at multiple abstraction levels',
        url: 'https://c4model.com/',
      },
      {
        title: 'AWS Architecture Center',
        reason: 'Official architecture patterns and reference designs for scalable cloud systems',
        url: 'https://aws.amazon.com/architecture/',
      },
      {
        title: 'Azure Architecture Center',
        reason: 'Authoritative Microsoft guidance for cloud architecture decisions and trade-offs',
        url: 'https://learn.microsoft.com/azure/architecture/',
      },
      {
        title: 'Google Cloud Architecture Framework',
        reason: 'Best-practice framework for reliability, security, and operational excellence in cloud designs',
        url: 'https://cloud.google.com/architecture/framework',
      },
      {
        title: 'Designing Data-Intensive Applications',
        reason: 'Foundational book for distributed systems architecture and data consistency decisions',
        url: 'https://dataintensive.net/',
      },
      {
        title: 'Martin Fowler Architecture Guides',
        reason: 'Long-form software architecture insights on patterns, refactoring, and system evolution',
        url: 'https://martinfowler.com/architecture/',
      },
    ];
  }

  if (/frontend|front end|web frontend|ui developer/.test(normalizedRole)) {
    return [
      {
        title: 'MDN Web Docs',
        reason: 'Comprehensive, authoritative reference for HTML, CSS, JavaScript, and browser APIs',
        url: 'https://developer.mozilla.org/',
      },
      {
        title: 'React Documentation',
        reason: 'Official source for modern component architecture and production frontend patterns',
        url: 'https://react.dev/',
      },
      {
        title: 'TypeScript Handbook',
        reason: 'Authoritative guide for safer, scalable frontend codebases and tooling workflows',
        url: 'https://www.typescriptlang.org/docs/',
      },
      {
        title: 'web.dev Learn Performance',
        reason: 'Google engineering guidance for improving Core Web Vitals and runtime efficiency',
        url: 'https://web.dev/learn/performance/',
      },
      {
        title: "You Don't Know JS Yet (Kyle Simpson)",
        reason: 'Deep JavaScript reference book with free, reproducible source material',
        url: 'https://github.com/getify/You-Dont-Know-JS',
      },
      {
        title: 'freeCodeCamp Frontend Curriculum',
        reason: 'Project-based learning path for responsive design, JavaScript, and frontend libraries',
        url: 'https://www.freecodecamp.org/learn/',
      },
    ];
  }

  if (/backend/.test(normalizedRole)) {
    return [
      {
        title: 'Node.js Documentation',
        reason: 'Official reference for backend runtime behavior, APIs, and production best practices',
        url: 'https://nodejs.org/docs/latest/api/',
      },
      {
        title: 'Python Documentation',
        reason: 'Authoritative language reference useful for backend services and automation',
        url: 'https://docs.python.org/3/',
      },
      {
        title: 'PostgreSQL Documentation',
        reason: 'Primary source for relational modeling, performance tuning, and SQL features',
        url: 'https://www.postgresql.org/docs/',
      },
      {
        title: 'OpenAPI Specification',
        reason: 'Standard API contract format for designing clear and interoperable backend interfaces',
        url: 'https://spec.openapis.org/oas/latest.html',
      },
      {
        title: 'Docker Docs',
        reason: 'Core deployment reference for packaging and running backend services consistently',
        url: 'https://docs.docker.com/',
      },
      {
        title: 'Designing Data-Intensive Applications',
        reason: 'High-signal systems book for scalability, consistency, and reliability architecture decisions',
        url: 'https://dataintensive.net/',
      },
    ];
  }

  if (/full stack/.test(normalizedRole)) {
    return [
      {
        title: 'MDN Web Docs',
        reason: 'Comprehensive reference for frontend and web platform fundamentals used in full-stack development',
        url: 'https://developer.mozilla.org/',
      },
      {
        title: 'React Documentation',
        reason: 'Official source for modern component architecture and frontend application patterns',
        url: 'https://react.dev/',
      },
      {
        title: 'Node.js Documentation',
        reason: 'Authoritative backend runtime documentation for API and service implementation',
        url: 'https://nodejs.org/docs/latest/api/',
      },
      {
        title: 'PostgreSQL Documentation',
        reason: 'Reliable relational database reference for schema design and query optimization',
        url: 'https://www.postgresql.org/docs/',
      },
      {
        title: 'freeCodeCamp Full Stack Curriculum',
        reason: 'Practical project-based learning path spanning frontend, backend, and deployment',
        url: 'https://www.freecodecamp.org/learn/',
      },
      {
        title: 'AWS Training and Certification',
        reason: 'Cloud deployment and operations training aligned with end-to-end product ownership',
        url: 'https://aws.amazon.com/training/',
      },
    ];
  }

  return [
    {
      title: 'MDN Web Docs',
      reason: 'Comprehensive, authoritative reference for core web and JavaScript foundations',
      url: 'https://developer.mozilla.org/',
    },
    {
      title: 'freeCodeCamp Curriculum',
      reason: 'Hands-on project-based learning paths for practical engineering skill growth',
      url: 'https://www.freecodecamp.org/learn/',
    },
    {
      title: 'Microsoft Learn',
      reason: 'Role-based training modules that map well to real-world technology job pathways',
      url: 'https://learn.microsoft.com/training/',
    },
    {
      title: 'Coursera Career Certificates',
      reason: 'Structured university and industry-backed tracks for guided upskilling',
      url: 'https://www.coursera.org/career-academy',
    },
    {
      title: 'Designing Data-Intensive Applications',
      reason: 'Deep systems-thinking book for scalable, reliable software design decisions',
      url: 'https://dataintensive.net/',
    },
    {
      title: 'AWS Training and Certification',
      reason: 'Trusted cloud training and certification roadmap relevant across many technical roles',
      url: 'https://aws.amazon.com/training/',
    },
  ];
};

const buildRoadmapFallback = (profile: RoadmapRoleProfile, userRole: string): string => {
  const resolvedRole = userRole || profile.canonicalRole;

  const bulletList = (items: string[]) => items.map((item) => `   • ${item}`).join('\n');
  const trustedResources = getTrustedResourcesForRole(profile, resolvedRole)
    .slice(0, 8)
    .map(formatTrustedResourceLine);

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
    '9. Trusted Resources',
    ...trustedResources.map((resourceLine) => `   ${resourceLine}`),
  ].join('\n');
};

export class RoadmapFinderService {
  async getReply(sanitizedMessage: string, context: FaqChatContext = {}): Promise<string> {
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
      'Section 9 must be the final section titled exactly "9. Trusted Resources".',
      'Trusted Resources must contain 5 to 8 lines only, each in this exact format: Resource Title — One-sentence reason: URL',
      'Use only high-quality and authoritative resources relevant to the requested role; avoid random/low-quality blogs.',
      'Include TutorSphere local courses/resources only when relevant and available in platform context.',
      'Do not end with "If you want, I can...".',
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
}
