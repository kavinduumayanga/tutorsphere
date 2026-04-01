import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Bot,
  User,
  Trash2,
  Sparkles,
  MessageSquarePlus,
  HelpCircle,
  Loader2,
  Lock,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canChat = Boolean(currentUser && (currentUser.role === 'student' || currentUser.role === 'tutor'));

  const inputPlaceholder = useMemo(() => {
    if (!currentUser) {
      return 'Log in as a student or tutor to chat with Quiz Assistant.';
    }

    if (!canChat) {
      return 'Only student and tutor accounts can use this chatbot.';
    }

    if (isSessionClosed) {
      return 'Session ended. Start a new session to continue.';
    }

    return 'Type your answer or request...';
  }, [canChat, currentUser, isSessionClosed]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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

        if (isCancelled) {
          return;
        }

        setMessages([createMessage('bot', reset.reply || OPENING_MESSAGE)]);
        setIsSessionClosed(false);
        setErrorText(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to initialize quiz chatbot session.';
        setErrorText(message);
        setMessages([createMessage('bot', OPENING_MESSAGE)]);
      }
    };

    syncSession();

    return () => {
      isCancelled = true;
    };
  }, [canChat, currentUser?.id, currentUser?.role]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isTyping || !canChat || !currentUser || isSessionClosed) {
      return;
    }

    const userMessage = createMessage('user', trimmedInput);

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setErrorText(null);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
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

    if (!canChat || !currentUser) {
      return;
    }

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
      
      {/* Header Area */}
      <div className="flex-none bg-white rounded-t-3xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 p-3 rounded-2xl">
            <Bot className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Quiz Assistant <Sparkles className="w-5 h-5 text-amber-500" />
            </h1>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              {canChat ? 'Azure AI Core Online' : 'Read-Only Mode'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={clearChat}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
          <button 
            onClick={startNewSession}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </div>

      {/* Chat Conversation Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 border-x border-slate-200 p-4 sm:p-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`flex items-end gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-white border border-slate-200'}`}>
                {msg.role === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              
              <div 
                className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`px-5 py-4 shadow-sm text-[15px] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-[2rem] rounded-br-[0.5rem]' 
                      : 'bg-white border border-slate-100 text-slate-800 rounded-[2rem] rounded-bl-[0.5rem]'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {msg.text}
                </div>
                <span className="text-xs font-medium text-slate-400 px-2">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-3 max-w-[85%] mr-auto"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="px-5 py-4 shadow-sm bg-white border border-slate-100 rounded-[2rem] rounded-bl-[0.5rem] flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                <span className="text-sm font-medium text-slate-500">AI is thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-none bg-white border border-slate-200 rounded-b-3xl p-4 sm:p-6 shadow-sm">
        {!canChat && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <Lock className="w-4 h-4 mt-0.5" />
            <span>Unregistered users can view this page, but only logged-in student or tutor accounts can chat.</span>
          </div>
        )}

        {errorText && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        )}
        
        {/* Quick Actions / Suggestions */}
        {messages.length === 1 && canChat && !isSessionClosed && (
          <div className="flex flex-wrap gap-2 mb-4">
            {['Mathematics', 'Physics', 'ICT', 'How does this quiz work?'].map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setInput(suggestion)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors flex items-center gap-2"
              >
                {suggestion === 'How does this quiz work?' ? <HelpCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-base font-medium rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              disabled={isTyping || !canChat || isSessionClosed}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || !canChat || isSessionClosed}
            className="flex-none w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
          >
            <Send className="w-6 h-6 ml-1" />
          </button>
        </div>
        <p className="text-center text-xs font-medium text-slate-400 mt-4">
          The AI might make mistakes. Consider verifying important academic information.
        </p>
      </div>

    </div>
  );
};
