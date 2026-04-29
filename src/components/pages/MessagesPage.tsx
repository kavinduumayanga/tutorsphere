import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  MessageCircle,
  RefreshCw,
  Search,
  SendHorizontal,
  Shield,
  Trash2,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { User, MessageConversation, DirectMessage } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';

interface MessagesPageProps {
  currentUser: User;
  initialParticipantId?: string | null;
  onInitialParticipantHandled?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

type MobilePane = 'list' | 'chat';

const CONVERSATION_LIST_POLL_INTERVAL_MS = 6000;
const ACTIVE_CONVERSATION_POLL_INTERVAL_MS = 4000;
const PRESENCE_POLL_INTERVAL_MS = 15000;

const getConversationSortValue = (conversation: MessageConversation): number => {
  const candidate = conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt;
  const timestamp = new Date(candidate).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }
  return timestamp;
};

const sortConversations = (items: MessageConversation[]): MessageConversation[] => {
  return [...items].sort((a, b) => getConversationSortValue(b) - getConversationSortValue(a));
};

const upsertConversation = (
  conversations: MessageConversation[],
  incomingConversation: MessageConversation
): MessageConversation[] => {
  const exists = conversations.some((conversation) => conversation.id === incomingConversation.id);
  const nextConversations = exists
    ? conversations.map((conversation) =>
      conversation.id === incomingConversation.id ? incomingConversation : conversation
    )
    : [incomingConversation, ...conversations];

  return sortConversations(nextConversations);
};

const getInitials = (firstName: string, lastName: string): string => {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();

  if (first && last) {
    return `${first}${last}`;
  }

  if (first) {
    return first;
  }

  if (last) {
    return last;
  }

  return 'U';
};

const formatConversationTimestamp = (isoDate: string | null | undefined): string => {
  if (!isoDate) {
    return '';
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const now = new Date();
  const isSameDay =
    parsed.getDate() === now.getDate() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMessageTimestamp = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatRelativeLastSeen = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }

  const diffMs = Math.max(0, Date.now() - parsed.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 1) {
    return 'just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getParticipantPresenceLabel = (participant: MessageConversation['otherParticipant']): string => {
  if (participant.isOnline) {
    return 'Active now';
  }

  if (participant.lastSeenAt) {
    return `Last seen ${formatRelativeLastSeen(participant.lastSeenAt)}`;
  }

  return 'Offline';
};

const isMobileViewport = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(max-width: 767px)').matches;
};

export const MessagesPage: React.FC<MessagesPageProps> = ({
  currentUser,
  initialParticipantId,
  onInitialParticipantHandled,
  onUnreadCountChange,
}) => {
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isOpeningDirectConversation, setIsOpeningDirectConversation] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeUserIdRef = useRef(currentUser.id);

  useEffect(() => {
    activeUserIdRef.current = currentUser.id;
  }, [currentUser.id]);

  useEffect(() => {
    setConversations([]);
    setSelectedConversationId(null);
    setMessages([]);
    setSearchQuery('');
    setDraftMessage('');
    setConversationsError(null);
    setMessagesError(null);
    setSendError(null);
    setMobilePane('list');
  }, [currentUser.id]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const fullName = `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`
        .trim()
        .toLowerCase();
      const preview = String(conversation.lastMessagePreview || '').toLowerCase();
      return fullName.includes(query) || preview.includes(query);
    });
  }, [conversations, searchQuery]);

  const syncConversations = useCallback(
    async (silent = false) => {
      const requestUserId = currentUser.id;

      if (!silent) {
        setIsLoadingConversations(true);
      } else {
        setIsRefreshingConversations(true);
      }

      try {
        const response = await apiService.getMessageConversations();
        if (activeUserIdRef.current !== requestUserId) {
          return;
        }

        const nextConversations = sortConversations(response.conversations || []);

        setConversations(nextConversations);
        setConversationsError(null);
        onUnreadCountChange?.(Math.max(0, Number(response.totalUnreadCount || 0)));

        setSelectedConversationId((previousId) => {
          if (previousId && nextConversations.some((conversation) => conversation.id === previousId)) {
            return previousId;
          }

          return nextConversations[0]?.id || null;
        });
      } catch (error) {
        if (activeUserIdRef.current !== requestUserId) {
          return;
        }

        if (!silent) {
          const message =
            error instanceof Error ? error.message : 'Failed to load your conversations.';
          setConversationsError(message);
        }
      } finally {
        if (activeUserIdRef.current === requestUserId) {
          if (!silent) {
            setIsLoadingConversations(false);
          } else {
            setIsRefreshingConversations(false);
          }
        }
      }
    },
    [currentUser.id, onUnreadCountChange]
  );

  useEffect(() => {
    void syncConversations();

    const intervalId = window.setInterval(() => {
      void syncConversations(true);
    }, CONVERSATION_LIST_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [syncConversations]);

  useEffect(() => {
    let isCancelled = false;

    const pingPresence = async () => {
      try {
        await apiService.pingMessagePresence();
      } catch {
        // Ignore transient presence ping failures and keep polling.
      }
    };

    void pingPresence();

    const intervalId = window.setInterval(() => {
      void pingPresence();
    }, PRESENCE_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (isCancelled) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void pingPresence();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (!initialParticipantId) {
      return;
    }

    let isCancelled = false;

    const openDirectConversation = async () => {
      const requestUserId = currentUser.id;
      setIsOpeningDirectConversation(true);

      try {
        const response = await apiService.openDirectConversation(initialParticipantId);

        if (isCancelled || activeUserIdRef.current !== requestUserId) {
          return;
        }

        setConversations((previousConversations) =>
          upsertConversation(previousConversations, response.conversation)
        );
        setSelectedConversationId(response.conversation.id);
        setConversationsError(null);

        if (isMobileViewport()) {
          setMobilePane('chat');
        }

        await syncConversations(true);
      } catch (error) {
        if (isCancelled || activeUserIdRef.current !== requestUserId) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Failed to open the direct conversation.';
        setConversationsError(message);
      } finally {
        if (!isCancelled) {
          setIsOpeningDirectConversation(false);
          onInitialParticipantHandled?.();
        }
      }
    };

    void openDirectConversation();

    return () => {
      isCancelled = true;
    };
  }, [currentUser.id, initialParticipantId, onInitialParticipantHandled, syncConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    let isCancelled = false;

    const loadMessages = async (silent = false) => {
      const requestUserId = currentUser.id;
      const requestConversationId = selectedConversationId;

      if (!silent) {
        setIsLoadingMessages(true);
      }

      try {
        const response = await apiService.getConversationMessages(requestConversationId, { limit: 120 });

        if (
          isCancelled ||
          activeUserIdRef.current !== requestUserId ||
          selectedConversationId !== requestConversationId
        ) {
          return;
        }

        setMessages(response.messages || []);
        setMessagesError(null);
        setConversations((previousConversations) =>
          upsertConversation(previousConversations, response.conversation)
        );

        if (response.conversation.unreadCount > 0) {
          const readResponse = await apiService.markConversationAsRead(requestConversationId);
          if (
            isCancelled ||
            activeUserIdRef.current !== requestUserId ||
            selectedConversationId !== requestConversationId
          ) {
            return;
          }

          setConversations((previousConversations) =>
            previousConversations.map((conversation) =>
              conversation.id === requestConversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation
            )
          );

          onUnreadCountChange?.(Math.max(0, Number(readResponse.totalUnreadCount || 0)));
        }
      } catch (error) {
        if (isCancelled || activeUserIdRef.current !== requestUserId) {
          return;
        }

        if (!silent) {
          const message =
            error instanceof Error ? error.message : 'Failed to load messages for this conversation.';
          setMessagesError(message);
        }
      } finally {
        if (!silent && !isCancelled && activeUserIdRef.current === currentUser.id) {
          setIsLoadingMessages(false);
        }
      }
    };

    void loadMessages();

    const intervalId = window.setInterval(() => {
      void loadMessages(true);
    }, ACTIVE_CONVERSATION_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentUser.id, selectedConversationId, onUnreadCountChange]);

  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selectedConversationId, messages]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMessagesError(null);
    setSendError(null);

    if (isMobileViewport()) {
      setMobilePane('chat');
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || deletingConversationId) {
      return;
    }

    const participantName = `${selectedConversation.otherParticipant.firstName} ${selectedConversation.otherParticipant.lastName}`.trim() || 'this user';
    const shouldDelete = window.confirm(
      `Delete this entire chat with ${participantName}? This will permanently remove all messages in this conversation.`
    );

    if (!shouldDelete) {
      return;
    }

    const removedConversationId = selectedConversation.id;
    setDeletingConversationId(removedConversationId);
    setSendError(null);
    setMessagesError(null);

    // Optimistic removal keeps the UI in sync while the delete request is in flight.
    setConversations((previousConversations) =>
      sortConversations(
        previousConversations.filter((conversation) => conversation.id !== removedConversationId)
      )
    );
    setSelectedConversationId(null);
    setMessages([]);

    try {
      const response = await apiService.deleteMessageConversation(removedConversationId);
      onUnreadCountChange?.(Math.max(0, Number(response.totalUnreadCount || 0)));
      await syncConversations(true);

      if (isMobileViewport()) {
        setMobilePane('list');
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Failed to delete chat conversation.';
      setSendError(messageText);
      await syncConversations(true);
    } finally {
      setDeletingConversationId(null);
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = draftMessage.trim();

    if (!selectedConversationId || !trimmedMessage || isSendingMessage) {
      return;
    }

    setIsSendingMessage(true);
    setSendError(null);

    try {
      const response = await apiService.sendConversationMessage(selectedConversationId, trimmedMessage);
      setDraftMessage('');

      setMessages((previousMessages) => [...previousMessages, response.message]);
      setConversations((previousConversations) =>
        upsertConversation(previousConversations, response.conversation)
      );
      onUnreadCountChange?.(Math.max(0, Number(response.totalUnreadCount || 0)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send your message.';
      setSendError(message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (message: DirectMessage) => {
    if (!selectedConversationId || message.senderId !== currentUser.id || message.isDeleted) {
      return;
    }

    const shouldDelete = window.confirm(
      'Delete this message? It will remain in the chat as a deleted placeholder.'
    );
    if (!shouldDelete) {
      return;
    }

    setDeletingMessageId(message.id);
    setSendError(null);

    try {
      const response = await apiService.deleteConversationMessage(
        selectedConversationId,
        message.id
      );

      setMessages((previousMessages) =>
        previousMessages.map((entry) =>
          entry.id === response.message.id ? response.message : entry
        )
      );
      setConversations((previousConversations) =>
        upsertConversation(previousConversations, response.conversation)
      );
      onUnreadCountChange?.(Math.max(0, Number(response.totalUnreadCount || 0)));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Failed to delete message.';
      setSendError(messageText);
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
            <Shield className="h-3.5 w-3.5" />
            Secure In-Platform Chat
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Messages
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
            Chat with tutors and students directly inside TutorSphere without sharing external contact details.
          </p>
        </div>

        <button
          onClick={() => {
            void syncConversations();
          }}
          disabled={isRefreshingConversations || isLoadingConversations}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${(isRefreshingConversations || isLoadingConversations) ? 'animate-spin' : ''}`} />
          {isRefreshingConversations || isLoadingConversations ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={`${mobilePane === 'chat' ? 'hidden md:flex' : 'flex'} flex-col border-r border-slate-100 bg-slate-50/60`}
        >
          <div className="border-b border-slate-100 bg-white px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {isLoadingConversations ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-slate-100 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 rounded bg-slate-200" />
                        <div className="h-3 w-full rounded bg-slate-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversationsError ? (
              <ErrorState
                title="Could not load messages"
                message={conversationsError}
                onRetry={() => {
                  void syncConversations();
                }}
                className="px-4"
              />
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title={searchQuery.trim() ? 'No matches found' : 'No conversations yet'}
                description={
                  searchQuery.trim()
                    ? 'Try a different name or keyword.'
                    : 'Open a tutor profile and click Message Tutor to start your first conversation.'
                }
                className="px-4"
              />
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conversation) => {
                  const isActive = selectedConversationId === conversation.id;
                  const participant = conversation.otherParticipant;
                  const participantName = `${participant.firstName} ${participant.lastName}`.trim();
                  const presenceLabel = getParticipantPresenceLabel(participant);

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                        isActive
                          ? 'border-indigo-200 bg-indigo-50 shadow-sm shadow-indigo-100'
                          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
                          {participant.avatar ? (
                            <img
                              src={participant.avatar}
                              alt={participantName}
                              className="relative z-10 h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">
                            {getInitials(participant.firstName, participant.lastName)}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 z-20 h-3.5 w-3.5 rounded-full border-2 border-white ${participant.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-slate-900">{participantName || 'Unknown User'}</p>
                            <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                              {formatConversationTimestamp(conversation.lastMessageAt)}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                            {conversation.lastMessagePreview || 'No messages yet. Start the conversation.'}
                          </p>

                          <p className={`mt-1 text-[11px] font-semibold ${participant.isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {presenceLabel}
                          </p>
                        </div>

                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex min-w-[1.45rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-1 text-[10px] font-black text-white">
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className={`${mobilePane === 'list' ? 'hidden md:flex' : 'flex'} min-h-0 flex-col bg-white`}>
          {!selectedConversation ? (
            <EmptyState
              icon={MessageCircle}
              title={isOpeningDirectConversation ? 'Opening conversation...' : 'Select a conversation'}
              description="Choose a chat from the left panel to start messaging."
              className="h-full"
            />
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setMobilePane('list')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 md:hidden"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200">
                    {selectedConversation.otherParticipant.avatar ? (
                      <img
                        src={selectedConversation.otherParticipant.avatar}
                        alt={`${selectedConversation.otherParticipant.firstName} ${selectedConversation.otherParticipant.lastName}`}
                        className="relative z-10 h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">
                      {getInitials(
                        selectedConversation.otherParticipant.firstName,
                        selectedConversation.otherParticipant.lastName
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 z-20 h-3.5 w-3.5 rounded-full border-2 border-white ${selectedConversation.otherParticipant.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">
                      {`${selectedConversation.otherParticipant.firstName} ${selectedConversation.otherParticipant.lastName}`.trim()}
                    </p>
                    <p className={`text-xs font-semibold ${selectedConversation.otherParticipant.isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {getParticipantPresenceLabel(selectedConversation.otherParticipant)}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {selectedConversation.otherParticipant.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">
                    In platform
                  </div>
                  <button
                    onClick={() => {
                      setSelectedConversationId(null);
                      setMessages([]);
                      setMessagesError(null);
                      setSendError(null);
                      if (isMobileViewport()) {
                        setMobilePane('list');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Clear Chat
                  </button>
                  <button
                    onClick={() => {
                      void handleDeleteConversation();
                    }}
                    disabled={deletingConversationId === selectedConversation.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingConversationId === selectedConversation.id ? 'Deleting...' : 'Delete Chat'}
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/70 px-5 py-4">
                {isLoadingMessages ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className={`flex ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-[75%] animate-pulse rounded-2xl bg-slate-200 px-4 py-3">
                          <div className="h-3 w-36 rounded bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messagesError ? (
                  <ErrorState
                    title="Could not load chat"
                    message={messagesError}
                    onRetry={() => {
                      const retryConversationId = selectedConversationId;
                      setMessagesError(null);
                      if (retryConversationId) {
                        setSelectedConversationId(null);
                        window.setTimeout(() => {
                          setSelectedConversationId(retryConversationId);
                        }, 0);
                      }
                    }}
                  />
                ) : messages.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="No messages yet"
                    description="Start the conversation with a quick introduction."
                  />
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isMine = message.senderId === currentUser.id;
                      const isDeleted = Boolean(message.isDeleted);
                      const isDeleting = deletingMessageId === message.id;
                      const deletedLabel = isMine ? 'You deleted this message.' : 'This message was deleted.';

                      return (
                        <div
                          key={message.id}
                          className={`group/message flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`relative max-w-[82%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
                              isDeleted
                                ? 'border border-dashed border-slate-300 bg-slate-100 text-slate-500'
                                : isMine
                                  ? 'rounded-br-md bg-indigo-600 text-white'
                                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isDeleted ? 'italic' : ''}`}>
                              {isDeleted ? deletedLabel : message.content}
                            </p>
                            <p
                              className={`mt-1.5 text-[11px] font-semibold ${
                                isDeleted
                                  ? 'text-slate-400'
                                  : isMine
                                    ? 'text-indigo-100/90'
                                    : 'text-slate-400'
                              }`}
                            >
                              {formatMessageTimestamp(message.createdAt)}
                            </p>

                            {isMine && !isDeleted && (
                              <button
                                onClick={() => {
                                  void handleDeleteMessage(message);
                                }}
                                disabled={Boolean(deletingMessageId) || deletingConversationId === selectedConversationId}
                                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white opacity-0 transition-opacity hover:bg-white/25 group-hover/message:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Delete message"
                                aria-label="Delete message"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {isDeleting && (
                              <span className="absolute -bottom-5 right-1 text-[10px] font-semibold text-slate-400">
                                Deleting...
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-100 bg-white px-4 py-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    placeholder="Write a message..."
                    rows={2}
                    disabled={deletingConversationId === selectedConversationId}
                    className="max-h-32 min-h-[2.75rem] w-full resize-y border-0 bg-transparent px-2 py-1.5 text-sm text-slate-700 outline-none"
                  />

                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-slate-200 px-2 pt-2">
                    <p className="text-xs font-medium text-slate-400">Enter to send, Shift+Enter for a new line</p>
                    <button
                      onClick={() => {
                        void handleSendMessage();
                      }}
                      disabled={isSendingMessage || deletingConversationId === selectedConversationId || !draftMessage.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SendHorizontal className="h-4 w-4" />
                      {isSendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
                {sendError && <p className="mt-2 text-xs font-semibold text-rose-600">{sendError}</p>}
              </footer>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
