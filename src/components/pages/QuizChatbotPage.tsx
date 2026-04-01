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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Track scroll for scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const fromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(fromBottom > 120);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setErrorText(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
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
      setMessages([createMessage('bot', reset.reply || OPENING_MESSAGE)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset session.';
      setErrorText(message);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* ─── Header ─── */}
      <div className="flex-none glass-panel rounded-t-3xl p-5 sm:p-6 flex items-center justify-between shadow-sm border border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-3 rounded-2xl shadow-lg shadow-indigo-200/50">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              Quiz Assistant <Sparkles className="w-5 h-5 text-amber-500" />
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 flex items-center gap-2">
              {canChat ? 'Azure AI Core • Online' : 'Read-Only Mode'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Stats Badge */}
          {questionCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-700">{questionCount} answered</span>
            </div>
          )}
          <button
            onClick={clearChat}
            className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2.5 border border-slate-200 rounded-xl text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Clear</span>
          </button>
          <button
            onClick={startNewSession}
            className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            title="Start New Session"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">New Session</span>
          </button>
        </div>
      </div>

      {/* ─── Chat Conversation Area ─── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white border-x border-slate-200/60 p-4 sm:p-6 space-y-5 relative custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`flex items-end gap-3 max-w-[85%] ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600'
                    : 'bg-white border border-slate-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-indigo-600" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="relative group">
                  <div
                    className={`px-5 py-3.5 shadow-sm text-[15px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-[1.5rem] rounded-br-[0.4rem]'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-[1.5rem] rounded-bl-[0.4rem]'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {msg.text}
                  </div>
                  {/* Copy button (bot messages only) */}
                  {msg.role === 'bot' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="absolute -right-2 -top-2 p-1.5 rounded-lg bg-white border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-medium text-slate-400 px-2">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-end gap-3 max-w-[85%] mr-auto"
            >
              <div className="shrink-0 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="px-5 py-4 shadow-sm bg-white border border-slate-100 rounded-[1.5rem] rounded-bl-[0.4rem] flex items-center gap-2">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="sticky bottom-4 mx-auto flex items-center gap-1.5 px-4 py-2 bg-white/90 backdrop-blur border border-slate-200 rounded-full shadow-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors z-10"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              Scroll to bottom
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Input Area ─── */}
      <div className="flex-none bg-white border border-slate-200/60 rounded-b-3xl p-4 sm:p-6 shadow-sm">
        {/* Unauthorized Warning */}
        {!canChat && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Unregistered users can view this page, but only logged-in student or tutor accounts can chat.</span>
          </div>
        )}

        {/* Error Alert */}
        {errorText && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        )}

        {/* Session Ended Actions */}
        {isSessionClosed && canChat && (
          <div className="mb-4 flex flex-col sm:flex-row items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <Check className="w-5 h-5" />
              Quiz session completed!
            </div>
            <button
              onClick={startNewSession}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Start New Quiz
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              rows={1}
              className="auto-resize-textarea w-full bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
              disabled={isTyping || !canChat || isSessionClosed}
            />
          </div>
          <motion.button
            whileHover={input.trim() && !isTyping ? { scale: 1.05 } : {}}
            whileTap={input.trim() && !isTyping ? { scale: 0.95 } : {}}
            onClick={handleSend}
            disabled={!input.trim() || isTyping || !canChat || isSessionClosed}
            className="flex-none w-13 h-13 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </motion.button>
        </div>

        <p className="text-center text-[11px] font-medium text-slate-400 mt-3">
          The AI might make mistakes. Consider verifying important academic information.
        </p>
      </div>
    </div>
  );
};
