import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import { Conversation } from '@/types/Conversation';
import { conversationActions } from './conversationActions';
import {
  compareMessageActivity,
  findPendingMessageIndex,
  getLastMessage,
  getNewestMessage,
} from '@/utils/conversationUtils';

import { MESSAGE_TYPES } from '@/constants';
import { Message } from '@/types/Message';
import { PendingMessage } from './conversationTypes';

export interface ConversationState {
  activeConversationsRequestId?: string | null;
  meta: {
    mineCount: number;
    unassignedCount: number;
    allCount: number;
  };
  error: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isAllConversationsFetched: boolean;
  isAllMessagesFetched: boolean;
  // Whether all messages newer than the loaded set are fetched. False only after
  // a search jump, which loads a window that may sit before the latest messages.
  isAllNewerMessagesFetched: boolean;
  isConversationFetching: boolean;
  isChangingConversationStatus: boolean;
}

export const conversationAdapter = createEntityAdapter<Conversation>();

const initialState = conversationAdapter.getInitialState<ConversationState>({
  meta: {
    mineCount: 0,
    unassignedCount: 0,
    allCount: 0,
  },
  error: null,
  isLoadingConversations: false,
  isAllConversationsFetched: false,
  isLoadingMessages: false,
  isAllMessagesFetched: false,
  isAllNewerMessagesFetched: true,
  isConversationFetching: false,
  isChangingConversationStatus: false,
});

const isOutdatedConversationUpdate = (
  existingConversation: Conversation | undefined,
  incomingConversation: Conversation,
) => {
  const existingUpdatedAt = existingConversation?.updatedAt;
  const incomingUpdatedAt = incomingConversation.updatedAt;

  return (
    typeof existingUpdatedAt === 'number' &&
    typeof incomingUpdatedAt === 'number' &&
    incomingUpdatedAt < existingUpdatedAt
  );
};

const shouldKeepLocalStatusMarker = (
  existingConversation: Conversation | undefined,
  incomingConversation: Conversation,
) => {
  const localStatusUpdatedAt = existingConversation?.localStatusUpdatedAt;
  const existingUpdatedAt = existingConversation?.updatedAt;
  const incomingUpdatedAt = incomingConversation.updatedAt;

  return (
    typeof localStatusUpdatedAt === 'number' &&
    typeof existingUpdatedAt === 'number' &&
    typeof incomingUpdatedAt === 'number' &&
    localStatusUpdatedAt === existingUpdatedAt &&
    incomingUpdatedAt <= localStatusUpdatedAt
  );
};

const shouldPreserveLocalStatus = (
  existingConversation: Conversation | undefined,
  incomingConversation: Conversation,
) => {
  return (
    shouldKeepLocalStatusMarker(existingConversation, incomingConversation) &&
    existingConversation?.status !== incomingConversation.status &&
    existingConversation?.localStatusPreviousStatus === incomingConversation.status
  );
};

const preserveLocalStatus = (
  existingConversation: Conversation | undefined,
  incomingConversation: Conversation,
) => {
  if (!shouldKeepLocalStatusMarker(existingConversation, incomingConversation)) {
    return {
      ...incomingConversation,
      localStatusUpdatedAt: undefined,
      localStatusPreviousStatus: undefined,
    };
  }

  if (
    !existingConversation ||
    !shouldPreserveLocalStatus(existingConversation, incomingConversation)
  ) {
    return {
      ...incomingConversation,
      localStatusUpdatedAt: existingConversation?.localStatusUpdatedAt,
      localStatusPreviousStatus: existingConversation?.localStatusPreviousStatus,
    };
  }

  return {
    ...incomingConversation,
    status: existingConversation.status,
    snoozedUntil: existingConversation.snoozedUntil,
    localStatusUpdatedAt: existingConversation.localStatusUpdatedAt,
    localStatusPreviousStatus: existingConversation.localStatusPreviousStatus,
  };
};

const preserveRecentActivity = (
  existing: Conversation | undefined,
  incoming: Conversation,
): Conversation => {
  const conversation = preserveLocalStatus(existing, incoming);
  if (!existing) return conversation;
  if (incoming.agentLastSeenAt < existing.agentLastSeenAt) {
    conversation.agentLastSeenAt = existing.agentLastSeenAt;
    conversation.unreadCount = existing.unreadCount;
  }

  const existingMessage = getLastMessage(existing);
  const incomingMessage = getLastMessage(incoming);
  const hasOlderActivity = incoming.lastActivityAt < existing.lastActivityAt;
  const hasOlderPreview =
    incoming.lastActivityAt === existing.lastActivityAt &&
    existingMessage &&
    (!incomingMessage || compareMessageActivity(existingMessage, incomingMessage) > 0);

  if (!hasOlderActivity && !hasOlderPreview) return conversation;

  // A list/page request may finish after a newer socket message. Keep the newer
  // summary and loaded history, while still accepting other server attributes.
  return {
    ...conversation,
    lastActivityAt: existing.lastActivityAt,
    timestamp: existing.timestamp,
    lastNonActivityMessage: existing.lastNonActivityMessage,
    messages: existing.messages,
    unreadCount:
      incoming.agentLastSeenAt > existing.agentLastSeenAt
        ? incoming.unreadCount
        : existing.unreadCount,
  };
};

const mergeMessage = (
  conversation: Conversation,
  message: PendingMessage | Message,
  isCreation = false,
): void => {
  const previousMessages = conversation.messages ?? [];
  const latestMessage = getNewestMessage([
    ...previousMessages,
    ...(conversation.lastNonActivityMessage ? [conversation.lastNonActivityMessage] : []),
  ]);
  conversation.messages = previousMessages;
  const messageIndex = findPendingMessageIndex(conversation, message);
  const isDuplicate = messageIndex !== -1 && previousMessages[messageIndex].id === message.id;
  const isOlderMessage =
    message.createdAt < conversation.lastActivityAt ||
    (latestMessage && compareMessageActivity(message as Message, latestMessage) < 0);

  if (messageIndex === -1) {
    conversation.messages.push(message as Message);
  } else {
    conversation.messages[messageIndex] = {
      ...conversation.messages[messageIndex],
      ...message,
    } as Message;
  }

  const lastMessage = getLastMessage(conversation);
  if (
    message.messageType !== MESSAGE_TYPES.ACTIVITY &&
    (!lastMessage || compareMessageActivity(message as Message, lastMessage) >= 0)
  ) {
    conversation.lastNonActivityMessage = message as Message;
  }

  if (isOlderMessage || (isCreation && isDuplicate)) return;

  if (message.messageType === MESSAGE_TYPES.INCOMING) conversation.canReply = true;
  const summary = (message as Message).conversation;
  const lastActivityAt = summary?.lastActivityAt ?? message.createdAt;
  conversation.lastActivityAt = Math.max(conversation.lastActivityAt, lastActivityAt);
  conversation.timestamp = Math.max(conversation.timestamp ?? 0, message.createdAt);
  if (message.createdAt <= conversation.agentLastSeenAt) return;

  if (typeof summary?.unreadCount === 'number') {
    conversation.unreadCount = summary.unreadCount;
  } else if (isCreation && !isDuplicate && message.messageType === MESSAGE_TYPES.INCOMING) {
    conversation.unreadCount += 1;
  }
};

// Queue order is derived, never stored: raising lastActivityAt here is what
// moves a conversation to the top of getFilteredConversations on the next render.
const receiveCreatedMessage = (
  state: ReturnType<typeof conversationAdapter.getInitialState<ConversationState>>,
  message: Message,
) => {
  const conversation = state.entities[message.conversationId];
  if (!conversation) return;
  mergeMessage(conversation, message, true);
};

const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    clearAllConversations: state => {
      conversationAdapter.removeAll(state);
      state.activeConversationsRequestId = null;
      state.isLoadingConversations = false;
      state.isAllConversationsFetched = false;
      state.error = null;
    },
    addConversation: (state, action) => {
      const conversation = action.payload;
      conversationAdapter.addOne(state, conversation);
    },
    updateConversation: (state, action) => {
      const conversation = action.payload as Conversation;
      const conversationIds = conversationAdapter.getSelectors().selectIds(state);
      if (conversationIds.includes(conversation.id)) {
        const existingConversation = state.entities[conversation.id];
        if (isOutdatedConversationUpdate(existingConversation, conversation)) {
          return;
        }

        const { messages, ...conversationAttributes } = preserveRecentActivity(
          existingConversation,
          conversation,
        );
        conversationAdapter.updateOne(state, {
          id: conversation.id,
          changes: conversationAttributes,
        });
      } else {
        conversationAdapter.addOne(state, conversation);
      }
    },
    addOrUpdateMessage: (state, action) => {
      const message = action.payload as PendingMessage | Message;

      const { conversationId } = message;
      if (!conversationId) {
        return;
      }

      const conversation = state.entities[conversationId];

      // If the conversation is not present in the store, we don't need to add the message
      if (!conversation) {
        return;
      }
      mergeMessage(conversation, message);
    },
    receiveMessageCreated: (state, action) => {
      receiveCreatedMessage(state, action.payload as Message);
    },
    hydrateConversationMessages: (state, action) => {
      const { conversation, messages } = action.payload as {
        conversation: Conversation;
        messages: Message[];
      };
      // Another list request or event may already have supplied newer data.
      const isNew = !state.entities[conversation.id];
      if (isNew) {
        const hydrated = { ...conversation, messages: [...(conversation.messages ?? [])] };
        messages.forEach(message => mergeMessage(hydrated, message, true));
        conversationAdapter.addOne(state, hydrated);
      } else {
        messages.forEach(message => receiveCreatedMessage(state, message));
      }
    },
    updateConversationLastActivity: (state, action) => {
      const { conversationId, lastActivityAt } = action.payload;
      const conversation = state.entities[conversationId];
      if (!conversation) {
        return;
      }
      if (typeof lastActivityAt === 'number') {
        conversation.lastActivityAt = Math.max(conversation.lastActivityAt, lastActivityAt);
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(conversationActions.fetchConversations.pending, (state, action) => {
        state.activeConversationsRequestId = action.meta.requestId;
        state.error = null;
        state.isLoadingConversations = true;
      })
      .addCase(
        conversationActions.fetchConversations.fulfilled,
        (state, { payload, meta: requestMeta }) => {
          if (
            state.activeConversationsRequestId !== undefined &&
            state.activeConversationsRequestId !== requestMeta.requestId
          )
            return;
          const { conversations, meta } = payload;
          const conversationsToUpsert = conversations.filter(
            conversation =>
              !isOutdatedConversationUpdate(state.entities[conversation.id], conversation),
          );
          conversationAdapter.upsertMany(
            state,
            conversationsToUpsert.map(conversation =>
              preserveRecentActivity(state.entities[conversation.id], conversation),
            ),
          );
          state.isLoadingConversations = false;
          state.isAllConversationsFetched = conversations.length < 20 || false;
          state.meta = meta;
        },
      )
      .addCase(conversationActions.fetchConversations.rejected, (state, action) => {
        if (
          state.activeConversationsRequestId !== undefined &&
          state.activeConversationsRequestId !== action.meta.requestId
        )
          return;
        state.isLoadingConversations = false;
        // Recorded so an empty queue can tell "nothing here" apart from "the
        // request failed" and offer a retry. Queue contents are untouched.
        state.error = action.error?.message ?? 'ERRORS.COMMON_ERROR';
      })
      .addCase(conversationActions.fetchConversation.pending, state => {
        state.error = null;
        state.isConversationFetching = true;
      })
      .addCase(conversationActions.fetchConversation.fulfilled, (state, { payload }) => {
        const { conversation } = payload;
        if (isOutdatedConversationUpdate(state.entities[conversation.id], conversation)) {
          state.isConversationFetching = false;
          return;
        }

        conversationAdapter.upsertOne(
          state,
          preserveRecentActivity(state.entities[conversation.id], conversation),
        );
        state.isConversationFetching = false;
        state.isAllMessagesFetched = false;
      })
      .addCase(conversationActions.fetchConversation.rejected, (state, action) => {
        // Ignore responses fenced during an account switch; a fresh fetch is already running.
        if (action.error?.name === 'CanceledError') {
          return;
        }
        state.isConversationFetching = false;
        state.error = state.error || 'Unable to load conversation';
      })
      .addCase(conversationActions.fetchPreviousMessages.pending, state => {
        state.isLoadingMessages = true;
      })
      .addCase(conversationActions.fetchPreviousMessages.fulfilled, (state, action) => {
        const { messages, conversationId, meta: responseMeta } = action.payload;
        if (!state.entities[conversationId]) {
          return;
        }
        const conversation = state.entities[conversationId];
        const { afterId, beforeId, resetMessages } = action.meta.arg;

        if (resetMessages) {
          // Search navigation: replace the list with the target + older window so
          // there is no gap with previously loaded messages. Newer messages are
          // fetched separately and paged in on scroll-down.
          conversation.messages = [...messages].sort((a, b) => b.createdAt - a.createdAt);
          state.isAllMessagesFetched = messages.length < 20;
          state.isAllNewerMessagesFetched = false;
        } else if (afterId != null) {
          // Load newer: merge, dedupe, sort newest-first.
          const existingIds = new Set(conversation.messages.map(m => m.id));
          const newMessages = messages.filter(m => !existingIds.has(m.id));
          conversation.messages.push(...newMessages);
          conversation.messages.sort((a, b) => b.createdAt - a.createdAt);
          state.isAllNewerMessagesFetched = messages.length < 20;
        } else {
          // First load or older pagination: prepend older messages.
          conversation.messages.unshift(...messages);
          state.isAllMessagesFetched = messages.length < 20 || false;
          // A first load (no beforeId) lands on the latest messages.
          if (beforeId == null) {
            state.isAllNewerMessagesFetched = true;
          }
        }

        conversation.meta = {
          ...conversation.meta,
          ...responseMeta,
        };
        state.isLoadingMessages = false;
      })
      .addCase(conversationActions.fetchPreviousMessages.rejected, state => {
        state.isLoadingMessages = false;
      })
      .addCase(conversationActions.toggleConversationStatus.pending, (state, action) => {
        state.isChangingConversationStatus = true;
      })
      .addCase(conversationActions.toggleConversationStatus.fulfilled, (state, { payload }) => {
        const { conversationId, currentStatus, snoozedUntil } = payload;
        const conversation = state.entities[conversationId];
        if (!conversation) {
          return;
        }
        conversation.localStatusPreviousStatus = conversation.status;
        conversation.status = currentStatus;
        conversation.snoozedUntil = snoozedUntil;
        conversation.localStatusUpdatedAt = conversation.updatedAt;
        state.isChangingConversationStatus = false;
      })
      .addCase(conversationActions.toggleConversationStatus.rejected, state => {
        state.isChangingConversationStatus = false;
      })
      .addCase(conversationActions.muteConversation.fulfilled, (state, action) => {
        const { conversationId } = action.payload;
        const conversation = state.entities[conversationId];
        if (!conversation) {
          return;
        }
        conversation.muted = true;
      })
      .addCase(conversationActions.unmuteConversation.fulfilled, (state, action) => {
        const { conversationId } = action.payload;
        const conversation = state.entities[conversationId];
        if (!conversation) {
          return;
        }
        conversation.muted = false;
      })
      .addCase(conversationActions.markMessagesUnread.fulfilled, (state, action) => {
        const { conversationId, unreadCount, agentLastSeenAt } = action.payload;
        const conversation = state.entities[conversationId];
        if (!conversation) {
          return;
        }
        conversation.unreadCount = unreadCount;
        conversation.agentLastSeenAt = agentLastSeenAt;
      })
      .addCase(conversationActions.markMessageRead.fulfilled, (state, action) => {
        const { conversationId, agentLastSeenAt, unreadCount } = action.payload;
        const conversation = state.entities[conversationId];
        if (!conversation) {
          return;
        }
        conversation.unreadCount = unreadCount;
        conversation.agentLastSeenAt = agentLastSeenAt;
      })
      .addCase(conversationActions.translateMessage.fulfilled, (state, action) => {
        const { conversationId, messageId, targetLanguage, content } = action.payload;
        if (!content) {
          return;
        }
        const conversation = state.entities[conversationId];
        if (!conversation) {
          return;
        }
        const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          const message = conversation.messages[messageIndex];
          const existing =
            message.contentAttributes ?? ({} as NonNullable<Message['contentAttributes']>);
          conversation.messages[messageIndex] = {
            ...message,
            contentAttributes: {
              ...existing,
              translations: {
                ...existing.translations,
                [targetLanguage]: content,
              },
            },
          };
        }
      });
  },
});

export const {
  clearAllConversations,
  updateConversation,
  updateConversationLastActivity,
  addOrUpdateMessage,
  addConversation,
  receiveMessageCreated,
  hydrateConversationMessages,
} = conversationSlice.actions;

export default conversationSlice.reducer;
