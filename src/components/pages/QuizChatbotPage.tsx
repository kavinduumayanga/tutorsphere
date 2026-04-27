import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Lightbulb,
  Loader2,
  Lock,
  MapPin,
  RefreshCcw,
  Rocket,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  User,
  Wand2,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { User as AppUser } from '../../types';

/* ═══════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════ */

type AssistantFeature = 'home' | 'skill-assessment' | 'ask-learn' | 'roadmap-finder';

type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: Date;
};

interface QuizChatbotPageProps {
  currentUser: AppUser | null;
  onOpenExamPreparation?: () => void;
}

interface AssistantChatPanelProps {
  title: string;
  subtitle: string;
  assistantLabel: string;
  messages: AssistantMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  canSubmit: boolean;
  isTyping: boolean;
  errorText: string | null;
  canChat: boolean;
  lockMessage?: string;
  inputPlaceholder: string;
  onBack: () => void;
  onRestart: () => Promise<void> | void;
  restartLabel: string;
  progressLabel?: string;
  progressPercent?: number;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  disableInput?: boolean;
  completionText?: string | null;
  completionCtaLabel?: string;
  onCompletionCta?: () => Promise<void> | void;
  emptyStateText?: string;
  accentColor: string;
  accentGradient: string;
  icon: LucideIcon;
  suggestedPrompts?: string[];
  onSuggestedPrompt?: (prompt: string) => void;
}

type FeatureCard = {
  id: Exclude<AssistantFeature, 'home'> | 'exam-preparation';
  title: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  accent: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  decorativeIcon: LucideIcon;
};

type SkillAssessmentOptionLabel = 'A' | 'B' | 'C' | 'D';

type SkillAssessmentConfig = {
  subject: string;
  topic: string;
};

type SkillAssessmentQuestion = {
  id: string;
  questionNumber: number;
  totalQuestions: number;
  difficulty: string;
  question: string;
  options: Record<SkillAssessmentOptionLabel, string>;
};

type SkillAssessmentFeedback = {
  isCorrect: boolean;
  explanation: string;
  correctOption?: SkillAssessmentOptionLabel;
};

type SkillAssessmentAnswerRecord = {
  questionNumber: number;
  selectedOption: SkillAssessmentOptionLabel;
  isCorrect: boolean;
};

type SkillAssessmentStudyPlanItem = {
  day: string;
  focus: string;
};

type SkillAssessmentResource = {
  title: string;
  url: string;
  source: string;
};

type SkillAssessmentSummary = {
  subject: string;
  topic: string;
  score: number;
  total: number;
  level: string;
  weakAreas: string[];
  studyPlan: SkillAssessmentStudyPlanItem[];
  resources: SkillAssessmentResource[];
  rawText: string;
};

const INITIAL_SKILL_CONFIG: SkillAssessmentConfig = {
  subject: '',
  topic: '',
};

const SKILL_ASSESSMENT_TOTAL_QUESTIONS = 5;
const SKILL_ASSESSMENT_OPTION_LABELS: SkillAssessmentOptionLabel[] = ['A', 'B', 'C', 'D'];
const SKILL_ASSESSMENT_RESTART_PROMPT_PATTERN = /^Are you weak in another subject\?/im;
const SKILL_QUESTION_HEADER_PATTERN = /^Question\s+(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]+)\))?/i;
const SKILL_OPTION_LINE_PATTERN = /^([ABCD])\.\s*(.*)$/i;

const MESSAGE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;
const ASK_LEARN_WELCOME_MESSAGE =
  'Hi! I am Ask & Learn AI. Ask me Science, Technology, Maths, Engineering, or ICT questions and I will teach step by step.';
const ROADMAP_WELCOME_MESSAGE =
  'Hi! I am Roadmap Finder. Tell me a future job role, and I will generate a structured roadmap to help you achieve it.';

const AI_FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'skill-assessment',
    title: 'Skill Assessment AI',
    description:
      'Take a personalized adaptive quiz to identify your strengths and weaknesses, then receive an AI-generated study plan.',
    cta: 'Start Assessment',
    icon: BarChart3,
    accent: 'from-violet-600 to-indigo-600',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-600',
    accentBorder: 'border-violet-200',
    decorativeIcon: Target,
  },
  {
    id: 'ask-learn',
    title: 'Ask & Learn AI',
    description:
      'Your 24/7 learning companion for STEM & ICT. Get step-by-step explanations, worked examples, and concept breakdowns.',
    cta: 'Start Learning',
    icon: Lightbulb,
    accent: 'from-cyan-500 to-blue-600',
    accentBg: 'bg-cyan-50',
    accentText: 'text-cyan-600',
    accentBorder: 'border-cyan-200',
    decorativeIcon: Brain,
  },
  {
    id: 'roadmap-finder',
    title: 'Roadmap Finder',
    description:
      'Enter any future career role and receive a structured, actionable roadmap with skills, resources, and milestones.',
    cta: 'Generate Roadmap',
    icon: MapPin,
    accent: 'from-emerald-500 to-teal-600',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-600',
    accentBorder: 'border-emerald-200',
    decorativeIcon: Rocket,
  },
  {
    id: 'exam-preparation',
    title: 'Exam Preparation AI',
    description:
      'Practice exam-style questions and improve your performance with instant feedback.',
    cta: 'Start Practice',
    icon: ClipboardCheck,
    accent: 'from-fuchsia-600 to-rose-600',
    accentBg: 'bg-fuchsia-50',
    accentText: 'text-fuchsia-600',
    accentBorder: 'border-fuchsia-200',
    decorativeIcon: Target,
  },
];

const ASK_LEARN_PROMPTS = [
  'Explain quantum computing simply',
  'How does photosynthesis work?',
  'What is Big O notation?',
];

const ROADMAP_PROMPTS = [
  'Data Scientist',
  'Full Stack Developer',
  'Cybersecurity Analyst',
];

const createMessage = (role: AssistantMessage['role'], text: string): AssistantMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  timestamp: new Date(),
});

const makeSkillQuestionId = (): string => `skill-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

const deriveLevelFromScore = (score: number): string => {
  if (score <= 1) return 'Beginner';
  if (score <= 3) return 'Intermediate';
  return 'Advanced';
};

const extractSection = (text: string, startPattern: RegExp, endPattern?: RegExp): string => {
  const startMatch = text.match(startPattern);
  const startIndex = startMatch?.index;
  if (typeof startIndex !== 'number') {
    return '';
  }

  const fromStart = text.slice(startIndex + startMatch[0].length);

  if (!endPattern) {
    return fromStart.trim();
  }

  const endMatch = fromStart.match(endPattern);
  const endIndex = typeof endMatch?.index === 'number' ? endMatch.index : fromStart.length;
  return fromStart.slice(0, endIndex).trim();
};

const parseQuestionFromReply = (reply: string): SkillAssessmentQuestion | null => {
  const lines = reply.replace(/\r/g, '').split('\n');
  const headerIndex = lines.findIndex((line) => SKILL_QUESTION_HEADER_PATTERN.test(line.trim()));
  if (headerIndex < 0) {
    return null;
  }

  const headerLine = lines[headerIndex].trim();
  const headerMatch = headerLine.match(SKILL_QUESTION_HEADER_PATTERN);
  if (!headerMatch) {
    return null;
  }

  const questionNumber = Number.parseInt(headerMatch[1], 10) || 1;
  const totalQuestions = Number.parseInt(headerMatch[2], 10) || SKILL_ASSESSMENT_TOTAL_QUESTIONS;
  const difficulty = (headerMatch[3] || 'diagnostic').trim();

  const questionLines: string[] = [];
  const options: Partial<Record<SkillAssessmentOptionLabel, string>> = {};
  let currentOption: SkillAssessmentOptionLabel | null = null;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line && !currentOption && questionLines.length === 0) {
      continue;
    }

    if (/^answer with a,\s*b,\s*c,\s*or\s*d\.?$/i.test(line)) {
      break;
    }

    const optionMatch = line.match(SKILL_OPTION_LINE_PATTERN);
    if (optionMatch) {
      currentOption = optionMatch[1].toUpperCase() as SkillAssessmentOptionLabel;
      options[currentOption] = optionMatch[2].trim();
      continue;
    }

    if (currentOption) {
      if (!line) {
        continue;
      }
      options[currentOption] = `${options[currentOption] || ''} ${line}`.trim();
      continue;
    }

    if (line) {
      questionLines.push(line);
    }
  }

  if (!questionLines.length || !options.A || !options.B || !options.C || !options.D) {
    return null;
  }

  return {
    id: makeSkillQuestionId(),
    questionNumber,
    totalQuestions,
    difficulty,
    question: questionLines.join(' ').trim(),
    options: {
      A: options.A,
      B: options.B,
      C: options.C,
      D: options.D,
    },
  };
};

const parseFeedbackFromReply = (
  reply: string,
  selectedOption: SkillAssessmentOptionLabel
): SkillAssessmentFeedback | null => {
  const lines = reply.replace(/\r/g, '').split('\n');
  const statusLineIndex = lines.findIndex((line) => {
    const normalized = line.trim();
    return (
      /^✅\s*correct/i.test(normalized) ||
      /^❌\s*incorrect/i.test(normalized) ||
      /^correct\b/i.test(normalized) ||
      /^incorrect\b/i.test(normalized)
    );
  });

  if (statusLineIndex < 0) {
    return null;
  }

  const statusLine = lines[statusLineIndex].trim();
  const isCorrect = /^✅\s*correct/i.test(statusLine) || /^correct\b/i.test(statusLine);

  const explanationLines: string[] = [];
  for (let index = statusLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = line.trim();

    if (
      SKILL_QUESTION_HEADER_PATTERN.test(normalized) ||
      /^1\)\s*Score Summary$/i.test(normalized) ||
      SKILL_ASSESSMENT_RESTART_PROMPT_PATTERN.test(normalized)
    ) {
      break;
    }

    explanationLines.push(line);
  }

  const explanation = explanationLines.join('\n').trim();

  return {
    isCorrect,
    explanation: explanation || (isCorrect ? 'Correct answer.' : 'Incorrect answer.'),
    correctOption: isCorrect ? selectedOption : undefined,
  };
};

const parseResourceLabel = (label: string): { title: string; source: string } => {
  const trimmed = label.trim();
  const titledSourceMatch = trimmed.match(/^(.*)\s+\(([^()]+)\)\s*$/);
  if (!titledSourceMatch) {
    return {
      title: trimmed,
      source: 'Reference',
    };
  }

  return {
    title: titledSourceMatch[1].trim(),
    source: titledSourceMatch[2].trim(),
  };
};

const parseSummaryFromReply = (
  reply: string,
  fallback: { subject: string; topic: string; score: number; total: number }
): SkillAssessmentSummary => {
  const normalized = reply.replace(/\r/g, '').trim();
  const subjectMatch = normalized.match(/-\s*Subject:\s*([^\n]+)/i);
  const topicMatch = normalized.match(/-\s*Topic:\s*([^\n]+)/i);
  const scoreMatch = normalized.match(/-\s*Score:\s*(\d+)\s*\/\s*(\d+)/i);
  const levelMatch = normalized.match(/-\s*Level:\s*([^\n]+)/i);

  const subject = subjectMatch?.[1]?.trim() || fallback.subject;
  const topic = topicMatch?.[1]?.trim() || fallback.topic;
  const score = scoreMatch ? Number.parseInt(scoreMatch[1], 10) : fallback.score;
  const total = scoreMatch ? Number.parseInt(scoreMatch[2], 10) : fallback.total;
  const level = levelMatch?.[1]?.trim() || deriveLevelFromScore(score);

  const weakAreaSection = extractSection(
    normalized,
    /^2\)\s*Weak Areas\s*$/im,
    /^3\)\s*7-Day Study Plan\s*$/im
  );
  const weakAreas = weakAreaSection
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const studyPlanSection = extractSection(
    normalized,
    /^3\)\s*7-Day Study Plan\s*$/im,
    /^4\)\s*Trusted Study Resources\s*$/im
  );
  const studyPlan: SkillAssessmentStudyPlanItem[] = studyPlanSection
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.match(/^(Day\s*\d+)\s*:\s*(.+)$/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      day: match[1].trim(),
      focus: match[2].trim(),
    }))
    .slice(0, 7);

  const resourcesSection = extractSection(
    normalized,
    /^4\)\s*Trusted Study Resources\s*$/im,
    SKILL_ASSESSMENT_RESTART_PROMPT_PATTERN
  );
  const resources: SkillAssessmentResource[] = resourcesSection
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .map((line) => {
      const markdownLinkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
      if (markdownLinkMatch) {
        const label = parseResourceLabel(markdownLinkMatch[1]);
        return {
          title: label.title,
          source: label.source,
          url: markdownLinkMatch[2].trim(),
        };
      }

      const rawUrlMatch = line.match(/(https?:\/\/\S+)/i);
      if (!rawUrlMatch) {
        return null;
      }

      return {
        title: line.replace(rawUrlMatch[1], '').replace(/[()\[\]-]/g, ' ').trim() || 'Reference',
        source: 'Reference',
        url: rawUrlMatch[1],
      };
    })
    .filter((item): item is SkillAssessmentResource => Boolean(item))
    .slice(0, 6);

  return {
    subject,
    topic,
    score: Number.isFinite(score) ? score : fallback.score,
    total: Number.isFinite(total) ? total : fallback.total,
    level,
    weakAreas,
    studyPlan,
    resources,
    rawText: normalized,
  };
};

/* ═══════════════════════════════════════════
   Rich Message Renderer
   ═══════════════════════════════════════════ */

const renderMessageText = (text: string) => {
  const chunks: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MESSAGE_LINK_PATTERN);

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push(text.slice(lastIndex, match.index));
    }

    const markdownLabel = match[1];
    const markdownUrl = match[2];
    const rawUrl = match[3];

    const href = markdownUrl || rawUrl;
    const label = markdownLabel || rawUrl;

    if (href && label) {
      chunks.push(
        <a
          key={`link-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-semibold underline underline-offset-2 decoration-current/40 hover:decoration-current/80 transition-all"
        >
          {label}
        </a>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }

  return chunks;
};

const formatTimestamp = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const isNearBottom = (container: HTMLDivElement, threshold = 120) => {
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance <= threshold;
};

/* ═══════════════════════════════════════════
   Chat Panel Component
   ═══════════════════════════════════════════ */

const AssistantChatPanel: React.FC<AssistantChatPanelProps> = ({
  title,
  subtitle,
  assistantLabel,
  messages,
  input,
  onInputChange,
  onSend,
  canSubmit,
  isTyping,
  errorText,
  canChat,
  lockMessage,
  inputPlaceholder,
  onBack,
  onRestart,
  restartLabel,
  progressLabel,
  progressPercent,
  copiedId,
  onCopy,
  disableInput,
  completionText,
  completionCtaLabel,
  onCompletionCta,
  emptyStateText,
  accentColor,
  accentGradient,
  icon: PanelIcon,
  suggestedPrompts,
  onSuggestedPrompt,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const hasInitializedScrollRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = chatContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    shouldStickToBottomRef.current = true;
    scrollChatToBottom('smooth');
  }, [scrollChatToBottom]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const maxHeight = 176;
    const minHeight = 48;
    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';

    const sendButton = sendButtonRef.current;
    if (sendButton) {
      sendButton.style.height = `${nextHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (!hasInitializedScrollRef.current) {
      hasInitializedScrollRef.current = true;
      scrollChatToBottom('auto');
      return;
    }

    if (!shouldStickToBottomRef.current) {
      return;
    }

    const behavior: ScrollBehavior = messages.length <= 2 ? 'auto' : 'smooth';
    scrollChatToBottom(behavior);
  }, [messages, isTyping, scrollChatToBottom]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const nearBottom = isNearBottom(container);
      shouldStickToBottomRef.current = nearBottom;
      setShowScrollBtn(!nearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const disabledComposer = Boolean(disableInput || isTyping || !canChat);

  const handleSendClick = () => {
    if (!canSubmit) {
      return;
    }

    void onSend();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendClick();
    }
  };

  const showSuggestions = suggestedPrompts && suggestedPrompts.length > 0 && messages.length <= 1 && !isTyping;

  return (
    <section className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-none border-b border-slate-200/60 bg-white/80 backdrop-blur-lg px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-sm active:scale-95"
              title="Back to AI tools"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${accentGradient} shadow-sm`}>
              <PanelIcon className="h-4 w-4 text-white" />
            </div>
            <div className="space-y-0.5">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                {title}
              </h2>
              <p className="text-[11px] font-medium text-slate-400 sm:text-xs">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {progressLabel && (
              <div className={`hidden items-center gap-2 rounded-xl border ${accentColor === 'violet' ? 'border-violet-100 bg-violet-50 text-violet-700' : accentColor === 'cyan' ? 'border-cyan-100 bg-cyan-50 text-cyan-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'} px-3 py-2 sm:flex`}>
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">{progressLabel}</span>
              </div>
            )}
            <button
              onClick={() => void onRestart()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md active:scale-[0.97] sm:px-4 sm:py-2.5"
              title={restartLabel}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{restartLabel}</span>
            </button>
          </div>
        </div>

        {typeof progressPercent === 'number' && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                className={`h-full rounded-full bg-gradient-to-r ${accentGradient}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Messages Area ── */}
      <div
        ref={chatContainerRef}
        className="relative flex-1 overflow-y-auto custom-scrollbar ai-chat-bg px-4 py-5 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {messages.length === 0 && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className={`mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accentGradient} shadow-lg`}>
                <PanelIcon className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-500">{emptyStateText || 'Preparing your AI session...'}</p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`mt-1 h-8 w-8 shrink-0 rounded-xl flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-200/60'
                      : `bg-gradient-to-br ${accentGradient} shadow-md`
                  }`}
                >
                  {message.role === 'user'
                    ? <User className="h-3.5 w-3.5 text-white" />
                    : <Bot className="h-3.5 w-3.5 text-white" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[min(85%,640px)] space-y-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`px-1 flex items-center gap-1.5 text-[10px] font-medium ${message.role === 'user' ? 'justify-end text-indigo-400' : 'text-slate-400'}`}>
                    <span>{message.role === 'user' ? 'You' : assistantLabel}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>

                  <div className="group relative">
                    <div
                      className={`chat-bubble px-4 py-3 text-[14px] leading-[1.7] sm:px-5 sm:py-3.5 ${
                        message.role === 'user'
                          ? 'chat-bubble-user rounded-2xl rounded-tr-md bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'chat-bubble-assistant rounded-2xl rounded-tl-md border border-slate-200/80 bg-white text-slate-700 shadow-sm'
                      }`}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {renderMessageText(message.text)}
                    </div>

                    {message.role === 'assistant' && (
                      <button
                        onClick={() => onCopy(message.id, message.text)}
                        className="absolute -right-1 -top-1 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm opacity-0 transition-all hover:text-indigo-600 hover:shadow-md group-hover:opacity-100"
                        title="Copy reply"
                      >
                        {copiedId === message.id
                          ? <Check className="h-3 w-3 text-emerald-500" />
                          : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-3"
              >
                <div className={`mt-1 h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br ${accentGradient} flex items-center justify-center shadow-md`}>
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="space-y-1">
                  <div className="px-1 text-[10px] font-medium text-slate-400">{assistantLabel}</div>
                  <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-5 py-3.5 shadow-sm">
                    <div className="ai-typing-indicator flex items-center gap-1">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                    <span className="ml-2 text-xs font-medium text-slate-400">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggested Prompts */}
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-2 pt-2"
            >
              {suggestedPrompts!.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSuggestedPrompt?.(prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md active:scale-[0.97]"
                >
                  <Wand2 className="h-3 w-3 text-indigo-400" />
                  {prompt}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Scroll to bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 py-2 text-[11px] font-bold text-slate-600 shadow-lg backdrop-blur transition-all hover:border-indigo-200 hover:text-indigo-600"
            >
              <ArrowDown className="h-3 w-3" />
              New messages
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Composer Area ── */}
      <div className="flex-none border-t border-slate-200/60 bg-white/90 backdrop-blur-lg px-4 py-3 sm:px-6">
        {!canChat && lockMessage && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-800 flex items-start gap-2.5">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium">{lockMessage}</span>
          </div>
        )}

        {errorText && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs font-medium text-rose-700">
            {errorText}
          </div>
        )}

        {completionText && completionCtaLabel && onCompletionCta && (
          <div className="mb-3 flex flex-col items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 sm:flex-row">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
              <Check className="h-4 w-4" />
              {completionText}
            </div>
            <button
              onClick={() => void onCompletionCta()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.97]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {completionCtaLabel}
            </button>
          </div>
        )}

        <div className="ai-composer rounded-2xl border border-slate-200 bg-slate-50/80 p-2 transition-all focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                rows={1}
                className="auto-resize-textarea w-full resize-none rounded-xl bg-transparent px-3.5 py-2.5 text-[14px] font-medium leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
                disabled={disabledComposer}
                style={{ minHeight: '42px' }}
              />
            </div>

            <motion.button
              ref={sendButtonRef}
              whileHover={canSubmit ? { scale: 1.05 } : {}}
              whileTap={canSubmit ? { scale: 0.92 } : {}}
              onClick={handleSendClick}
              disabled={!canSubmit}
              className={`flex-none h-10 w-10 rounded-xl bg-gradient-to-br ${accentGradient} text-white flex items-center justify-center shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-35`}
              title="Send message"
            >
              {isTyping
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </motion.button>
          </div>

          <div className="mt-1.5 flex flex-col gap-0.5 px-1 text-[10px] font-medium text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Enter to send · Shift+Enter for new line</span>
            <span>{isTyping ? 'AI is crafting your response...' : 'AI responses may contain inaccuracies'}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

interface SkillAssessmentPanelProps {
  currentUser: AppUser | null;
  canQuizChat: boolean;
  onBack: () => void;
}

const SkillAssessmentPanel: React.FC<SkillAssessmentPanelProps> = ({ currentUser, canQuizChat, onBack }) => {
  const [config, setConfig] = useState<SkillAssessmentConfig>(INITIAL_SKILL_CONFIG);
  const [isGeneratingSet, setIsGeneratingSet] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState<SkillAssessmentQuestion | null>(null);
  const [queuedQuestion, setQueuedQuestion] = useState<SkillAssessmentQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<SkillAssessmentOptionLabel | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<SkillAssessmentFeedback | null>(null);
  const [answers, setAnswers] = useState<SkillAssessmentAnswerRecord[]>([]);
  const [summary, setSummary] = useState<SkillAssessmentSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const score = useMemo(
    () => answers.reduce((total, answer) => total + (answer.isCorrect ? 1 : 0), 0),
    [answers]
  );

  const totalQuestions = currentQuestion?.totalQuestions || summary?.total || SKILL_ASSESSMENT_TOTAL_QUESTIONS;
  const scorePercent = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;

  const progressPercent = useMemo(() => {
    if (!currentQuestion && !showSummary) {
      return 0;
    }

    if (showSummary) {
      return 100;
    }

    if (!currentQuestion) {
      return 0;
    }

    const completedSoFar = (currentQuestion.questionNumber - 1) + (currentFeedback ? 1 : 0);
    return Math.round((completedSoFar / Math.max(1, currentQuestion.totalQuestions)) * 100);
  }, [currentFeedback, currentQuestion, showSummary]);

  const clearAssessment = () => {
    setCurrentQuestion(null);
    setQueuedQuestion(null);
    setSelectedOption(null);
    setCurrentFeedback(null);
    setAnswers([]);
    setSummary(null);
    setShowSummary(false);
    setErrorText(null);
  };

  const restartToSetup = () => {
    clearAssessment();
    setConfig(INITIAL_SKILL_CONFIG);
    setIsGeneratingSet(false);
    setIsSubmittingAnswer(false);
  };

  const startAssessment = async () => {
    const subject = config.subject.trim();
    const topic = config.topic.trim();

    if (!subject || !topic) {
      setErrorText('Please provide both weak subject and specific weak area to start your diagnostic assessment.');
      return;
    }

    if (!currentUser || !canQuizChat) {
      setErrorText('Only logged-in student and tutor accounts can start Skill Assessment AI.');
      return;
    }

    clearAssessment();
    setIsGeneratingSet(true);

    try {
      await apiService.resetQuizChatSession({
        id: currentUser.id,
        role: currentUser.role,
      });

      await apiService.sendQuizChatMessage(subject, {
        id: currentUser.id,
        role: currentUser.role,
      });

      const topicResult = await apiService.sendQuizChatMessage(topic, {
        id: currentUser.id,
        role: currentUser.role,
      });

      const firstQuestion = parseQuestionFromReply(topicResult.reply);
      if (!firstQuestion) {
        throw new Error('Failed to parse the first diagnostic question. Please try again.');
      }

      setCurrentQuestion(firstQuestion);
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Unable to start the skill assessment right now. Please try again.'));
    } finally {
      setIsGeneratingSet(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (
      !selectedOption ||
      !currentQuestion ||
      currentFeedback ||
      !currentUser ||
      !canQuizChat ||
      isSubmittingAnswer
    ) {
      return;
    }

    setIsSubmittingAnswer(true);
    setErrorText(null);

    try {
      const result = await apiService.sendQuizChatMessage(selectedOption, {
        id: currentUser.id,
        role: currentUser.role,
      });

      const parsedFeedback =
        parseFeedbackFromReply(result.reply, selectedOption) ||
        {
          isCorrect: /^✅\s*correct/i.test(result.reply.trim()),
          explanation: 'Review the explanation and continue to the next question.',
          correctOption: undefined,
        };

      const nextRecord: SkillAssessmentAnswerRecord = {
        questionNumber: currentQuestion.questionNumber,
        selectedOption,
        isCorrect: parsedFeedback.isCorrect,
      };
      const nextAnswers = [...answers, nextRecord];

      setAnswers(nextAnswers);
      setCurrentFeedback(parsedFeedback);

      if (result.stage === 'quiz') {
        const nextQuestion = parseQuestionFromReply(result.reply);
        if (!nextQuestion) {
          throw new Error('Unable to load the next question. Please restart the assessment.');
        }
        setQueuedQuestion(nextQuestion);
        setSummary(null);
        return;
      }

      const parsedSummary = parseSummaryFromReply(result.reply, {
        subject: config.subject.trim(),
        topic: config.topic.trim(),
        score: nextAnswers.filter((answer) => answer.isCorrect).length,
        total: SKILL_ASSESSMENT_TOTAL_QUESTIONS,
      });

      setQueuedQuestion(null);
      setSummary(parsedSummary);
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Unable to submit your answer right now. Please try again.'));
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleContinue = () => {
    if (queuedQuestion) {
      setCurrentQuestion(queuedQuestion);
      setQueuedQuestion(null);
      setSelectedOption(null);
      setCurrentFeedback(null);
      return;
    }

    if (summary) {
      setShowSummary(true);
      setSelectedOption(null);
      setCurrentFeedback(null);
    }
  };

  const weakAreas = summary?.weakAreas?.length
    ? summary.weakAreas
    : ['No major weak areas were identified in this attempt.'];

  const studyPlan = summary?.studyPlan || [];
  const studyResources = summary?.resources || [];

  return (
    <section className="flex h-full flex-col overflow-hidden">
      <div className="flex-none border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-lg sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-sm"
              title="Back to AI tools"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Skill Assessment AI</h2>
              <p className="text-[11px] font-medium text-slate-400 sm:text-xs">
                Diagnostic assessment with instant feedback, level detection, and study recommendations
              </p>
            </div>
          </div>

          {(currentQuestion || showSummary) && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={restartToSetup}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-violet-700 hover:to-indigo-700"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Restart Assessment
              </button>
            </div>
          )}
        </div>

        {(currentQuestion || showSummary) && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>
                {showSummary
                  ? 'Completed'
                  : `Question ${Math.min(currentQuestion?.questionNumber || 1, totalQuestions)}/${totalQuestions}`}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600"
              />
            </div>
          </div>
        )}
      </div>

      <div className="relative flex-1 overflow-y-auto custom-scrollbar ai-home-bg px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <AnimatePresence mode="wait" initial={false}>
            {!currentQuestion && !showSummary && (
              <motion.section
                key="skill-assessment-setup"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-violet-100 bg-white/95 p-6 shadow-sm sm:p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Create Your Skill Assessment</h3>
                      <p className="text-sm font-medium text-slate-500">
                        Start a 5-question diagnostic to identify weak areas and generate your AI study plan.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Weak Subject</span>
                      <input
                        value={config.subject}
                        onChange={(event) => setConfig((prev) => ({ ...prev, subject: event.target.value }))}
                        placeholder="e.g. Mathematics"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Specific Weak Area</span>
                      <input
                        value={config.topic}
                        onChange={(event) => setConfig((prev) => ({ ...prev, topic: event.target.value }))}
                        placeholder="e.g. Quadratic Equations"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      />
                    </label>
                  </div>

                  {!canQuizChat && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
                      Only logged-in student and tutor accounts can use Skill Assessment AI.
                    </div>
                  )}

                  {errorText && (
                    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-semibold text-violet-700">
                      {errorText}
                    </div>
                  )}

                  {isGeneratingSet && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating your diagnostic questions...
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end">
                    <button
                      onClick={() => void startAssessment()}
                      disabled={isGeneratingSet || !canQuizChat}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      {isGeneratingSet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isGeneratingSet ? 'Creating Assessment...' : 'Start Assessment'}
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {currentQuestion && !showSummary && (
              <motion.section
                key="skill-assessment-question"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                      <Target className="h-3.5 w-3.5" />
                      Skill Diagnostic Assessment
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      Question {currentQuestion.questionNumber}/{totalQuestions}
                    </div>
                  </div>

                  <p className="text-lg font-bold leading-relaxed text-slate-900">{currentQuestion.question}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Focus: {config.topic.trim()} · Difficulty: {currentQuestion.difficulty}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {SKILL_ASSESSMENT_OPTION_LABELS.map((label) => {
                      const isPicked = selectedOption === label;
                      const showCorrect = Boolean(currentFeedback?.correctOption) && currentFeedback.correctOption === label;
                      const showIncorrectSelection = Boolean(currentFeedback) && isPicked && !currentFeedback.isCorrect;

                      return (
                        <button
                          key={label}
                          onClick={() => {
                            if (!currentFeedback && !isSubmittingAnswer) {
                              setSelectedOption(label);
                            }
                          }}
                          disabled={Boolean(currentFeedback) || isSubmittingAnswer}
                          className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                                  showCorrect
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : showIncorrectSelection
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                : isPicked
                                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/40'
                          }`}
                        >
                          <span className="mr-2 text-xs font-black">{label}.</span>
                          {currentQuestion.options[label]}
                        </button>
                      );
                    })}
                  </div>

                  {currentFeedback && (
                    <div className={`mt-5 rounded-xl border px-4 py-3 ${
                      currentFeedback.isCorrect
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    }`}>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        {currentFeedback.isCorrect ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {currentFeedback.isCorrect
                          ? 'Correct answer!'
                          : currentFeedback.correctOption
                            ? `Incorrect. Correct option: ${currentFeedback.correctOption}`
                            : 'Incorrect answer.'}
                      </div>
                      <p className="mt-1.5 text-sm font-medium leading-relaxed">{currentFeedback.explanation}</p>
                    </div>
                  )}

                  {errorText && (
                    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-semibold text-violet-700">
                      {errorText}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                    {!currentFeedback && (
                      <button
                        onClick={() => void handleSubmitAnswer()}
                        disabled={!selectedOption || isSubmittingAnswer}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isSubmittingAnswer && <Loader2 className="h-4 w-4 animate-spin" />}
                        Submit Answer
                      </button>
                    )}

                    {currentFeedback && (
                      <button
                        onClick={handleContinue}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:from-violet-700 hover:to-indigo-700"
                      >
                        {queuedQuestion ? 'Next Question' : 'View Summary'}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {showSummary && summary && (
              <motion.section
                key="skill-assessment-summary"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Diagnostic Summary</h3>
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                      <Target className="h-3.5 w-3.5" />
                      {summary.score}/{summary.total} ({scorePercent}%)
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Assessment Details</p>
                      <div className="mt-2 space-y-2 text-sm font-semibold text-slate-700">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Subject: {summary.subject}</div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Weak Area: {summary.topic}</div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Level: {summary.level}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Weak Areas</p>
                      <ul className="mt-2 space-y-2">
                        {weakAreas.map((area) => (
                          <li key={area} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                            {area}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">7-Day Study Plan</p>
                    <ul className="mt-3 space-y-2">
                      {studyPlan.length === 0 && (
                        <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                          A personalized study plan was not returned. Please restart the assessment to regenerate it.
                        </li>
                      )}

                      {studyPlan.map((entry) => (
                        <li key={`${entry.day}-${entry.focus}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                          <span className="font-bold text-slate-900">{entry.day}:</span> {entry.focus}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recommended Resources</p>
                    <ul className="mt-3 space-y-2">
                      {studyResources.length === 0 && (
                        <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                          No resource links were generated for this attempt.
                        </li>
                      )}

                      {studyResources.map((resource) => (
                        <li key={`${resource.url}-${resource.title}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-violet-700 underline decoration-violet-200 underline-offset-2 hover:text-violet-800"
                          >
                            {resource.title}
                          </a>
                          <span className="ml-1 text-xs font-semibold text-slate-500">({resource.source})</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                    <button
                      onClick={restartToSetup}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:from-violet-700 hover:to-indigo-700"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Restart Assessment
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════
   Main Page Export
   ═══════════════════════════════════════════ */

export const QuizChatbotPage: React.FC<QuizChatbotPageProps> = ({ currentUser, onOpenExamPreparation }) => {
  const [activeFeature, setActiveFeature] = useState<AssistantFeature>('home');

  const [askMessages, setAskMessages] = useState<AssistantMessage[]>([
    createMessage('assistant', ASK_LEARN_WELCOME_MESSAGE),
  ]);
  const [askInput, setAskInput] = useState('');
  const [askIsTyping, setAskIsTyping] = useState(false);
  const [askErrorText, setAskErrorText] = useState<string | null>(null);
  const [askCopiedId, setAskCopiedId] = useState<string | null>(null);

  const [roadmapMessages, setRoadmapMessages] = useState<AssistantMessage[]>([
    createMessage('assistant', ROADMAP_WELCOME_MESSAGE),
  ]);
  const [roadmapInput, setRoadmapInput] = useState('');
  const [roadmapIsTyping, setRoadmapIsTyping] = useState(false);
  const [roadmapErrorText, setRoadmapErrorText] = useState<string | null>(null);
  const [roadmapCopiedId, setRoadmapCopiedId] = useState<string | null>(null);

  const canQuizChat = Boolean(currentUser && (currentUser.role === 'student' || currentUser.role === 'tutor'));

  const sharedUserContext = useMemo(
    () => ({
      currentTab: 'ai-assistant',
      userRole: currentUser?.role,
      userName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : undefined,
    }),
    [currentUser]
  );

  const askCanSubmit = Boolean(askInput.trim() && !askIsTyping);
  const roadmapCanSubmit = Boolean(roadmapInput.trim() && !roadmapIsTyping);

  const copyToClipboard = (
    id: string,
    text: string,
    setCopiedId: React.Dispatch<React.SetStateAction<string | null>>,
    setErrorText: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {
        setErrorText('Unable to copy message to clipboard.');
      });
  };

  const handleAskLearnSend = async () => {
    const trimmedInput = askInput.trim();
    if (!trimmedInput || askIsTyping) {
      return;
    }

    setAskMessages((previous) => [...previous, createMessage('user', trimmedInput)]);
    setAskInput('');
    setAskIsTyping(true);
    setAskErrorText(null);

    try {
      const result = await apiService.sendFaqChatMessage(trimmedInput, {
        ...sharedUserContext,
        aiMode: 'ask_learn',
      });

      setAskMessages((previous) => [...previous, createMessage('assistant', result.reply)]);
    } catch (error) {
      const fallbackError = 'Unable to reach Ask & Learn AI. Please try again.';
      const message = error instanceof Error ? error.message : fallbackError;

      setAskErrorText(message || fallbackError);
      setAskMessages((previous) => [
        ...previous,
        createMessage('assistant', 'I hit a temporary issue. Please try again in a moment.'),
      ]);
    } finally {
      setAskIsTyping(false);
    }
  };

  const restartAskLearn = () => {
    setAskMessages([createMessage('assistant', ASK_LEARN_WELCOME_MESSAGE)]);
    setAskInput('');
    setAskErrorText(null);
    setAskIsTyping(false);
  };

  const handleRoadmapSend = async () => {
    const trimmedInput = roadmapInput.trim();
    if (!trimmedInput || roadmapIsTyping) {
      return;
    }

    setRoadmapMessages((previous) => [...previous, createMessage('user', trimmedInput)]);
    setRoadmapInput('');
    setRoadmapIsTyping(true);
    setRoadmapErrorText(null);

    try {
      const result = await apiService.sendFaqChatMessage(trimmedInput, {
        ...sharedUserContext,
        aiMode: 'roadmap_finder',
      });

      setRoadmapMessages((previous) => [...previous, createMessage('assistant', result.reply)]);
    } catch (error) {
      const fallbackError = 'Unable to reach Roadmap Finder. Please try again.';
      const message = error instanceof Error ? error.message : fallbackError;

      setRoadmapErrorText(message || fallbackError);
      setRoadmapMessages((previous) => [
        ...previous,
        createMessage('assistant', 'I hit a temporary issue. Please try again in a moment.'),
      ]);
    } finally {
      setRoadmapIsTyping(false);
    }
  };

  const restartRoadmapFinder = () => {
    setRoadmapMessages([createMessage('assistant', ROADMAP_WELCOME_MESSAGE)]);
    setRoadmapInput('');
    setRoadmapErrorText(null);
    setRoadmapIsTyping(false);
  };

  const goHome = () => {
    setActiveFeature('home');
  };

  const handleSuggestedPromptAskLearn = (prompt: string) => {
    setAskInput(prompt);
  };

  const handleSuggestedPromptRoadmap = (prompt: string) => {
    setRoadmapInput(prompt);
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden px-2 py-2 sm:px-4 lg:px-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl shadow-slate-900/[0.06] sm:rounded-[1.75rem]">
          <AnimatePresence mode="wait" initial={false}>
            {/* ═══ HOME ═══ */}
            {activeFeature === 'home' && (
              <motion.section
                key="ai-assistant-home"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="h-full overflow-y-auto custom-scrollbar ai-home-bg"
              >
                <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-10 px-5 py-10 sm:px-8 lg:py-12">
                  {/* Hero */}
                  <div className="space-y-5 text-center">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 shadow-2xl shadow-indigo-500/30"
                    >
                      <Sparkles className="h-9 w-9 text-white" />
                    </motion.div>
                    <div className="space-y-3">
                      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
                        AI Assistant
                      </h1>
                      <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                        Choose a tool below to assess your skills, learn with AI, prepare with exam practice, or discover your career path.
                      </p>
                    </div>
                  </div>

                  {/* Feature Cards */}
                  <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {AI_FEATURE_CARDS.map((card, index) => {
                      const Icon = card.icon;
                      const DecorativeIcon = card.decorativeIcon;

                      return (
                        <motion.button
                          key={card.id}
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08, type: 'spring', stiffness: 200, damping: 22 }}
                          whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300, damping: 18 } }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (card.id === 'exam-preparation') {
                              onOpenExamPreparation?.();
                              return;
                            }
                            setActiveFeature(card.id);
                          }}
                          className={`group relative text-left overflow-hidden rounded-2xl border ${card.accentBorder} bg-white p-6 shadow-md transition-shadow hover:shadow-xl sm:p-7`}
                        >
                          {/* Decorative background icon */}
                          <div className="absolute -right-4 -top-4 opacity-[0.04]">
                            <DecorativeIcon className="h-32 w-32" />
                          </div>

                          <div className="relative space-y-4">
                            <div className={`inline-flex rounded-xl bg-gradient-to-br ${card.accent} p-3 text-white shadow-lg`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{card.title}</h3>
                              <p className="text-[13px] leading-relaxed text-slate-500">{card.description}</p>
                            </div>
                            <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${card.accentText} transition-all group-hover:gap-2.5`}>
                              <span>{card.cta}</span>
                              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Bottom info */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-400"
                  >
                    <Zap className="h-3 w-3" />
                    <span>Powered by advanced AI · Responses generated in real-time</span>
                  </motion.div>
                </div>
              </motion.section>
            )}

            {/* ═══ SKILL ASSESSMENT ═══ */}
            {activeFeature === 'skill-assessment' && (
              <motion.div
                key="skill-assessment-flow"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="h-full"
              >
                <SkillAssessmentPanel
                  currentUser={currentUser}
                  canQuizChat={canQuizChat}
                  onBack={goHome}
                />
              </motion.div>
            )}

            {/* ═══ ASK & LEARN ═══ */}
            {activeFeature === 'ask-learn' && (
              <motion.div
                key="ask-learn-chat"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="h-full"
              >
                <AssistantChatPanel
                  title="Ask & Learn AI"
                  subtitle="Science, Technology, Maths, Engineering & ICT assistant"
                  assistantLabel="Ask & Learn AI"
                  messages={askMessages}
                  input={askInput}
                  onInputChange={setAskInput}
                  onSend={handleAskLearnSend}
                  canSubmit={askCanSubmit}
                  isTyping={askIsTyping}
                  errorText={askErrorText}
                  canChat
                  inputPlaceholder="Ask a Science, Technology, Maths, Engineering, or ICT question..."
                  onBack={goHome}
                  onRestart={restartAskLearn}
                  restartLabel="Restart Chat"
                  copiedId={askCopiedId}
                  onCopy={(id, text) => copyToClipboard(id, text, setAskCopiedId, setAskErrorText)}
                  emptyStateText="Ask your first STEM/ICT question to begin learning."
                  accentColor="cyan"
                  accentGradient="from-cyan-500 to-blue-600"
                  icon={Lightbulb}
                  suggestedPrompts={ASK_LEARN_PROMPTS}
                  onSuggestedPrompt={handleSuggestedPromptAskLearn}
                />
              </motion.div>
            )}

            {/* ═══ ROADMAP FINDER ═══ */}
            {activeFeature === 'roadmap-finder' && (
              <motion.div
                key="roadmap-finder-chat"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="h-full"
              >
                <AssistantChatPanel
                  title="Roadmap Finder"
                  subtitle="Generate a structured career roadmap for any role"
                  assistantLabel="Roadmap Finder"
                  messages={roadmapMessages}
                  input={roadmapInput}
                  onInputChange={setRoadmapInput}
                  onSend={handleRoadmapSend}
                  canSubmit={roadmapCanSubmit}
                  isTyping={roadmapIsTyping}
                  errorText={roadmapErrorText}
                  canChat
                  inputPlaceholder="Enter your future job role (e.g. Data Scientist)..."
                  onBack={goHome}
                  onRestart={restartRoadmapFinder}
                  restartLabel="Restart Chat"
                  copiedId={roadmapCopiedId}
                  onCopy={(id, text) => copyToClipboard(id, text, setRoadmapCopiedId, setRoadmapErrorText)}
                  emptyStateText="Share your target role to generate a roadmap."
                  accentColor="emerald"
                  accentGradient="from-emerald-500 to-teal-600"
                  icon={MapPin}
                  suggestedPrompts={ROADMAP_PROMPTS}
                  onSuggestedPrompt={handleSuggestedPromptRoadmap}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
