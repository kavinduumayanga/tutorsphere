import express from 'express';
import { User } from '../../models/User.js';
import { MessageConversation } from '../../models/MessageConversation.js';
import { DirectMessage } from '../../models/DirectMessage.js';

const router = express.Router();

const createEntityId = (): string => Math.random().toString(36).substr(2, 9);

const toText = (value: unknown): string => String(value || '').trim();

const toIsoDate = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const toValidRole = (value: unknown): 'student' | 'tutor' | null => {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'student') {
    return 'student';
  }
  if (normalized === 'tutor') {
    return 'tutor';
  }
  return null;
};

const isLikelyObjectId = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

const buildConversationLookup = (conversationId: string): Record<string, unknown> => {
  const normalized = toText(conversationId);

  if (!normalized) {
    return { id: normalized };
  }

  if (isLikelyObjectId(normalized)) {
    return {
      $or: [{ id: normalized }, { _id: normalized }],
    };
  }

  return { id: normalized };
};

const ONLINE_WINDOW_MS = 75 * 1000;
const PRESENCE_WRITE_THROTTLE_MS = 20 * 1000;

const buildConversationParticipantQuery = (userId: string): Record<string, unknown> => ({
  $or: [
    { participantIds: userId },
    { studentId: userId },
    { tutorId: userId },
  ],
});

const getUnreadCountForUser = (conversation: any, userId: string): number => {
  const unreadCounts = conversation?.unreadCounts;

  if (!unreadCounts) {
    return 0;
  }

  let rawCount: unknown = 0;

  if (unreadCounts instanceof Map) {
    rawCount = unreadCounts.get(userId);
  } else if (typeof unreadCounts?.get === 'function') {
    rawCount = unreadCounts.get(userId);
  } else if (typeof unreadCounts === 'object') {
    rawCount = (unreadCounts as Record<string, unknown>)[userId];
  }

  const numericCount = Number(rawCount || 0);
  if (!Number.isFinite(numericCount) || numericCount <= 0) {
    return 0;
  }

  return Math.floor(numericCount);
};

const buildAvatarUrl = (req: express.Request, userId: string, avatarValue?: string): string | undefined => {
  if (!toText(avatarValue)) {
    return undefined;
  }

  return `${req.protocol}://${req.get('host')}/api/auth/user/${encodeURIComponent(userId)}/avatar`;
};

const isUserOnline = (lastSeenAt: string | null): boolean => {
  if (!lastSeenAt) {
    return false;
  }

  const parsed = new Date(lastSeenAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return Date.now() - parsed.getTime() <= ONLINE_WINDOW_MS;
};

const buildMessagePreview = (message: any): string => {
  if (!message) {
    return '';
  }

  if (Boolean(message?.isDeleted)) {
    return 'Message deleted';
  }

  const content = toText(message?.content);
  if (!content) {
    return '';
  }

  return content.length > 140 ? `${content.slice(0, 137)}...` : content;
};

const buildParticipantSummary = (req: express.Request, user: any) => {
  const firstName = toText(user?.firstName) || 'User';
  const lastName = toText(user?.lastName);
  const role = toValidRole(user?.role) || 'student';
  const lastSeenAt = toIsoDate(user?.lastActiveAt);

  return {
    id: toText(user?.id),
    firstName,
    lastName,
    role,
    avatar: buildAvatarUrl(req, toText(user?.id), user?.avatar),
    isOnline: isUserOnline(lastSeenAt),
    lastSeenAt,
  };
};

const buildConversationResponse = (
  req: express.Request,
  conversation: any,
  currentUserId: string,
  userById: Map<string, any>
) => {
  const rawConversation =
    typeof conversation?.toObject === 'function' ? conversation.toObject() : conversation;

  const studentId = toText(rawConversation?.studentId);
  const tutorId = toText(rawConversation?.tutorId);
  const otherParticipantId = currentUserId === studentId ? tutorId : studentId;
  const otherUser = userById.get(otherParticipantId);

  const fallbackRole: 'student' | 'tutor' = otherParticipantId === tutorId ? 'tutor' : 'student';

  const otherParticipant = otherUser
    ? buildParticipantSummary(req, otherUser)
    : {
      id: otherParticipantId,
      firstName: 'Unknown',
      lastName: '',
      role: fallbackRole,
      avatar: undefined,
    };

  return {
    id: toText(rawConversation?.id || rawConversation?._id),
    studentId,
    tutorId,
    otherParticipant,
    lastMessagePreview: toText(rawConversation?.lastMessagePreview),
    lastMessageAt: toIsoDate(rawConversation?.lastMessageAt),
    lastMessageSenderId: toText(rawConversation?.lastMessageSenderId) || undefined,
    unreadCount: getUnreadCountForUser(rawConversation, currentUserId),
    createdAt: toIsoDate(rawConversation?.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDate(rawConversation?.updatedAt) || new Date().toISOString(),
  };
};

const normalizeMessageForResponse = (message: any) => {
  const rawMessage = typeof message?.toObject === 'function' ? message.toObject() : message;

  return {
    id: toText(rawMessage?.id || rawMessage?._id),
    conversationId: toText(rawMessage?.conversationId),
    senderId: toText(rawMessage?.senderId),
    recipientId: toText(rawMessage?.recipientId),
    content: toText(rawMessage?.content),
    isRead: Boolean(rawMessage?.isRead),
    isDeleted: Boolean(rawMessage?.isDeleted),
    deletedAt: toIsoDate(rawMessage?.deletedAt),
    deletedBy: toText(rawMessage?.deletedBy) || undefined,
    readAt: toIsoDate(rawMessage?.readAt),
    createdAt: toIsoDate(rawMessage?.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDate(rawMessage?.updatedAt) || new Date().toISOString(),
  };
};

const isConversationParticipant = (conversation: any, userId: string): boolean => {
  const participantIdsFromArray = Array.isArray(conversation?.participantIds)
    ? conversation.participantIds.map((value: unknown) => toText(value)).filter(Boolean)
    : [];
  const participantIdsFromConversation = [toText(conversation?.studentId), toText(conversation?.tutorId)].filter(
    Boolean
  );
  const participantIds = Array.from(
    new Set([...participantIdsFromArray, ...participantIdsFromConversation])
  );

  return participantIds.includes(userId);
};

const getConversationKeyCandidates = (conversation: any, requestedConversationId: string): string[] => {
  return Array.from(
    new Set(
      [
        requestedConversationId,
        toText(conversation?.id),
        toText(conversation?._id),
      ].filter(Boolean)
    )
  );
};

const buildConversationMessageQuery = (
  conversation: any,
  requestedConversationId: string
): Record<string, unknown> => {
  const keys = getConversationKeyCandidates(conversation, requestedConversationId);

  if (keys.length <= 1) {
    return { conversationId: keys[0] || requestedConversationId };
  }

  return {
    conversationId: { $in: keys },
  };
};

const getCanonicalConversationId = (conversation: any, requestedConversationId: string): string => {
  return toText(conversation?.id) || toText(conversation?._id) || requestedConversationId;
};

const buildConversationUpdateLookup = (
  conversation: any,
  requestedConversationId: string
): Record<string, unknown> => {
  if (conversation?._id) {
    return { _id: conversation._id };
  }

  return buildConversationLookup(getCanonicalConversationId(conversation, requestedConversationId));
};

const findConversationByLookup = async (conversationId: string) => {
  return MessageConversation.findOne(buildConversationLookup(conversationId));
};

const getTotalUnreadCountForUser = async (userId: string): Promise<number> => {
  const conversations = await MessageConversation.find(
    buildConversationParticipantQuery(userId),
    { unreadCounts: 1 }
  );

  return conversations.reduce((sum, conversation) => {
    return sum + getUnreadCountForUser(conversation, userId);
  }, 0);
};

const resolveRequestedUserId = (req: express.Request): string => {
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : '';
  const bodyUserId = typeof req.body?.userId === 'string' ? req.body.userId : '';
  const headerUserId = toText(req.header('x-user-id'));

  return toText(queryUserId || bodyUserId || headerUserId);
};

const requireMessagingUser = async (
  req: express.Request,
  res: express.Response
): Promise<any | null> => {
  const sessionUserId = toText((req.session as any)?.userId);
  if (!sessionUserId) {
    res.status(401).json({ error: 'You must be signed in to use messaging.' });
    return null;
  }

  const requestedUserId = resolveRequestedUserId(req);
  if (requestedUserId && requestedUserId !== sessionUserId) {
    console.warn(
      '[Messaging] Ignoring mismatched frontend user hint and using session user.',
      { sessionUserId, requestedUserId }
    );
  }

  const user = await User.findOne({ id: sessionUserId });
  if (!user) {
    res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
    return null;
  }

  const role = toValidRole(user.role);
  if (!role) {
    res.status(403).json({ error: 'Messaging is only available for student and tutor accounts.' });
    return null;
  }

  const now = new Date();
  const currentLastActiveAt =
    user?.lastActiveAt instanceof Date
      ? user.lastActiveAt
      : user?.lastActiveAt
        ? new Date(user.lastActiveAt)
        : null;

  const shouldUpdatePresence =
    !currentLastActiveAt ||
    Number.isNaN(currentLastActiveAt.getTime()) ||
    now.getTime() - currentLastActiveAt.getTime() >= PRESENCE_WRITE_THROTTLE_MS;

  if (shouldUpdatePresence) {
    try {
      await User.updateOne({ id: user.id }, { $set: { lastActiveAt: now } });
      (user as any).lastActiveAt = now;
    } catch (error) {
      console.warn('Failed to update messaging presence state:', error);
    }
  }

  return user;
};

router.get('/conversations', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const search = toText(req.query.search).toLowerCase();

    const conversations = await MessageConversation.find(buildConversationParticipantQuery(currentUser.id)).sort({
      lastMessageAt: -1,
      updatedAt: -1,
      createdAt: -1,
    });

    if (conversations.length === 0) {
      return res.json({ conversations: [], totalUnreadCount: 0 });
    }

    const participantIds = Array.from(
      new Set(
        conversations
          .flatMap((conversation) => {
            const ids = [
              ...(Array.isArray((conversation as any).participantIds)
                ? (conversation as any).participantIds
                : []),
              conversation.studentId,
              conversation.tutorId,
            ];
            return ids.map((entry: unknown) => toText(entry)).filter(Boolean);
          })
          .filter((id) => id !== currentUser.id)
      )
    );

    const users = participantIds.length
      ? await User.find(
        { id: { $in: participantIds } },
        { id: 1, firstName: 1, lastName: 1, role: 1, avatar: 1, lastActiveAt: 1 }
      )
      : [];

    const userById = new Map(users.map((user: any) => [toText(user.id), user]));

    const totalUnreadCount = conversations.reduce((sum, conversation) => {
      return sum + getUnreadCountForUser(conversation, currentUser.id);
    }, 0);

    const serializedConversations = conversations.map((conversation) =>
      buildConversationResponse(req, conversation, currentUser.id, userById)
    );

    const filteredConversations = search
      ? serializedConversations.filter((conversation) => {
        const fullName = `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`
          .trim()
          .toLowerCase();
        const preview = toText(conversation.lastMessagePreview).toLowerCase();

        return fullName.includes(search) || preview.includes(search);
      })
      : serializedConversations;

    return res.json({
      conversations: filteredConversations,
      totalUnreadCount,
    });
  } catch (error) {
    console.error('Get message conversations error:', error);
    return res.status(500).json({ error: 'Failed to load message conversations.' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const totalUnreadCount = await getTotalUnreadCountForUser(currentUser.id);
    return res.json({ totalUnreadCount });
  } catch (error) {
    console.error('Get message unread count error:', error);
    return res.status(500).json({ error: 'Failed to load unread message count.' });
  }
});

router.post('/presence/ping', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    return res.json({
      isOnline: true,
      lastActiveAt: toIsoDate((currentUser as any)?.lastActiveAt),
    });
  } catch (error) {
    console.error('Message presence ping error:', error);
    return res.status(500).json({ error: 'Failed to update presence status.' });
  }
});

router.post('/conversations/direct', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const participantUserId = toText(
      req.body?.participantUserId || req.body?.tutorId || req.body?.studentId
    );

    if (!participantUserId) {
      return res.status(400).json({ error: 'participantUserId is required.' });
    }

    if (participantUserId === currentUser.id) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself.' });
    }

    const participantUser = await User.findOne({ id: participantUserId });
    if (!participantUser) {
      return res.status(404).json({ error: 'The selected user was not found.' });
    }

    const currentRole = toValidRole(currentUser.role);
    const participantRole = toValidRole(participantUser.role);

    if (!currentRole || !participantRole) {
      return res
        .status(403)
        .json({ error: 'Messaging is only available for student and tutor accounts.' });
    }

    if (currentRole === participantRole) {
      return res
        .status(400)
        .json({ error: 'Conversations can only be created between a student and a tutor.' });
    }

    const studentId = currentRole === 'student' ? currentUser.id : participantUser.id;
    const tutorId = currentRole === 'tutor' ? currentUser.id : participantUser.id;

    let conversation = await MessageConversation.findOne({ studentId, tutorId });
    let created = false;

    if (!conversation) {
      try {
        conversation = await MessageConversation.create({
          id: createEntityId(),
          studentId,
          tutorId,
          participantIds: [studentId, tutorId],
          unreadCounts: {
            [studentId]: 0,
            [tutorId]: 0,
          },
        });
        created = true;
      } catch (error) {
        const mongoError = error as { code?: number };
        if (mongoError?.code === 11000) {
          conversation = await MessageConversation.findOne({ studentId, tutorId });
        } else {
          throw error;
        }
      }
    }

    if (!conversation) {
      return res.status(500).json({ error: 'Failed to open conversation.' });
    }

    const normalizedConversation =
      (await MessageConversation.findOneAndUpdate(
        { id: conversation.id },
        {
          $set: {
            participantIds: [studentId, tutorId],
            [`unreadCounts.${studentId}`]: getUnreadCountForUser(conversation, studentId),
            [`unreadCounts.${tutorId}`]: getUnreadCountForUser(conversation, tutorId),
          },
        },
        { new: true }
      )) || conversation;

    const userById = new Map([
      [toText(currentUser.id), currentUser],
      [toText(participantUser.id), participantUser],
    ]);

    return res.status(created ? 201 : 200).json({
      conversation: buildConversationResponse(req, normalizedConversation, currentUser.id, userById),
      created,
    });
  } catch (error) {
    console.error('Open direct conversation error:', error);
    return res.status(500).json({ error: 'Failed to open direct conversation.' });
  }
});

const deleteConversationThread = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  const currentUser = await requireMessagingUser(req, res);
  if (!currentUser) {
    return;
  }

  const conversationId = toText(req.params.id);
  if (!conversationId) {
    res.status(400).json({ error: 'Conversation id is required.' });
    return;
  }

  const conversation = await MessageConversation.findOne(buildConversationLookup(conversationId));
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  if (!isConversationParticipant(conversation, currentUser.id)) {
    res.status(403).json({ error: 'You are not allowed to delete this conversation.' });
    return;
  }

  const conversationKeys = Array.from(
    new Set(
      [conversationId, toText((conversation as any)?.id), toText((conversation as any)?._id)].filter(Boolean)
    )
  );

  const conversationDeletionFilter = (conversation as any)?._id
    ? { _id: (conversation as any)._id }
    : buildConversationLookup(conversationId);

  const [deletedMessages, deletedConversation] = await Promise.all([
    DirectMessage.deleteMany({ conversationId: { $in: conversationKeys } }),
    MessageConversation.deleteOne(conversationDeletionFilter),
  ]);

  if (!Number((deletedConversation as any)?.deletedCount || 0)) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  const totalUnreadCount = await getTotalUnreadCountForUser(currentUser.id);

  res.json({
    conversationId: toText((conversation as any)?.id || (conversation as any)?._id || conversationId),
    deletedMessageCount: Number((deletedMessages as any)?.deletedCount || 0),
    totalUnreadCount,
  });
};

router.delete('/conversations/:id', async (req, res) => {
  try {
    await deleteConversationThread(req, res);
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

router.post('/conversations/:id/delete', async (req, res) => {
  try {
    await deleteConversationThread(req, res);
  } catch (error) {
    console.error('Delete conversation fallback error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const conversationId = toText(req.params.id);
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation id is required.' });
    }

    const conversation = await findConversationByLookup(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!isConversationParticipant(conversation, currentUser.id)) {
      return res.status(403).json({ error: 'You are not allowed to access this conversation.' });
    }

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(120, Math.max(1, Math.floor(requestedLimit)))
      : 80;

    const before = toText(req.query.before);
    const query: Record<string, unknown> = buildConversationMessageQuery(conversation, conversationId);

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const messagesDescending = await DirectMessage.find(query).sort({ createdAt: -1 }).limit(limit);
    const hasMore = messagesDescending.length === limit;
    const messages = [...messagesDescending].reverse();

    const participantIds = Array.from(
      new Set(
        [conversation.studentId, conversation.tutorId]
          .map((value) => toText(value))
          .filter(Boolean)
      )
    );

    const users = await User.find(
      { id: { $in: participantIds } },
      { id: 1, firstName: 1, lastName: 1, role: 1, avatar: 1, lastActiveAt: 1 }
    );
    const userById = new Map(users.map((user: any) => [toText(user.id), user]));

    return res.json({
      conversation: buildConversationResponse(req, conversation, currentUser.id, userById),
      messages: messages.map((message) => normalizeMessageForResponse(message)),
      hasMore,
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    return res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const conversationId = toText(req.params.id);
    const content = toText(req.body?.content);

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation id is required.' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message content cannot exceed 2000 characters.' });
    }

    const conversation = await findConversationByLookup(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!isConversationParticipant(conversation, currentUser.id)) {
      return res.status(403).json({ error: 'You are not allowed to send messages in this conversation.' });
    }

    const recipientId =
      currentUser.id === toText(conversation.studentId)
        ? toText(conversation.tutorId)
        : toText(conversation.studentId);

    if (!recipientId) {
      return res.status(400).json({ error: 'Unable to resolve message recipient.' });
    }

    const canonicalConversationId = getCanonicalConversationId(conversation, conversationId);

    const createdMessage = await DirectMessage.create({
      id: createEntityId(),
      conversationId: canonicalConversationId,
      senderId: currentUser.id,
      recipientId,
      content,
      isRead: false,
    });

    const preview = buildMessagePreview(createdMessage);
    const now = new Date();

    const updatedConversation =
      (await MessageConversation.findOneAndUpdate(
        buildConversationUpdateLookup(conversation, conversationId),
        {
          $set: {
            lastMessagePreview: preview,
            lastMessageAt: now,
            lastMessageSenderId: currentUser.id,
            participantIds: [toText(conversation.studentId), toText(conversation.tutorId)],
            [`unreadCounts.${currentUser.id}`]: 0,
          },
          $inc: {
            [`unreadCounts.${recipientId}`]: 1,
          },
        },
        { new: true }
      )) || conversation;

    const users = await User.find(
      { id: { $in: [toText(conversation.studentId), toText(conversation.tutorId)] } },
      { id: 1, firstName: 1, lastName: 1, role: 1, avatar: 1, lastActiveAt: 1 }
    );
    const userById = new Map(users.map((user: any) => [toText(user.id), user]));
    const totalUnreadCount = await getTotalUnreadCountForUser(currentUser.id);

    return res.status(201).json({
      message: normalizeMessageForResponse(createdMessage),
      conversation: buildConversationResponse(req, updatedConversation, currentUser.id, userById),
      totalUnreadCount,
    });
  } catch (error) {
    console.error('Send conversation message error:', error);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.delete('/conversations/:id/messages/:messageId', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const conversationId = toText(req.params.id);
    const messageId = toText(req.params.messageId);

    if (!conversationId || !messageId) {
      return res.status(400).json({ error: 'Conversation id and message id are required.' });
    }

    const conversation = await findConversationByLookup(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!isConversationParticipant(conversation, currentUser.id)) {
      return res.status(403).json({ error: 'You are not allowed to delete messages in this conversation.' });
    }

    const conversationMessageQuery = buildConversationMessageQuery(conversation, conversationId);

    const existingMessage = await DirectMessage.findOne({ id: messageId, ...conversationMessageQuery });
    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (toText(existingMessage.senderId) !== currentUser.id) {
      return res.status(403).json({ error: 'You can only delete messages you sent.' });
    }

    const message =
      existingMessage.isDeleted
        ? existingMessage
        : (await DirectMessage.findOneAndUpdate(
          { id: messageId, ...conversationMessageQuery },
          {
            $set: {
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: currentUser.id,
            },
          },
          { new: true }
        )) || existingMessage;

    const latestMessage = await DirectMessage.findOne(conversationMessageQuery).sort({ createdAt: -1 });
    const conversationUpdate: Record<string, any> = {
      $set: {
        lastMessagePreview: buildMessagePreview(latestMessage),
        participantIds: [toText(conversation.studentId), toText(conversation.tutorId)],
        [`unreadCounts.${currentUser.id}`]: getUnreadCountForUser(conversation, currentUser.id),
      },
    };

    if (latestMessage) {
      conversationUpdate.$set.lastMessageAt = latestMessage.createdAt;
      conversationUpdate.$set.lastMessageSenderId = toText(latestMessage.senderId);
    } else {
      conversationUpdate.$unset = {
        lastMessageAt: '',
        lastMessageSenderId: '',
      };
    }

    const updatedConversation =
      (await MessageConversation.findOneAndUpdate(
        buildConversationUpdateLookup(conversation, conversationId),
        conversationUpdate,
        { new: true }
      )) || conversation;

    const users = await User.find(
      { id: { $in: [toText(conversation.studentId), toText(conversation.tutorId)] } },
      { id: 1, firstName: 1, lastName: 1, role: 1, avatar: 1, lastActiveAt: 1 }
    );

    const userById = new Map(users.map((user: any) => [toText(user.id), user]));
    const totalUnreadCount = await getTotalUnreadCountForUser(currentUser.id);

    return res.json({
      message: normalizeMessageForResponse(message),
      conversation: buildConversationResponse(req, updatedConversation, currentUser.id, userById),
      totalUnreadCount,
    });
  } catch (error) {
    console.error('Delete conversation message error:', error);
    return res.status(500).json({ error: 'Failed to delete message.' });
  }
});

router.post('/conversations/:id/read', async (req, res) => {
  try {
    const currentUser = await requireMessagingUser(req, res);
    if (!currentUser) {
      return;
    }

    const conversationId = toText(req.params.id);
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation id is required.' });
    }

    const conversation = await findConversationByLookup(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!isConversationParticipant(conversation, currentUser.id)) {
      return res.status(403).json({ error: 'You are not allowed to update this conversation.' });
    }

    const conversationMessageQuery = buildConversationMessageQuery(conversation, conversationId);

    const markReadResult = await DirectMessage.updateMany(
      {
        ...conversationMessageQuery,
        recipientId: currentUser.id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    await MessageConversation.updateOne(
      buildConversationUpdateLookup(conversation, conversationId),
      {
        $set: {
          [`unreadCounts.${currentUser.id}`]: 0,
        },
      }
    );

    const totalUnreadCount = await getTotalUnreadCountForUser(currentUser.id);

    return res.json({
      conversationId,
      unreadCount: 0,
      modifiedCount: Number(markReadResult.modifiedCount || 0),
      totalUnreadCount,
    });
  } catch (error) {
    console.error('Mark conversation as read error:', error);
    return res.status(500).json({ error: 'Failed to mark messages as read.' });
  }
});

export const messagingRouter = router;
