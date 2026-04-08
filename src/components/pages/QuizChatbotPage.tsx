import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Copy,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { User as AppUser } from '../../types';

type AssistantFeature = 'home' | 'skill-assessment' | 'ask-learn' | 'roadmap-finder';

type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: Date;
};

interface QuizChatbotPageProps {
  currentUser: AppUser | null;
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
}

type FeatureCard = {
  id: Exclude<AssistantFeature, 'home'>;
  title: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  accent: string;
};

const QUIZ_OPENING_MESSAGE = 'Which subject are you weak in?';
const MESSAGE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;
const ASK_LEARN_WELCOME_MESSAGE =
  'Hi! I am Ask & Learn AI. Ask me Science, Technology, Maths, Engineering, or ICT questions and I will teach step by step.';
const ROADMAP_WELCOME_MESSAGE =
  'Hi! I am Roadmap Finder. Tell me a future job role, and I will generate a structured roadmap to help you achieve it.';

const AI_FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'skill-assessment',
    title: 'Skill Assessment AI',
    description: 'Test your knowledge and get a personalized learning plan powered by AI.',
    cta: 'Start Assessment',
    icon: BarChart3,
    accent: 'from-sky-500 to-indigo-600',
  },
  {
    id: 'ask-learn',
    title: 'Ask & Learn AI',
    description: 'AI learning assistant for Science, Technology, Maths, Engineering, and ICT questions.',
    cta: 'Open Chat',
    icon: MessageSquare,
    accent: 'from-indigo-500 to-cyan-500',
  },
  {
    id: 'roadmap-finder',
    title: 'Roadmap Finder',
    description: 'Students can ask for a future job role and get a roadmap to achieve it.',
    cta: 'Generate Roadmap',
    icon: MapPin,
    accent: 'from-cyan-500 to-blue-600',
  },
];

const createMessage = (role: AssistantMessage['role'], text: string): AssistantMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  timestamp: new Date(),
});

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
          className="break-all font-semibold underline underline-offset-2 hover:opacity-80"
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

  return (
    <section className="flex h-full flex-col overflow-hidden">
      <div className="flex-none border-b border-slate-200/70 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={onBack}
              className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600"
              title="Back to AI tools"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                {title}
                <Sparkles className="h-4 w-4 text-amber-500 sm:h-5 sm:w-5" />
              </h2>
              <p className="text-xs font-semibold text-slate-500 sm:text-sm">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {progressLabel && (
              <div className="hidden items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-700 sm:flex">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs font-bold">{progressLabel}</span>
              </div>
            )}
            <button
              onClick={() => void onRestart()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700 sm:px-4 sm:py-2.5"
              title={restartLabel}
            >
              <RotateCcw className="h-4 w-4" />
              <span>{restartLabel}</span>
            </button>
          </div>
        </div>

        {typeof progressPercent === 'number' && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600"
              />
            </div>
          </div>
        )}
      </div>

      <div
        ref={chatContainerRef}
        className="relative flex-1 overflow-y-auto custom-scrollbar border-x border-slate-200/70 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(99,102,241,0.1)_0%,rgba(255,255,255,0.96)_38%,#ffffff_100%)] px-4 py-4 sm:px-8"
      >
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {messages.length === 0 && !isTyping && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{emptyStateText || 'Preparing your AI session...'}</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className={`flex items-end gap-3 sm:gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`h-9 w-9 shrink-0 rounded-2xl flex items-center justify-center shadow-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-blue-500 shadow-indigo-200/80'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  {message.role === 'user'
                    ? <User className="h-4 w-4 text-white" />
                    : <Bot className="h-4 w-4 text-indigo-600" />}
                </div>

                <div className={`max-w-[min(88%,680px)] space-y-1.5 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`px-1 flex items-center gap-2 text-[11px] font-semibold ${message.role === 'user' ? 'justify-end text-indigo-500' : 'text-slate-400'}`}>
                    <span>{message.role === 'user' ? 'You' : assistantLabel}</span>
                    <span className="text-slate-300">•</span>
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>

                  <div className="group relative">
                    <div
                      className={`border px-5 py-3.5 text-[15px] leading-relaxed sm:px-6 sm:py-4 ${
                        message.role === 'user'
                          ? 'rounded-[1.35rem] rounded-br-md border-indigo-500/70 bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 text-white shadow-[0_12px_34px_-16px_rgba(79,70,229,0.65)]'
                          : 'rounded-[1.35rem] rounded-bl-md border-slate-200 bg-white/95 text-slate-800 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]'
                      }`}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {renderMessageText(message.text)}
                    </div>

                    {message.role === 'assistant' && (
                      <button
                        onClick={() => onCopy(message.id, message.text)}
                        className="absolute -right-2 -top-2 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm opacity-0 transition-opacity hover:text-indigo-600 group-hover:opacity-100"
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

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-end gap-3 sm:gap-4"
              >
                <div className="h-9 w-9 shrink-0 rounded-2xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="max-w-[min(88%,680px)] space-y-1.5">
                  <div className="px-1 text-[11px] font-semibold text-slate-400">{assistantLabel} • typing...</div>
                  <div className="inline-flex items-center gap-2 rounded-[1.35rem] rounded-bl-md border border-slate-200 bg-white px-5 py-3.5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="ml-1 text-sm font-medium text-slate-500">AI is thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              onClick={scrollToBottom}
              className="absolute bottom-5 right-5 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-bold text-slate-600 shadow-lg backdrop-blur transition-colors hover:border-indigo-200 hover:text-indigo-600"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              New messages
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-none border-t border-slate-200/70 bg-white/95 px-4 py-3 sm:px-6">
        {!canChat && lockMessage && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{lockMessage}</span>
          </div>
        )}

        {errorText && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {errorText}
          </div>
        )}

        {completionText && completionCtaLabel && onCompletionCta && (
          <div className="mb-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
              <Check className="h-5 w-5" />
              {completionText}
            </div>
            <button
              onClick={() => void onCompletionCta()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <RotateCcw className="h-4 w-4" />
              {completionCtaLabel}
            </button>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50/75 p-2.5 sm:p-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                rows={1}
                className="auto-resize-textarea w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] font-medium leading-relaxed text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25"
                disabled={disabledComposer}
                style={{ minHeight: '48px' }}
              />
            </div>

            <motion.button
              ref={sendButtonRef}
              whileHover={canSubmit ? { scale: 1.04 } : {}}
              whileTap={canSubmit ? { scale: 0.96 } : {}}
              onClick={handleSendClick}
              disabled={!canSubmit}
              className="flex-none h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-300/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none"
              title="Send message"
            >
              {isTyping
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </motion.button>
          </div>

          <div className="mt-2 flex flex-col gap-1 px-1 text-[11px] font-medium text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Press Enter to send • Shift + Enter for a new line</span>
            <span>{isTyping ? 'Assistant is preparing your response...' : 'Responses may contain mistakes; verify critical details.'}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export const QuizChatbotPage: React.FC<QuizChatbotPageProps> = ({ currentUser }) => {
  const [activeFeature, setActiveFeature] = useState<AssistantFeature>('home');

  const [quizMessages, setQuizMessages] = useState<AssistantMessage[]>([]);
  const [quizInput, setQuizInput] = useState('');
  const [quizIsTyping, setQuizIsTyping] = useState(false);
  const [quizSessionClosed, setQuizSessionClosed] = useState(false);
  const [quizErrorText, setQuizErrorText] = useState<string | null>(null);
  const [quizCopiedId, setQuizCopiedId] = useState<string | null>(null);
  const [quizHasStarted, setQuizHasStarted] = useState(false);

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

  const quizInputPlaceholder = useMemo(() => {
    if (!quizHasStarted) return 'Start the assessment to begin.';
    if (!currentUser) return 'Log in as a student or tutor to use Skill Assessment AI.';
    if (!canQuizChat) return 'Only student and tutor accounts can use Skill Assessment AI.';
    if (quizSessionClosed) return 'Session ended. Restart session to continue.';
    return 'Type your answer or request...';
  }, [canQuizChat, currentUser, quizHasStarted, quizSessionClosed]);

  const quizCanSubmit = Boolean(
    quizHasStarted &&
    quizInput.trim() &&
    !quizIsTyping &&
    canQuizChat &&
    !quizSessionClosed
  );

  const askCanSubmit = Boolean(askInput.trim() && !askIsTyping);
  const roadmapCanSubmit = Boolean(roadmapInput.trim() && !roadmapIsTyping);

  useEffect(() => {
    let isCancelled = false;

    if (activeFeature !== 'skill-assessment' || !quizHasStarted) {
      return () => {
        isCancelled = true;
      };
    }

    const syncSession = async () => {
      if (!canQuizChat || !currentUser) {
        setQuizMessages([createMessage('assistant', QUIZ_OPENING_MESSAGE)]);
        setQuizSessionClosed(false);
        setQuizErrorText(null);
        return;
      }

      setQuizIsTyping(true);
      try {
        const reset = await apiService.resetQuizChatSession({
          id: currentUser.id,
          role: currentUser.role,
        });

        if (isCancelled) return;

        setQuizMessages([createMessage('assistant', reset.reply || QUIZ_OPENING_MESSAGE)]);
        setQuizSessionClosed(false);
        setQuizErrorText(null);
      } catch (error) {
        if (isCancelled) return;

        const message = error instanceof Error
          ? error.message
          : 'Failed to initialize skill assessment session.';
        setQuizErrorText(message);
        setQuizMessages([createMessage('assistant', QUIZ_OPENING_MESSAGE)]);
      } finally {
        if (!isCancelled) {
          setQuizIsTyping(false);
        }
      }
    };

    void syncSession();

    return () => {
      isCancelled = true;
    };
  }, [activeFeature, canQuizChat, currentUser, quizHasStarted]);

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

  const handleQuizSend = async () => {
    const trimmedInput = quizInput.trim();
    if (!trimmedInput || quizIsTyping || !canQuizChat || !currentUser || quizSessionClosed) {
      return;
    }

    setQuizMessages((previous) => [...previous, createMessage('user', trimmedInput)]);
    setQuizInput('');
    setQuizIsTyping(true);
    setQuizErrorText(null);

    try {
      const result = await apiService.sendQuizChatMessage(trimmedInput, {
        id: currentUser.id,
        role: currentUser.role,
      });

      setQuizMessages((previous) => [...previous, createMessage('assistant', result.reply)]);
      setQuizSessionClosed(Boolean(result.sessionEnded));
    } catch (error) {
      const fallbackError = 'Unable to reach AI Assistant. Please try again.';
      const message = error instanceof Error ? error.message : fallbackError;

      setQuizErrorText(message || fallbackError);
      setQuizMessages((previous) => [
        ...previous,
        createMessage('assistant', 'I hit a temporary issue. Please try again in a moment.'),
      ]);
    } finally {
      setQuizIsTyping(false);
    }
  };

  const restartQuizSession = async () => {
    setQuizMessages([createMessage('assistant', QUIZ_OPENING_MESSAGE)]);
    setQuizSessionClosed(false);
    setQuizErrorText(null);
    setQuizInput('');

    if (!canQuizChat || !currentUser) {
      setQuizIsTyping(false);
      return;
    }

    setQuizIsTyping(true);
    try {
      const reset = await apiService.resetQuizChatSession({
        id: currentUser.id,
        role: currentUser.role,
      });

      setQuizMessages([createMessage('assistant', reset.reply || QUIZ_OPENING_MESSAGE)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset session.';
      setQuizErrorText(message);
    } finally {
      setQuizIsTyping(false);
    }
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

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden px-3 py-2 sm:px-4 lg:px-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_30px_90px_-42px_rgba(15,23,42,0.5)]">
          <AnimatePresence mode="wait" initial={false}>
            {activeFeature === 'home' && (
              <motion.section
                key="ai-assistant-home"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="h-full overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.7)_0%,rgba(255,255,255,1)_35%)] px-5 py-8 sm:px-8"
              >
                <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-10">
                  <div className="space-y-4 text-center">
                    <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-xl shadow-sky-200/70">
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">AI Assistant</h1>
                    <p className="mx-auto max-w-3xl text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                      Choose an AI tool to assess your skills, ask STEM/ICT questions, or generate a career roadmap.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-3">
                    {AI_FEATURE_CARDS.map((card) => {
                      const Icon = card.icon;

                      return (
                        <motion.button
                          key={card.id}
                          whileHover={{ y: -4 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setActiveFeature(card.id)}
                          className="text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.5)] transition-shadow hover:shadow-[0_20px_45px_-24px_rgba(79,70,229,0.45)]"
                        >
                          <div className="space-y-4">
                            <div className={`inline-flex rounded-2xl bg-gradient-to-br ${card.accent} p-3 text-white shadow-lg shadow-slate-200`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-black tracking-tight text-slate-900">{card.title}</h3>
                              <p className="text-sm leading-relaxed text-slate-600">{card.description}</p>
                            </div>
                            <div className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600">
                              <span>{card.cta}</span>
                              <ArrowRight className="h-4 w-4" />
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            )}

            {activeFeature === 'skill-assessment' && !quizHasStarted && (
              <motion.section
                key="skill-assessment-intro"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="h-full overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.7)_0%,rgba(255,255,255,1)_35%)] px-5 py-8 sm:px-8"
              >
                <div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-center gap-8">
                  <div>
                    <button
                      onClick={goHome}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to AI tools
                    </button>
                  </div>

                  <div className="space-y-4 text-center">
                    <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-xl shadow-sky-200/70">
                      <BarChart3 className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Skill Assessment AI</h2>
                    <p className="mx-auto max-w-2xl text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                      Hi 👋 I am your AI Assistant. I will help you identify weak areas and improve step by step.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      'Choose your subject',
                      'Take a short adaptive quiz',
                      'Get a personalized study plan',
                    ].map((step, index) => (
                      <div
                        key={step}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_16px_36px_-28px_rgba(15,23,42,0.5)]"
                      >
                        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <p className="text-sm font-semibold text-slate-700">{step}</p>
                      </div>
                    ))}
                  </div>

                  {!canQuizChat && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Unregistered users can view this flow, but only logged-in student or tutor accounts can chat.</span>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setQuizHasStarted(true);
                        setQuizErrorText(null);
                        setQuizInput('');
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-8 py-3 text-sm font-black text-white shadow-xl shadow-indigo-200 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Start Quiz
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {activeFeature === 'skill-assessment' && quizHasStarted && (
              <motion.div
                key="skill-assessment-chat"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="h-full"
              >
                <AssistantChatPanel
                  title="Skill Assessment AI"
                  subtitle="Test your knowledge and get a personalized learning plan powered by AI"
                  assistantLabel="AI Assistant"
                  messages={quizMessages}
                  input={quizInput}
                  onInputChange={setQuizInput}
                  onSend={handleQuizSend}
                  canSubmit={quizCanSubmit}
                  isTyping={quizIsTyping}
                  errorText={quizErrorText}
                  canChat={canQuizChat}
                  lockMessage="Only logged-in student or tutor accounts can use Skill Assessment AI chat."
                  inputPlaceholder={quizInputPlaceholder}
                  onBack={goHome}
                  onRestart={restartQuizSession}
                  restartLabel="Restart Session"
                  copiedId={quizCopiedId}
                  onCopy={(id, text) => copyToClipboard(id, text, setQuizCopiedId, setQuizErrorText)}
                  disableInput={!quizHasStarted || quizSessionClosed}
                  completionText={quizSessionClosed ? 'Study session completed.' : null}
                  completionCtaLabel={quizSessionClosed ? 'Start New Session' : undefined}
                  onCompletionCta={quizSessionClosed ? restartQuizSession : undefined}
                />
              </motion.div>
            )}

            {activeFeature === 'ask-learn' && (
              <motion.div
                key="ask-learn-chat"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="h-full"
              >
                <AssistantChatPanel
                  title="Ask & Learn AI"
                  subtitle="Science, Technology, Maths, Engineering, and ICT learning assistant"
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
                />
              </motion.div>
            )}

            {activeFeature === 'roadmap-finder' && (
              <motion.div
                key="roadmap-finder-chat"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="h-full"
              >
                <AssistantChatPanel
                  title="Roadmap Finder"
                  subtitle="Ask for a future job role and get a structured roadmap"
                  assistantLabel="Roadmap Finder"
                  messages={roadmapMessages}
                  input={roadmapInput}
                  onInputChange={setRoadmapInput}
                  onSend={handleRoadmapSend}
                  canSubmit={roadmapCanSubmit}
                  isTyping={roadmapIsTyping}
                  errorText={roadmapErrorText}
                  canChat
                  inputPlaceholder="Enter your future job role (for example: Data Scientist)..."
                  onBack={goHome}
                  onRestart={restartRoadmapFinder}
                  restartLabel="Restart Chat"
                  copiedId={roadmapCopiedId}
                  onCopy={(id, text) => copyToClipboard(id, text, setRoadmapCopiedId, setRoadmapErrorText)}
                  emptyStateText="Share your target role to generate a roadmap."
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
