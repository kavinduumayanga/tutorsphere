import { Resource } from '../../models/Resource.js';
import { sanitizeUserInput } from '../faq-chatbot/security.js';
import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  TRUSTED_RESOURCES_ASSISTANT_NAME,
  TRUSTED_RESOURCES_GENERATE_PROMPT,
  TRUSTED_RESOURCES_SYSTEM_PROMPT,
} from './promptRules.js';
import {
  type GenerateTrustedResourcesInput,
  type GenerateTrustedResourcesResponse,
  type TrustedResourceItem,
} from './types.js';

const MIN_RESOURCES = 5;
const MAX_RESOURCES = 8;
const DEFAULT_TRUSTED_RESOURCE_URL = 'https://developer.mozilla.org/';
const URL_CHECK_TIMEOUT_MS = 6500;
const URL_REACHABILITY_CACHE = new Map<string, boolean>();

const TRUSTED_DOMAIN_PATTERNS = [
  /(^|\.)developer\.mozilla\.org$/i,
  /(^|\.)docs\.python\.org$/i,
  /(^|\.)python\.org$/i,
  /(^|\.)react\.dev$/i,
  /(^|\.)kubernetes\.io$/i,
  /(^|\.)docker\.com$/i,
  /(^|\.)developer\.hashicorp\.com$/i,
  /(^|\.)hashicorp\.com$/i,
  /(^|\.)aws\.amazon\.com$/i,
  /(^|\.)cloud\.google\.com$/i,
  /(^|\.)google\.com$/i,
  /(^|\.)learn\.microsoft\.com$/i,
  /(^|\.)microsoft\.com$/i,
  /(^|\.)freecodecamp\.org$/i,
  /(^|\.)coursera\.org$/i,
  /(^|\.)edx\.org$/i,
  /(^|\.)digitalocean\.com$/i,
  /(^|\.)smashingmagazine\.com$/i,
  /(^|\.)css-tricks\.com$/i,
  /(^|\.)github\.com$/i,
  /(^|\.)arxiv\.org$/i,
  /(^|\.)khanacademy\.org$/i,
  /(^|\.)oracle\.com$/i,
  /(^|\.)scikit-learn\.org$/i,
  /(^|\.)dataintensive\.net$/i,
  /(^|\.)oreilly\.com$/i,
  /(^|\.)netacad\.com$/i,
  /(^|\.)comptia\.org$/i,
  /(^|\.)linuxfoundation\.org$/i,
];

const TRUSTED_ROOT_FALLBACKS: Array<{ pattern: RegExp; fallbackUrl: string }> = [
  { pattern: /(^|\.)developer\.mozilla\.org$/i, fallbackUrl: 'https://developer.mozilla.org/' },
  { pattern: /(^|\.)docs\.python\.org$/i, fallbackUrl: 'https://docs.python.org/3/' },
  { pattern: /(^|\.)python\.org$/i, fallbackUrl: 'https://docs.python.org/3/' },
  { pattern: /(^|\.)react\.dev$/i, fallbackUrl: 'https://react.dev/' },
  { pattern: /(^|\.)kubernetes\.io$/i, fallbackUrl: 'https://kubernetes.io/docs/' },
  { pattern: /(^|\.)docker\.com$/i, fallbackUrl: 'https://docs.docker.com/' },
  { pattern: /(^|\.)developer\.hashicorp\.com$/i, fallbackUrl: 'https://developer.hashicorp.com/terraform/docs' },
  { pattern: /(^|\.)hashicorp\.com$/i, fallbackUrl: 'https://developer.hashicorp.com/terraform/docs' },
  { pattern: /(^|\.)aws\.amazon\.com$/i, fallbackUrl: 'https://aws.amazon.com/training/' },
  { pattern: /(^|\.)cloud\.google\.com$/i, fallbackUrl: 'https://cloud.google.com/learn/training' },
  { pattern: /(^|\.)learn\.microsoft\.com$/i, fallbackUrl: 'https://learn.microsoft.com/' },
  { pattern: /(^|\.)microsoft\.com$/i, fallbackUrl: 'https://learn.microsoft.com/' },
  { pattern: /(^|\.)freecodecamp\.org$/i, fallbackUrl: 'https://www.freecodecamp.org/learn/' },
  { pattern: /(^|\.)coursera\.org$/i, fallbackUrl: 'https://www.coursera.org/' },
  { pattern: /(^|\.)edx\.org$/i, fallbackUrl: 'https://www.edx.org/learn' },
  { pattern: /(^|\.)digitalocean\.com$/i, fallbackUrl: 'https://www.digitalocean.com/community/tutorials' },
  { pattern: /(^|\.)smashingmagazine\.com$/i, fallbackUrl: 'https://www.smashingmagazine.com/' },
  { pattern: /(^|\.)css-tricks\.com$/i, fallbackUrl: 'https://css-tricks.com/' },
  { pattern: /(^|\.)arxiv\.org$/i, fallbackUrl: 'https://arxiv.org/' },
  { pattern: /(^|\.)khanacademy\.org$/i, fallbackUrl: 'https://www.khanacademy.org/' },
  { pattern: /(^|\.)oracle\.com$/i, fallbackUrl: 'https://docs.oracle.com/en/java/' },
  { pattern: /(^|\.)scikit-learn\.org$/i, fallbackUrl: 'https://scikit-learn.org/stable/' },
  { pattern: /(^|\.)linuxfoundation\.org$/i, fallbackUrl: 'https://training.linuxfoundation.org/' },
  { pattern: /(^|\.)dataintensive\.net$/i, fallbackUrl: 'https://dataintensive.net/' },
  { pattern: /(^|\.)oreilly\.com$/i, fallbackUrl: 'https://www.oreilly.com/' },
  { pattern: /(^|\.)netacad\.com$/i, fallbackUrl: 'https://www.netacad.com/' },
  { pattern: /(^|\.)comptia\.org$/i, fallbackUrl: 'https://www.comptia.org/' },
];

const LOCALE_SEGMENT_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/i;
const GENERIC_PATH_SEGMENTS = new Set([
  'learn',
  'training',
  'docs',
  'documentation',
  'courses',
  'course',
  'tutorial',
  'tutorials',
  'community',
  'browse',
  'news',
  'resources',
  'certification',
  'certifications',
  'learn-about',
  'tag',
  'search',
]);
const TRACKING_QUERY_PREFIXES = ['utm_', 'ref', 'source', 'fbclid', 'gclid', 'mc_'];

const RESOURCE_TYPE_LABELS = new Set([
  'Documentation',
  'Course',
  'Tutorial',
  'Book',
  'Certification',
  'Code Example',
  'Research',
  'TutorSphere',
]);

const toSafeText = (value: unknown, fallback = '', maxLength = 220): string => {
  const normalized = sanitizeUserInput(String(value ?? '')).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
};

const normalizeUrl = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

const isTrustedDomain = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
};

const isTutorSphereResource = (source: string, type: string): boolean =>
  source.toLowerCase().includes('tutorsphere') || type.toLowerCase().includes('tutorsphere');

const getTopicFallbackUrl = (topic: string): string => {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes('python')) return 'https://docs.python.org/3/tutorial/';
  if (normalizedTopic.includes('react')) return 'https://react.dev/learn';
  if (normalizedTopic.includes('kubernetes') || normalizedTopic.includes('k8s')) {
    return 'https://kubernetes.io/docs/tutorials/kubernetes-basics/';
  }
  if (normalizedTopic.includes('docker')) return 'https://docs.docker.com/get-started/introduction/';
  if (normalizedTopic.includes('terraform')) return 'https://developer.hashicorp.com/terraform/tutorials/aws-get-started';
  if (normalizedTopic.includes('devops')) return 'https://learn.microsoft.com/en-us/devops/what-is-devops';
  if (normalizedTopic.includes('cloud')) return 'https://cloud.google.com/learn/training/infrastructure';
  if (normalizedTopic.includes('aws')) return 'https://aws.amazon.com/training/learn-about/devops/';
  if (normalizedTopic.includes('microsoft') || normalizedTopic.includes('azure')) {
    return 'https://learn.microsoft.com/en-us/training/paths/az-900-describe-cloud-concepts/';
  }
  if (normalizedTopic.includes('math') || normalizedTopic.includes('science') || normalizedTopic.includes('physics')) {
    return 'https://www.coursera.org/browse/math-and-logic';
  }

  return DEFAULT_TRUSTED_RESOURCE_URL;
};

const getRootFallbackUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const match = TRUSTED_ROOT_FALLBACKS.find(({ pattern }) => pattern.test(hostname));
    if (match) {
      return match.fallbackUrl;
    }
  } catch {
    // Fall through to default fallback.
  }

  return DEFAULT_TRUSTED_RESOURCE_URL;
};

const canonicalizeGithubUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length >= 2) {
      return `https://github.com/${segments[0]}/${segments[1]}`;
    }
  } catch {
    // Fall through to root fallback.
  }

  return 'https://github.com/';
};

const getPathSegments = (url: URL): string[] =>
  url.pathname
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .filter((segment) => !LOCALE_SEGMENT_PATTERN.test(segment));

const isLowSpecificityUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const segments = getPathSegments(parsed);

    if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
      return segments.length < 2;
    }

    if (segments.length === 0) {
      return true;
    }

    if (segments.length === 1 && GENERIC_PATH_SEGMENTS.has(segments[0])) {
      return true;
    }

    if (segments.length === 2 && GENERIC_PATH_SEGMENTS.has(segments[0]) && GENERIC_PATH_SEGMENTS.has(segments[1])) {
      return true;
    }

  } catch {
    return true;
  }

  return false;
};

const stripTrackingParams = (parsed: URL): void => {
  const keys = Array.from(parsed.searchParams.keys());
  for (const key of keys) {
    const lowered = key.toLowerCase();
    if (TRACKING_QUERY_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
      parsed.searchParams.delete(key);
    }
  }
};

const normalizeTrustedExternalUrl = (value: unknown): string | null => {
  const normalized = normalizeUrl(value);
  if (!normalized || !isTrustedDomain(normalized)) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
      return canonicalizeGithubUrl(normalized);
    }

    parsed.hash = '';
    stripTrackingParams(parsed);
    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizeResourceUrl = (
  rawUrl: unknown,
  topic: string,
  source: string,
  type: string
): string | null => {
  if (isTutorSphereResource(source, type)) {
    return normalizeUrl(rawUrl);
  }

  const stableUrl = normalizeTrustedExternalUrl(rawUrl);
  if (!stableUrl) {
    return getTopicFallbackUrl(topic);
  }

  return stableUrl;
};

const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'TutorSphere-Trusted-Resources/1.0',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const isReachableStatus = (status: number): boolean =>
  (status >= 200 && status < 400) || status === 401 || status === 403;

const isUrlReachable = async (url: string): Promise<boolean> => {
  const cached = URL_REACHABILITY_CACHE.get(url);
  if (typeof cached === 'boolean') {
    return cached;
  }

  let reachable = false;
  try {
    const headResponse = await fetchWithTimeout(url, { method: 'HEAD' });
    reachable = isReachableStatus(headResponse.status);

    if (!reachable && (headResponse.status === 405 || headResponse.status === 400)) {
      const getResponse = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Range: 'bytes=0-512',
        },
      });
      reachable = isReachableStatus(getResponse.status);
    }
  } catch {
    reachable = false;
  }

  URL_REACHABILITY_CACHE.set(url, reachable);
  return reachable;
};

const normalizeType = (value: unknown): string => {
  const normalized = toSafeText(value, 'Documentation', 40);
  if (RESOURCE_TYPE_LABELS.has(normalized)) {
    return normalized;
  }

  const lowered = normalized.toLowerCase();
  if (lowered.includes('cert')) return 'Certification';
  if (lowered.includes('book')) return 'Book';
  if (lowered.includes('course')) return 'Course';
  if (lowered.includes('tutorial') || lowered.includes('guide')) return 'Tutorial';
  if (lowered.includes('github') || lowered.includes('example') || lowered.includes('code')) return 'Code Example';
  if (lowered.includes('research') || lowered.includes('paper')) return 'Research';
  if (lowered.includes('tutor')) return 'TutorSphere';
  return 'Documentation';
};

const TOPIC_NOISE_TOKENS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'into',
  'using',
  'use',
  'basics',
  'basic',
  'introduction',
  'intro',
]);

const getTopicTokens = (topic: string): string[] =>
  topic
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !TOPIC_NOISE_TOKENS.has(token));

const isResourceRelevantToTopic = (resource: TrustedResourceItem, topic: string): boolean => {
  const tokens = getTopicTokens(topic);
  if (tokens.length === 0) {
    return true;
  }

  const combined = `${resource.title} ${resource.description} ${resource.url} ${resource.source}`.toLowerCase();
  const matchedTokenCount = tokens.filter((token) => combined.includes(token)).length;
  return matchedTokenCount > 0;
};

const tryParseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Continue with extraction fallback.
  }

  return null;
};

const extractJsonObject = (rawReply: string): Record<string, unknown> => {
  const direct = tryParseJsonObject(rawReply);
  if (direct) {
    return direct;
  }

  const fenced = rawReply.match(/```json\s*([\s\S]*?)```/i) || rawReply.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParseJsonObject(fenced[1]);
    if (fromFence) {
      return fromFence;
    }
  }

  const startIndex = rawReply.indexOf('{');
  const endIndex = rawReply.lastIndexOf('}');
  if (startIndex >= 0 && endIndex > startIndex) {
    const candidate = rawReply.slice(startIndex, endIndex + 1);
    const extracted = tryParseJsonObject(candidate);
    if (extracted) {
      return extracted;
    }
  }

  throw new Error('Trusted Resources Finder returned invalid JSON content.');
};

const normalizeAiResource = (value: unknown, topic: string): TrustedResourceItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const title = toSafeText(raw.title, '', 120);
  const unsafeSource = toSafeText(raw.source, 'Trusted Source', 60);
  const unsafeType = normalizeType(raw.type ?? raw.category);
  const source = /tutorsphere/i.test(unsafeSource) ? 'Trusted Source' : unsafeSource;
  const type = unsafeType === 'TutorSphere' ? 'Documentation' : unsafeType;
  const description = toSafeText(
    raw.description ?? raw.reason,
    `Trusted learning resource for ${topic}.`,
    220
  ).replace(/if you want,\s*i can.*$/i, '').trim();
  const url = normalizeResourceUrl(raw.url, topic, source, type);

  if (!title || !description || !url) {
    return null;
  }

  const normalizedResource: TrustedResourceItem = {
    title,
    description,
    url,
    source,
    type,
  };

  if (!isResourceRelevantToTopic(normalizedResource, topic)) {
    return null;
  }

  return normalizedResource;
};

const makeResource = (
  title: string,
  description: string,
  url: string,
  source: string,
  type: string
): TrustedResourceItem => ({
  title,
  description,
  url,
  source,
  type,
});

const sanitizeResourceItem = (
  resource: TrustedResourceItem,
  topic: string,
  options: {
    allowGenericUrl?: boolean;
    enforceTopicMatch?: boolean;
  } = {}
): TrustedResourceItem | null => {
  const allowGenericUrl = options.allowGenericUrl ?? false;
  const enforceTopicMatch = options.enforceTopicMatch ?? false;
  const title = toSafeText(resource.title, '', 120);
  const source = toSafeText(resource.source, 'Trusted Source', 60);
  const type = normalizeType(resource.type);
  const description = toSafeText(
    resource.description,
    `Trusted learning resource for ${topic}.`,
    220
  ).replace(/if you want,\s*i can.*$/i, '').trim();
  const url = normalizeResourceUrl(resource.url, topic, source, type);

  if (!title || !description || !url) {
    return null;
  }

  if (!allowGenericUrl && !isTutorSphereResource(source, type) && isLowSpecificityUrl(url)) {
    return null;
  }

  const normalizedResource: TrustedResourceItem = {
    title,
    description,
    source,
    type,
    url,
  };

  if (enforceTopicMatch && !isResourceRelevantToTopic(normalizedResource, topic)) {
    return null;
  }

  return normalizedResource;
};

const getGenericFallbackResources = (): TrustedResourceItem[] => [
  makeResource(
    'MDN Learning Center',
    'Structured web development learning paths with practical references and tutorials.',
    'https://developer.mozilla.org/en-US/docs/Learn',
    'MDN',
    'Documentation'
  ),
  makeResource(
    'Python Tutorial',
    'Official tutorial that builds Python fundamentals step by step.',
    'https://docs.python.org/3/tutorial/',
    'Python',
    'Documentation'
  ),
  makeResource(
    'React Learn',
    'Official React learning track covering components, state, and app architecture.',
    'https://react.dev/learn',
    'React',
    'Documentation'
  ),
  makeResource(
    'Kubernetes Basics',
    'Official guided Kubernetes tutorial for deployments, scaling, and updates.',
    'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
    'Kubernetes',
    'Tutorial'
  ),
  makeResource(
    'DigitalOcean Tutorials',
    'Engineering-focused tutorials with reproducible steps for practical learning.',
    'https://www.digitalocean.com/community/tutorials',
    'DigitalOcean',
    'Tutorial'
  ),
  makeResource(
    'Coursera IT Catalog',
    'Topic-filtered catalog for IT and software engineering learning paths.',
    'https://www.coursera.org/browse/information-technology',
    'Coursera',
    'Course'
  ),
];

const getTopicFallbackResources = (topic: string): TrustedResourceItem[] => {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes('kubernetes') || normalizedTopic.includes('k8s')) {
    return [
      makeResource(
        'Kubernetes Documentation',
        'Official reference for Kubernetes architecture, workloads, and cluster operations.',
        'https://kubernetes.io/docs/concepts/overview/',
        'Kubernetes',
        'Documentation'
      ),
      makeResource(
        'Kubernetes Basics Tutorial',
        'Guided practical walkthrough for deployments, scaling, and rolling updates.',
        'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
        'Kubernetes',
        'Tutorial'
      ),
      makeResource(
        'DigitalOcean Kubernetes Introduction',
        'Beginner-friendly tutorial explaining Kubernetes architecture and key concepts.',
        'https://www.digitalocean.com/community/tutorials/an-introduction-to-kubernetes',
        'DigitalOcean',
        'Tutorial'
      ),
      makeResource(
        'Linux Foundation CKA Certification',
        'Industry-recognized Kubernetes administrator certification guide and exam details.',
        'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/',
        'Linux Foundation',
        'Certification'
      ),
      makeResource(
        'Google Cloud DevOps and SRE Training',
        'Practical training path relevant to Kubernetes operations and reliability practices.',
        'https://cloud.google.com/learn/training/devops-and-sre',
        'Google Cloud',
        'Certification'
      ),
      makeResource(
        'AWS Training and Certification',
        'Official AWS training paths for running containerized and Kubernetes-based systems.',
        'https://aws.amazon.com/training/learn-about/devops/',
        'AWS',
        'Certification'
      ),
    ];
  }

  if (normalizedTopic.includes('docker')) {
    return [
      makeResource(
        'Docker Introduction',
        'Official starter documentation for container concepts and Docker workflows.',
        'https://docs.docker.com/get-started/introduction/',
        'Docker',
        'Documentation'
      ),
      makeResource(
        'Docker Engine Install Guide',
        'Step-by-step installation documentation for Docker Engine environments.',
        'https://docs.docker.com/engine/install/',
        'Docker',
        'Tutorial'
      ),
      makeResource(
        'Docker Reference',
        'Comprehensive command and API reference for daily container workflows.',
        'https://docs.docker.com/reference/',
        'Docker',
        'Documentation'
      ),
      makeResource(
        'DigitalOcean Docker on Ubuntu',
        'Hands-on tutorial for installing and using Docker in a real Linux setup.',
        'https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04',
        'DigitalOcean',
        'Tutorial'
      ),
      makeResource(
        'Kubernetes Basics Tutorial',
        'Natural next step after Docker fundamentals to learn container orchestration.',
        'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
        'Kubernetes',
        'Tutorial'
      ),
      makeResource(
        'Terraform AWS Getting Started',
        'Infrastructure-as-code tutorial useful for provisioning Docker-ready cloud environments.',
        'https://developer.hashicorp.com/terraform/tutorials/aws-get-started',
        'HashiCorp',
        'Tutorial'
      ),
    ];
  }

  if (normalizedTopic.includes('devops')) {
    return [
      makeResource(
        'What is DevOps?',
        'Clear introduction to DevOps culture, collaboration, and delivery practices.',
        'https://learn.microsoft.com/en-us/devops/what-is-devops',
        'Microsoft Learn',
        'Documentation'
      ),
      makeResource(
        'DevOps Culture and Mindset',
        'Foundational Coursera course covering DevOps principles and team practices.',
        'https://www.coursera.org/learn/devops-culture-and-mindset',
        'Coursera',
        'Course'
      ),
      makeResource(
        'Google Cloud DevOps',
        'Official DevOps overview focused on CI/CD, operations, and reliability practices.',
        'https://cloud.google.com/devops',
        'Google Cloud',
        'Documentation'
      ),
      makeResource(
        'Google Cloud DevOps and SRE Training',
        'Structured training path for DevOps and site reliability skills.',
        'https://cloud.google.com/learn/training/devops-and-sre',
        'Google Cloud',
        'Course'
      ),
      makeResource(
        'AWS DevOps Learning Path',
        'Role-aligned AWS training resources for DevOps tools and delivery workflows.',
        'https://aws.amazon.com/training/learn-about/devops/',
        'AWS',
        'Certification'
      ),
      makeResource(
        'Terraform AWS Getting Started',
        'Practical infrastructure-as-code tutorial for DevOps automation fundamentals.',
        'https://developer.hashicorp.com/terraform/tutorials/aws-get-started',
        'HashiCorp',
        'Tutorial'
      ),
      makeResource(
        'edX DevOps Courses',
        'University and industry-backed DevOps course catalog for structured progression.',
        'https://www.edx.org/learn/devops',
        'edX',
        'Course'
      ),
      makeResource(
        'freeCodeCamp DevOps Articles',
        'Curated DevOps guides and explainers from a trusted developer education platform.',
        'https://www.freecodecamp.org/news/tag/devops/',
        'freeCodeCamp',
        'Documentation'
      ),
    ];
  }

  if (normalizedTopic.includes('cloud')) {
    return [
      makeResource(
        'Microsoft Azure Cloud Concepts Path',
        'Official learning path explaining core cloud concepts and terminology.',
        'https://learn.microsoft.com/en-us/training/paths/az-900-describe-cloud-concepts/',
        'Microsoft Learn',
        'Course'
      ),
      makeResource(
        'Google Cloud Infrastructure Training',
        'Role-based cloud training for infrastructure, networking, and operations skills.',
        'https://cloud.google.com/learn/training/infrastructure',
        'Google Cloud',
        'Course'
      ),
      makeResource(
        'AWS Cloud Practitioner Learning',
        'Beginner cloud learning path for AWS architecture and cloud fundamentals.',
        'https://aws.amazon.com/training/learn-about/cloud-practitioner/',
        'AWS',
        'Certification'
      ),
      makeResource(
        'Coursera Cloud Computing Catalog',
        'Topic-specific cloud computing courses from universities and industry partners.',
        'https://www.coursera.org/browse/information-technology/cloud-computing',
        'Coursera',
        'Course'
      ),
      makeResource(
        'edX Cloud Computing Courses',
        'Curated cloud learning programs with academic and professional tracks.',
        'https://www.edx.org/learn/cloud-computing',
        'edX',
        'Course'
      ),
      makeResource(
        'DigitalOcean Kubernetes Deployment Tutorial',
        'Hands-on cloud-native deployment guide for running applications on Kubernetes.',
        'https://www.digitalocean.com/community/tutorials/how-to-deploy-a-scalable-and-secure-django-application-with-kubernetes',
        'DigitalOcean',
        'Tutorial'
      ),
    ];
  }

  if (normalizedTopic.includes('react')) {
    return [
      makeResource(
        'React Learn',
        'Official React learning path for fundamentals, state, and component architecture.',
        'https://react.dev/learn',
        'React',
        'Documentation'
      ),
      makeResource(
        'React API Reference',
        'Detailed React API reference for hooks, components, and rendering behavior.',
        'https://react.dev/reference/react',
        'React',
        'Documentation'
      ),
      makeResource(
        'MDN React Getting Started',
        'Step-by-step React tutorial integrated with core web development concepts.',
        'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Frameworks_libraries/React_getting_started',
        'MDN',
        'Tutorial'
      ),
      makeResource(
        'freeCodeCamp Front End Libraries',
        'Project-based curriculum including React-focused frontend exercises.',
        'https://www.freecodecamp.org/learn/front-end-development-libraries/',
        'freeCodeCamp',
        'Course'
      ),
      makeResource(
        'Coursera React Basics',
        'Guided React course that covers components, props, state, and hooks.',
        'https://www.coursera.org/learn/react-basics',
        'Coursera',
        'Course'
      ),
      makeResource(
        'Smashing Magazine React Guides',
        'High-quality long-form React articles focused on production frontend patterns.',
        'https://www.smashingmagazine.com/tag/react/',
        'Smashing Magazine',
        'Tutorial'
      ),
      makeResource(
        'React Examples Repository',
        'Official React examples and starter setups for reproducible learning and experimentation.',
        'https://github.com/reactjs/react.dev',
        'GitHub',
        'Code Example'
      ),
    ];
  }

  if (normalizedTopic.includes('python') || normalizedTopic.includes('data science') || normalizedTopic.includes('machine learning')) {
    return [
      makeResource(
        'Python Tutorial',
        'Official tutorial covering Python syntax, data structures, and modules.',
        'https://docs.python.org/3/tutorial/',
        'Python',
        'Tutorial'
      ),
      makeResource(
        'Python Library Reference',
        'Authoritative index of Python standard library modules and usage patterns.',
        'https://docs.python.org/3/library/index.html',
        'Python',
        'Documentation'
      ),
      makeResource(
        'scikit-learn User Guide',
        'Core machine learning guide with model selection and evaluation workflows.',
        'https://scikit-learn.org/stable/user_guide.html',
        'scikit-learn',
        'Documentation'
      ),
      makeResource(
        'Coursera Data Science Courses',
        'Structured pathways for statistics, ML, and applied data science practice.',
        'https://www.coursera.org/browse/data-science',
        'Coursera',
        'Course'
      ),
      makeResource(
        'edX Data Science Courses',
        'University-backed data science tracks with rigorous conceptual coverage.',
        'https://www.edx.org/learn/data-science',
        'edX',
        'Course'
      ),
      makeResource(
        'Google Cloud Machine Learning Training',
        'Practical cloud ML resources for model development and deployment workflows.',
        'https://cloud.google.com/learn/training/machinelearning-ai',
        'Google Cloud',
        'Certification'
      ),
      makeResource(
        'freeCodeCamp Python Learning Guide',
        'Curated Python learning roadmap with practical beginner-friendly resources.',
        'https://www.freecodecamp.org/news/learn-python-free-python-courses-for-beginners/',
        'freeCodeCamp',
        'Tutorial'
      ),
      makeResource(
        'Hands-On Machine Learning Repository',
        'Well-regarded code examples accompanying a respected machine learning textbook.',
        'https://github.com/ageron/handson-ml3',
        'GitHub',
        'Book'
      ),
    ];
  }

  if (normalizedTopic.includes('java') || normalizedTopic.includes('oop')) {
    return [
      makeResource(
        'Oracle Java Tutorial',
        'Official Java tutorial for object-oriented programming and core language features.',
        'https://docs.oracle.com/javase/tutorial/',
        'Oracle',
        'Tutorial'
      ),
      makeResource(
        'Java API Reference',
        'Comprehensive Java API reference for classes, interfaces, and packages.',
        'https://docs.oracle.com/en/java/javase/21/docs/api/index.html',
        'Oracle',
        'Documentation'
      ),
      makeResource(
        'Object-Oriented Java',
        'Focused course on object-oriented design and Java programming practices.',
        'https://www.coursera.org/learn/object-oriented-java',
        'Coursera',
        'Course'
      ),
      makeResource(
        'Java Programming',
        'Guided Java programming course with practical coding exercises.',
        'https://www.coursera.org/learn/java-programming',
        'Coursera',
        'Course'
      ),
      makeResource(
        'edX Java Courses',
        'Academic Java learning tracks that reinforce object-oriented fundamentals.',
        'https://www.edx.org/learn/java',
        'edX',
        'Course'
      ),
      makeResource(
        'freeCodeCamp Java Articles',
        'Practical Java and OOP explainers from a trusted developer education source.',
        'https://www.freecodecamp.org/news/tag/java/',
        'freeCodeCamp',
        'Tutorial'
      ),
      makeResource(
        'OpenJDK GitHub',
        'Official open-source Java implementation for deep reference and code examples.',
        'https://github.com/openjdk/jdk',
        'GitHub',
        'Code Example'
      ),
    ];
  }

  if (normalizedTopic.includes('math') || normalizedTopic.includes('mathematics') || normalizedTopic.includes('physics') || normalizedTopic.includes('science')) {
    return [
      makeResource(
        'Khan Academy',
        'Trusted structured lessons and exercises for mathematics and core science topics.',
        'https://www.khanacademy.org/math',
        'Khan Academy',
        'Course'
      ),
      makeResource(
        'edX Mathematics Programs',
        'University-level math pathways with strong conceptual depth and assessments.',
        'https://www.edx.org/learn/math',
        'edX',
        'Course'
      ),
      makeResource(
        'edX Physics Programs',
        'Academic physics learning tracks with problem-solving focused progression.',
        'https://www.edx.org/learn/physics',
        'edX',
        'Course'
      ),
      makeResource(
        'Coursera Mathematics Courses',
        'High-quality guided math curricula for pure and applied mathematics.',
        'https://www.coursera.org/browse/math-and-logic',
        'Coursera',
        'Course'
      ),
      makeResource(
        'Coursera Physical Science Courses',
        'Reputable physics and science courses with structured weekly learning outcomes.',
        'https://www.coursera.org/browse/physical-science-and-engineering',
        'Coursera',
        'Course'
      ),
      makeResource(
        'arXiv Mathematics',
        'Open-access mathematics research feed for advanced conceptual exploration.',
        'https://arxiv.org/list/math/recent',
        'arXiv',
        'Research'
      ),
      makeResource(
        'arXiv Physics',
        'Recent physics research papers for deeper scientific reading.',
        'https://arxiv.org/list/physics/recent',
        'arXiv',
        'Research'
      ),
    ];
  }

  return getGenericFallbackResources();
};

const dedupeResources = (resources: TrustedResourceItem[]): TrustedResourceItem[] => {
  const unique = new Map<string, TrustedResourceItem>();
  for (const resource of resources) {
    const key = resource.url.trim().replace(/\/+$/, '').toLowerCase();
    if (!key || unique.has(key)) {
      continue;
    }
    unique.set(key, resource);
  }

  return Array.from(unique.values());
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getLocalTutorSphereResources = async (topic: string): Promise<TrustedResourceItem[]> => {
  const tokens = topic
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2)
    .slice(0, 6);

  if (tokens.length === 0) {
    return [];
  }

  const queryPattern = new RegExp(tokens.map((token) => escapeRegex(token)).join('|'), 'i');

  try {
    const matchingResources = await Resource.find({
      isFree: true,
      $or: [
        { title: queryPattern },
        { subject: queryPattern },
        { description: queryPattern },
      ],
    })
      .sort({ downloadCount: -1 })
      .limit(3)
      .lean();

    return matchingResources
      .map((resource) => {
        const url = normalizeUrl(resource.url);
        if (!url) {
          return null;
        }

        return makeResource(
          toSafeText(resource.title, 'TutorSphere Resource', 120),
          toSafeText(
            resource.description,
            `TutorSphere tutor-curated material relevant to ${topic}.`,
            220
          ),
          url,
          'TutorSphere',
          'TutorSphere'
        );
      })
      .filter((resource): resource is TrustedResourceItem => Boolean(resource));
  } catch (error) {
    console.error('Trusted Resources Finder local lookup error:', error);
    return [];
  }
};

const ensureResourceHasWorkingUrl = async (
  resource: TrustedResourceItem,
  topic: string
): Promise<TrustedResourceItem | null> => {
  if (isTutorSphereResource(resource.source, resource.type)) {
    return resource;
  }

  const normalized = normalizeTrustedExternalUrl(resource.url);
  const candidates = dedupeResources([
    resource,
    {
      ...resource,
      url: normalized || getTopicFallbackUrl(topic),
    },
    {
      ...resource,
      url: getTopicFallbackUrl(topic),
    },
    {
      ...resource,
      url: getRootFallbackUrl(resource.url),
    },
  ]).map((entry) => entry.url);

  for (const candidateUrl of candidates) {
    if (!candidateUrl) {
      continue;
    }

    const reachable = await isUrlReachable(candidateUrl);
    if (reachable) {
      return {
        ...resource,
        url: candidateUrl,
      };
    }
  }

  return null;
};

const buildFinalResources = async (
  topic: string,
  aiResources: TrustedResourceItem[],
  localResources: TrustedResourceItem[],
  topicFallbackResources: TrustedResourceItem[]
): Promise<TrustedResourceItem[]> => {
  const genericFallbackResources = getGenericFallbackResources()
    .map((resource) => sanitizeResourceItem(resource, topic, { allowGenericUrl: true }))
    .filter((resource): resource is TrustedResourceItem => Boolean(resource));
  const sanitizedLocalResources = localResources
    .map((resource) => sanitizeResourceItem(resource, topic, { allowGenericUrl: true }))
    .filter((resource): resource is TrustedResourceItem => Boolean(resource));
  const sanitizedAiResources = aiResources
    .map((resource) => sanitizeResourceItem(resource, topic, { enforceTopicMatch: true }))
    .filter((resource): resource is TrustedResourceItem => Boolean(resource));
  const sanitizedTopicFallbackResources = topicFallbackResources
    .map((resource) => sanitizeResourceItem(resource, topic))
    .filter((resource): resource is TrustedResourceItem => Boolean(resource));

  const combined = dedupeResources([
    ...sanitizedLocalResources,
    ...sanitizedAiResources,
    ...sanitizedTopicFallbackResources,
    ...genericFallbackResources,
  ]);

  const validated = (
    await Promise.all(combined.map((resource) => ensureResourceHasWorkingUrl(resource, topic)))
  ).filter((resource): resource is TrustedResourceItem => Boolean(resource));

  const dedupedValidated = dedupeResources(validated);
  const capped = dedupedValidated.slice(0, MAX_RESOURCES);
  if (capped.length >= MIN_RESOURCES) {
    return capped;
  }

  const paddingPool = dedupeResources([...capped, ...genericFallbackResources]);
  const paddedValidated = (
    await Promise.all(paddingPool.map((resource) => ensureResourceHasWorkingUrl(resource, topic)))
  ).filter((resource): resource is TrustedResourceItem => Boolean(resource));
  const dedupedPadded = dedupeResources(paddedValidated);

  return dedupedPadded.slice(0, Math.max(MIN_RESOURCES, Math.min(MAX_RESOURCES, dedupedPadded.length)));
};

export class TrustedResourcesAiService {
  async generateTrustedResources(
    input: GenerateTrustedResourcesInput
  ): Promise<GenerateTrustedResourcesResponse> {
    const topic = toSafeText(input.topic, '', 140);
    const localResources = await getLocalTutorSphereResources(topic);
    const topicFallbackResources = getTopicFallbackResources(topic);

    if (!topic) {
      return {
        assistant: TRUSTED_RESOURCES_ASSISTANT_NAME,
        topic: 'General Learning',
        resources: await buildFinalResources('General Learning', [], localResources, topicFallbackResources),
      };
    }

    try {
      const localContext = localResources.length
        ? localResources.map((resource) => `${resource.title} (${resource.url})`).join('; ')
        : 'No directly matching TutorSphere resources were found.';

      const userPrompt = [
        TRUSTED_RESOURCES_GENERATE_PROMPT,
        'Critical constraints:',
        '- Prefer deep, topic-specific pages over homepages.',
        '- Include direct links for intro/fundamentals, tutorial/practice, and certification or structured path when available.',
        '- Do not return homepage-only URLs unless no confident deep page exists.',
        '- Ensure each URL is directly useful for learning the exact topic.',
        `Topic: ${topic}`,
        `LocalTutorSphereCandidates: ${localContext}`,
      ].join('\n');

      const rawReply = await azureOpenAiClient.chat(
        [
          {
            role: 'system',
            content: TRUSTED_RESOURCES_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        {
          temperature: 0.2,
          maxTokens: 1400,
          jsonResponse: true,
        }
      );

      const parsed = extractJsonObject(rawReply);
      const rawResources = Array.isArray(parsed.resources) ? parsed.resources : [];
      const aiResources = rawResources
        .map((resource) => normalizeAiResource(resource, topic))
        .filter((resource): resource is TrustedResourceItem => Boolean(resource));

      return {
        assistant: TRUSTED_RESOURCES_ASSISTANT_NAME,
        topic,
        resources: await buildFinalResources(topic, aiResources, localResources, topicFallbackResources),
      };
    } catch (error) {
      console.error('Trusted Resources Finder generation error:', error);
      return {
        assistant: TRUSTED_RESOURCES_ASSISTANT_NAME,
        topic,
        resources: await buildFinalResources(topic, [], localResources, topicFallbackResources),
      };
    }
  }
}

export const trustedResourcesAiService = new TrustedResourcesAiService();
