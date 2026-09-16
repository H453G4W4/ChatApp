import { createDraftSafeSelector, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import { conversationAdapter } from './conversationSlice';
import { FilterState } from '@/store/conversation/conversationFilterSlice';
import { shouldApplyFilters } from '@/utils/conversationUtils';
import { MESSAGE_TYPES } from '@/constants';

export const selectConversationsState = (state: RootState) => state.conversations;

export const {
  selectAll: selectAllConversations,
  selectById: selectConversationById,
  selectIds: selectConversationIds,
} = conversationAdapter.getSelectors<RootState>(selectConversationsState);

export const selectConversationsLoading = createSelector(
  selectConversationsState,
  state => state.isLoadingConversations,
);

export const selectConversationError = createSelector(
  selectConversationsState,
  state => state.error,
);

export const selectConversationFetching = createSelector(
  selectConversationsState,
  state => state.isConversationFetching,
);

export const selectIsAllConversationsFetched = createSelector(
  selectConversationsState,
  state => state.isAllConversationsFetched,
);

export const selectIsAllMessagesFetched = createSelector(
  selectConversationsState,
  state => state.isAllMessagesFetched,
);

export const selectIsAllNewerMessagesFetched = createSelector(
  selectConversationsState,
  state => state.isAllNewerMessagesFetched,
);

export const selectIsLoadingMessages = createSelector(
  selectConversationsState,
  state => state.isLoadingMessages,
);

/**
 * The single global queue.
 *
 * Every conversation the authenticated agent's Chatwoot account returns is
 * shown. The backend already scopes its responses to the inboxes this agent may
 * access, so assignment is metadata here and local inbox records are never used
 * as a permission gate - doing so would hide valid rows whenever inbox metadata
 * has not finished loading. The only filters left are the explicit status and
 * inbox choices the agent makes in the UI.
 */
export const getFilteredConversations = createDraftSafeSelector(
  [selectAllConversations, (_: RootState, filters: FilterState) => filters],
  (conversations, filters) =>
    // filter() copies first, so the sort never touches the memoized input array.
    // Ids can outlive their record, so entries without one are dropped.
    conversations
      .filter(conversation => conversation && shouldApplyFilters(conversation, filters))
      // Latest activity first; id DESC keeps equal timestamps deterministic.
      // Priority is deliberately not part of the ordering.
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt || b.id - a.id),
);

export const getMessagesByConversationId = createDraftSafeSelector(
  [
    (state: RootState, params: { conversationId: number }) =>
      selectConversationById(state, params.conversationId),
  ],
  conversation => {
    if (!conversation) {
      return [];
    }
    // Memoize the sorted and filtered messages using createSelector
    return conversation.messages
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .reverse()
      .filter((message, index, self) => index === self.findIndex(m => m.id === message.id));
  },
);

export const getLastEmailInSelectedChat = createDraftSafeSelector(
  [
    (state: RootState, params: { conversationId: number }) =>
      selectConversationById(state, params.conversationId),
  ],
  conversation => {
    if (!conversation) {
      return [];
    }
    const lastEmail = [...conversation.messages].reverse().find(message => {
      const { contentAttributes, messageType } = message;
      const email = contentAttributes?.email;
      const isIncomingOrOutgoing =
        messageType === MESSAGE_TYPES.OUTGOING || messageType === MESSAGE_TYPES.INCOMING;
      if (email?.from && isIncomingOrOutgoing) {
        return true;
      }
      return false;
    });
    return lastEmail;
  },
);
