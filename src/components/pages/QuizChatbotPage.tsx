import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Bot,
  User,
  Trash2,
  Sparkles,
  MessageSquarePlus,
  Lock,
  ArrowDown,
  Copy,
  Check,
  BarChart3,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { User as AppUser } from '../../types';

interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

interface QuizChatbotPageProps {
  currentUser: AppUser | null;
}

const OPENING_MESSAGE = 'Which subject are you weak in?';
const MESSAGE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;

const createMessage = (role: 'bot' | 'user', text: string): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  timestamp: new Date(),
});

export const QuizChatbotPage: React.FC<QuizChatbotPageProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([createMessage('bot', OPENING_MESSAGE)]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const hasInitializedScrollRef = useRef(false);

  const canChat = Boolean(currentUser && (currentUser.role === 'student' || currentUser.role === 'tutor'));

  const questionCount = useMemo(
    () => messages.filter((m) => m.role === 'user').length,
    [messages]
  );

  const inputPlaceholder = useMemo(() => {
    if (!currentUser) return 'Log in as a student or tutor to chat with Quiz Assistant.';
    if (!canChat) return 'Only student and tutor accounts can use this chatbot.';
    if (isSessionClosed) return 'Session ended. Start a new session to continue.';
    return 'Type your answer or request...';
  }, [canChat, currentUser, isSessionClosed]);

  const renderMessageText = useCallback((text: string) => {
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
            className="font-semibold underline underline-offset-2 hover:opacity-80 break-all"
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
  }, []);

  const canSubmit = Boolean(input.trim() && !isTyping && canChat && !isSessionClosed);

  const formatTimestamp = useCallback((value: Date) => (
    value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  ), []);

  const isNearBottom = useCallback((container: HTMLDivElement, threshold = 120) => {
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distance <= threshold;
  }, []);

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
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
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

  // Track scroll for scroll-to-bottom button
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
  }, [isNearBottom]);

  useEffect(() => {
    let isCancelled = false;
    const syncSession = async () => {
      if (!canChat || !currentUser) {
        setMessages([createMessage('bot', OPENING_MESSAGE)]);
        setIsSessionClosed(false);
        setErrorText(null);
        return;
      }
      try {
        const reset = await apiService.resetQuizChatSession({
          id: currentUser.id,
          role: currentUser.role,
        });
        if (isCancelled) return;
        shouldStickToBottomRef.current = true;
        setMessages([createMessage('bot', reset.reply || OPENING_MESSAGE)]);
        setIsSessionClosed(false);
        setErrorText(null);
      } catch (error) {
        if (isCancelled) return;
        const message =
          error instanceof Error ? error.message : 'Failed to initialize quiz chatbot session.';
        setErrorText(message);
        setMessages([createMessage('bot', OPENING_MESSAGE)]);
      }
    };
    syncSession();
    return () => { isCancelled = true; };
  }, [canChat, currentUser?.id, currentUser?.role]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isTyping || !canChat || !currentUser || isSessionClosed) return;

    const userMessage = createMessage('user', trimmedInput);
    shouldStickToBottomRef.current = true;
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setErrorText(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }

    try {
      const result = await apiService.sendQuizChatMessage(trimmedInput, {
        id: currentUser.id,
        role: currentUser.role,
      });
      setMessages((prev) => [...prev, createMessage('bot', result.reply)]);
      setIsSessionClosed(Boolean(result.sessionEnded));
    } catch (error) {
      const fallbackError = 'Unable to reach Quiz Assistant. Please try again.';
      const message = error instanceof Error ? error.message : fallbackError;
      setErrorText(message || fallbackError);
      setMessages((prev) => [
        ...prev,
        createMessage('bot', 'I hit a temporary issue. Please try again in a moment.'),
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {
        setErrorText('Unable to copy message to clipboard.');
      });
  };

  const clearChat = () => {
    shouldStickToBottomRef.current = true;
    setMessages([createMessage('bot', OPENING_MESSAGE)]);
    setIsTyping(false);
    setIsSessionClosed(false);
    setInput('');
    setErrorText(null);
  };

  const startNewSession = async () => {
    clearChat();
    if (!canChat || !currentUser) return;
    setIsTyping(true);
    try {
      const reset = await apiService.resetQuizChatSession({
        id: currentUser.id,
        role: currentUser.role,
      });
      shouldStickToBottomRef.current = true;
      setMessages([createMessage('bot', reset.reply || OPENING_MESSAGE)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset session.';
      setErrorText(message);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-0 overflow-hidden">
      <div className="flex w-full flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex-none glass-panel border-b border-slate-200/70 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative">
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 p-3 rounded-2xl shadow-lg shadow-indigo-300/45">
                  <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  Quiz Assistant <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
                  {canChat ? 'Personalized AI quiz coaching' : 'Read-only mode • Sign in to chat'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {questionCount > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-xs font-bold">{questionCount} prompts</span>
                </div>
              )}
              <button
                onClick={clearChat}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Clear Chat"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Clear</span>
              </button>
              <button
                onClick={startNewSession}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                title="Start New Session"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">New Session</span>
              </button>
            </div>
          </div>
        </div>

        <div
          ref={chatContainerRef}
          className="relative flex-1 overflow-y-auto custom-scrollbar border-x border-slate-200/70 bg-[radial-gradient(140%_100%_at_50%_0%,rgba(99,102,241,0.08)_0%,rgba(255,255,255,0.94)_42%,#ffffff_100%)] px-4 py-3 sm:px-8 sm:py-4"
        >
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className={`flex items-end gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-blue-500 shadow-indigo-200/80'
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    {msg.role === 'user'
                      ? <User className="w-4 h-4 text-white" />
                      : <Bot className="w-4 h-4 text-indigo-600" />}
                  </div>

                  <div className={`max-w-[min(86%,680px)] space-y-1.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`px-1 flex items-center gap-2 text-[11px] font-semibold ${msg.role === 'user' ? 'justify-end text-indigo-500' : 'text-slate-400'}`}>
                      <span>{msg.role === 'user' ? 'You' : 'Quiz Assistant'}</span>
                      <span className="text-slate-300">•</span>
                      <span>{formatTimestamp(msg.timestamp)}</span>
                    </div>

                    <div className="relative group">
                      <div
                        className={`px-5 py-3.5 sm:px-6 sm:py-4 text-[15px] leading-relaxed border ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 text-white border-indigo-500/70 rounded-[1.35rem] rounded-br-md shadow-[0_12px_34px_-16px_rgba(79,70,229,0.65)]'
                            : 'bg-white/95 text-slate-800 border-slate-200 rounded-[1.35rem] rounded-bl-md shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]'
                        }`}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {renderMessageText(msg.text)}
                      </div>

                      {msg.role === 'bot' && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="absolute -right-2 -top-2 p-1.5 rounded-lg bg-white border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-indigo-600"
                          title="Copy reply"
                        >
                          {copiedId === msg.id
                            ? <Check className="w-3 h-3 text-emerald-500" />
                            : <Copy className="w-3 h-3" />}
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
                  <div className="shrink-0 w-9 h-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="max-w-[min(86%,680px)] space-y-1.5">
                    <div className="px-1 text-[11px] font-semibold text-slate-400">Quiz Assistant • thinking...</div>
                    <div className="px-5 py-3.5 rounded-[1.35rem] rounded-bl-md bg-white border border-slate-200 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] inline-flex items-center gap-2">
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
                className="absolute bottom-5 right-5 flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                New messages
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-none border-t border-slate-200/70 bg-white/95 px-4 py-2.5 sm:px-6 sm:py-3">
          {!canChat && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Unregistered users can view this page, but only logged-in student or tutor accounts can chat.</span>
            </div>
          )}

          {errorText && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {errorText}
            </div>
          )}

          {isSessionClosed && canChat && (
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <Check className="w-5 h-5" />
                Quiz session completed.
              </div>
              <button
                onClick={startNewSession}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <MessageSquarePlus className="w-4 h-4" />
                Start New Quiz
              </button>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-slate-50/75 p-2.5 sm:p-3">
            <div className="flex items-stretch gap-2.5 sm:gap-3">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  rows={1}
                  className="auto-resize-textarea w-full bg-white border border-slate-200 text-slate-900 text-[15px] leading-relaxed font-medium rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
                  disabled={isTyping || !canChat || isSessionClosed}
                  style={{ minHeight: '48px' }}
                />
              </div>

              <motion.button
                whileHover={canSubmit ? { scale: 1.04 } : {}}
                whileTap={canSubmit ? { scale: 0.96 } : {}}
                onClick={handleSend}
                disabled={!canSubmit}
                className="flex-none w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/40 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
                title="Send message"
              >
                {isTyping
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4 ml-0.5" />}
              </motion.button>
            </div>

            <div className="mt-2 px-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] font-medium text-slate-400">
              <span>Press Enter to send • Shift + Enter for a new line</span>
              <span>{isTyping ? 'Assistant is preparing your response...' : 'Responses may contain mistakes; verify critical details.'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
