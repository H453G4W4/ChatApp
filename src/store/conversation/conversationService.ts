import { apiService } from '@/services/APIService';
import type {
  ConversationPayload,
  MessagesPayload,
  MessagesAPIResponse,
  MessageBuilderPayload,
  SendMessageAPIResponse,
  ConversationListAPIResponse,
  ConversationAPIResponse,
  ToggleConversationStatusPayload,
  ToggleConversationStatusResponse,
  BulkActionPayload,
  AssigneePayload,
  AssigneeAPIResponse,
  MarkMessagesUnreadPayload,
  MarkMessagesUnreadAPIResponse,
  MarkMessageReadPayload,
  MarkMessageReadAPIResponse,
  MuteOrUnmuteConversationPayload,
  ConversationLabelPayload,
  AssignTeamPayload,
  AssignTeamAPIResponse,
  DeleteMessagePayload,
  DeleteMessageAPIResponse,
  TypingPayload,
  ConversationListResponse,
  MessagesResponse,
  ConversationResponse,
  MarkMessageReadOrUnreadResponse,
  ToggleConversationStatusAPIResponse,
  TogglePriorityPayload,
  TranslateMessagePayload,
  TranslateMessageAPIResponse,
  RetryMessagePayload,
  CreateConversationPayload,
  CreateConversationAPIResponse,
  CreateConversationResponse,
} from './conversationTypes';

import {
  transformConversation,
  transformConversationListMeta,
  transformMessage,
  transformConversationMeta,
} from '@/utils/camelCaseKeys';
import type { AxiosRequestConfig } from 'axios';

export class ConversationService {
  static async getConversations(payload: ConversationPayload): Promise<ConversationListResponse> {
    const { status, page, inboxId = 0 } = payload;

    const params = {
      inbox_id: inboxId || null,
      assignee_type: 'all',
      status: status,
      page: page,
      sort_by: 'last_activity_at_desc',
    };
    const response = await apiService.get<ConversationListAPIResponse>('conversations', {
      params,
    });
    const {
      data: { payload: conversations, meta },
    } = response.data;
    const transformedResponse: ConversationListResponse = {
      conversations: conversations.map(transformConversation),
      meta: transformConversationListMeta(meta),
    };
    return transformedResponse;
  }

  /**
   * `POST conversations` (Chatwoot application API), verified against v4.17.1.
   *
   * The controller's `before_action :inbox, :contact, :contact_inbox` authorizes
   * the inbox (`InboxPolicy#show?` - the agent's assigned inboxes), then
   * `ContactInboxBuilder` finds-or-creates the ContactInbox, `ConversationBuilder`
   * creates the conversation, and `Messages::MessageBuilder` creates the first
   * message. That builder defaults `message_type` to `outgoing`, and because we
   * send no message `source_id`, `Base::SendOnChannelService#invalid_message?`
   * stays false - so `SendReplyJob` reaches `Email::SendOnEmailService` and the
   * mail is actually dispatched.
   *
   * `source_id` may be omitted for an email inbox (the builder derives it from
   * `contact.email`); we pass the normalized address, which matches because
   * Chatwoot downcases `contact.email` on save.
   */
  static async createConversation(
    payload: CreateConversationPayload,
  ): Promise<CreateConversationResponse> {
    const { inboxId, contactId, sourceId, subject, content } = payload;
    const response = await apiService.post<CreateConversationAPIResponse>('conversations', {
      inbox_id: inboxId,
      contact_id: contactId,
      source_id: sourceId,
      ...(subject ? { additional_attributes: { mail_subject: subject } } : {}),
      message: { content },
    });
    // The response is a full conversation; this flow only needs its identifiers,
    // and `id` is the display_id the show endpoint and the store are both keyed on.
    const { id, inbox_id: createdInboxId } = response.data ?? {};
    return { conversationId: id, inboxId: createdInboxId };
  }

  static async fetchConversation(conversationId: number): Promise<ConversationResponse> {
    const response = await apiService.get<ConversationAPIResponse>(
      `conversations/${conversationId}`,
    );

    const { data: conversation } = response;
    return {
      conversation: transformConversation(conversation),
    };
  }

  static async fetchPreviousMessages(payload: MessagesPayload): Promise<MessagesResponse> {
    const { conversationId, beforeId, afterId } = payload;

    const params: Record<string, number> = {};
    if (beforeId) {
      params.before = beforeId;
    }
    if (afterId) {
      params.after = afterId;
    }

    const response = await apiService.get<MessagesAPIResponse>(
      `conversations/${conversationId}/messages`,
      {
        params,
      },
    );
    const { meta, payload: messages } = response.data;
    return {
      meta: transformConversationMeta(meta),
      messages: messages.map(transformMessage),
      conversationId,
    };
  }

  static async sendMessage(
    conversationId: number,
    payload: MessageBuilderPayload,
    config: AxiosRequestConfig,
  ): Promise<SendMessageAPIResponse> {
    const response = await apiService.post<SendMessageAPIResponse>(
      `conversations/${conversationId}/messages`,
      payload,
      config,
    );
    return response.data;
  }

  static async retryMessage({
    conversationId,
    messageId,
  }: RetryMessagePayload): Promise<SendMessageAPIResponse> {
    const response = await apiService.post<SendMessageAPIResponse>(
      `conversations/${conversationId}/messages/${messageId}/retry`,
    );
    return response.data;
  }

  static async toggleConversationStatus({
    conversationId,
    payload,
  }: ToggleConversationStatusPayload): Promise<ToggleConversationStatusResponse> {
    const response = await apiService.post<ToggleConversationStatusAPIResponse>(
      `conversations/${conversationId}/toggle_status`,
      payload,
    );
    const {
      payload: { current_status: currentStatus, snoozed_until: snoozedUntil },
    } = response.data;
    return {
      conversationId,
      currentStatus,
      snoozedUntil,
    };
  }
  static async bulkAction(payload: BulkActionPayload): Promise<void> {
    await apiService.post('bulk_actions', payload);
  }
  static async assignConversation(payload: AssigneePayload): Promise<AssigneeAPIResponse> {
    const { conversationId, assigneeId, teamId } = payload;
    const params = {
      assignee_id: assigneeId,
      team_id: teamId,
    };
    const response = await apiService.post<AssigneeAPIResponse>(
      `conversations/${conversationId}/assignments`,
      params,
    );
    return response.data;
  }

  static async assignTeam(payload: AssignTeamPayload): Promise<AssignTeamAPIResponse> {
    const { conversationId, teamId } = payload;
    const response = await apiService.post<AssignTeamAPIResponse>(
      `conversations/${conversationId}/assignments?team_id=${teamId}`,
    );
    return response.data;
  }

  static async markMessagesUnread(
    payload: MarkMessagesUnreadPayload,
  ): Promise<MarkMessageReadOrUnreadResponse> {
    const { conversationId } = payload;
    const response = await apiService.post<MarkMessagesUnreadAPIResponse>(
      `conversations/${conversationId}/unread`,
    );
    const { id, unread_count: unreadCount, agent_last_seen_at: agentLastSeenAt } = response.data;
    return {
      conversationId: id,
      unreadCount,
      agentLastSeenAt,
    };
  }

  static async markMessageRead(
    payload: MarkMessageReadPayload,
  ): Promise<MarkMessageReadOrUnreadResponse> {
    const { conversationId } = payload;
    const response = await apiService.post<MarkMessageReadAPIResponse>(
      `conversations/${conversationId}/update_last_seen`,
    );
    const { id, unread_count: unreadCount, agent_last_seen_at: agentLastSeenAt } = response.data;
    return {
      conversationId: id,
      unreadCount,
      agentLastSeenAt,
    };
  }

  static async muteConversation(payload: MuteOrUnmuteConversationPayload): Promise<void> {
    const { conversationId } = payload;
    await apiService.post(`conversations/${conversationId}/mute`);
  }

  static async unmuteConversation(payload: MuteOrUnmuteConversationPayload): Promise<void> {
    const { conversationId } = payload;
    await apiService.post(`conversations/${conversationId}/unmute`);
  }

  static async addOrUpdateConversationLabels(payload: ConversationLabelPayload): Promise<void> {
    const { conversationId, labels } = payload;
    await apiService.post(`conversations/${conversationId}/labels`, { labels });
  }

  static async deleteMessage(payload: DeleteMessagePayload): Promise<DeleteMessageAPIResponse> {
    const { conversationId, messageId } = payload;
    const response = await apiService.delete<DeleteMessageAPIResponse>(
      `conversations/${conversationId}/messages/${messageId}`,
    );
    return response.data;
  }

  static async toggleTyping(payload: TypingPayload): Promise<void> {
    const { conversationId, typingStatus, isPrivate } = payload;
    await apiService.post(`conversations/${conversationId}/toggle_typing_status`, {
      typing_status: typingStatus,
      is_private: isPrivate,
    });
  }

  static async togglePriority(payload: TogglePriorityPayload): Promise<void> {
    const { conversationId, priority } = payload;
    await apiService.post(`conversations/${conversationId}/toggle_priority`, { priority });
  }

  static async translateMessage(
    payload: TranslateMessagePayload,
  ): Promise<TranslateMessageAPIResponse> {
    const { conversationId, messageId, targetLanguage } = payload;
    const response = await apiService.post<TranslateMessageAPIResponse>(
      `conversations/${conversationId}/messages/${messageId}/translate`,
      { target_language: targetLanguage },
    );
    return response.data;
  }
}
