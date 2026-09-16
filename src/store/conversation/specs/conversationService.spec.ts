import { ConversationService } from '../conversationService';
import { apiService } from '@/services/APIService';
import { conversation, conversationListResponse } from './conversationMockData';
import { transformConversation, transformConversationListMeta } from '@/utils/camelCaseKeys';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/utils/toastUtils', () => ({
  showToast: jest.fn(),
}));

jest.mock('@/services/APIService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('ConversationService', () => {
  it('should fetch all conversations', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      data: conversationListResponse,
    });

    const result = await ConversationService.getConversations({
      status: 'open',
      assigneeType: 'all',
      page: 1,
      sortBy: 'latest',
    });
    expect(apiService.get).toHaveBeenCalledWith('conversations', {
      params: {
        inbox_id: null,
        assignee_type: 'all',
        status: 'open',
        page: 1,
        sort_by: 'last_activity_at_desc',
      },
    });
    expect(result).toEqual({
      conversations: conversationListResponse.data.payload.map(transformConversation),
      meta: transformConversationListMeta(conversationListResponse.data.meta),
    });
  });

  it('requests the global queue without an inbox_id so the backend scopes it', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: conversationListResponse });

    await ConversationService.getConversations({
      status: 'open',
      assigneeType: 'all',
      page: 1,
      sortBy: 'last_activity_at_desc',
    });

    const params = (apiService.get as jest.Mock).mock.calls.at(-1)![1].params;
    // No inbox_id means "every inbox this authenticated agent may access".
    expect(params.inbox_id).toBeNull();
    // Assignment never narrows the queue.
    expect(params.assignee_type).toBe('all');
  });

  it('keeps pagination permission-scoped and ignores legacy assignee/priority sorting', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: conversationListResponse });
    await ConversationService.getConversations({
      status: 'all',
      assigneeType: 'me',
      page: 2,
      sortBy: 'sort_on_priority',
      inboxId: 7,
    });
    expect(apiService.get).toHaveBeenLastCalledWith('conversations', {
      params: {
        inbox_id: 7,
        assignee_type: 'all',
        status: 'all',
        page: 2,
        sort_by: 'last_activity_at_desc',
      },
    });
  });

  describe('createConversation', () => {
    it('posts the documented new-conversation params for an email thread', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        data: { id: 501, account_id: 1, inbox_id: 7 },
      });

      const result = await ConversationService.createConversation({
        inboxId: 7,
        contactId: 42,
        sourceId: 'ada@example.com',
        subject: 'Invoice question',
        content: 'Hello there',
      });

      expect(apiService.post).toHaveBeenLastCalledWith('conversations', {
        inbox_id: 7,
        contact_id: 42,
        // Email inboxes key the contact_inbox on the address.
        source_id: 'ada@example.com',
        // Chatwoot reads the thread subject from here.
        additional_attributes: { mail_subject: 'Invoice question' },
        message: { content: 'Hello there' },
      });
      expect(result).toEqual({ conversationId: 501, inboxId: 7 });
    });

    it('omits additional_attributes when there is no subject to set', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({ data: { id: 502 } });

      await ConversationService.createConversation({
        inboxId: 7,
        contactId: 42,
        sourceId: 'ada@example.com',
        content: 'Hello there',
      });

      expect(apiService.post).toHaveBeenLastCalledWith(
        'conversations',
        expect.not.objectContaining({ additional_attributes: expect.anything() }),
      );
    });
  });

  it('should fetch conversation', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      data: conversation,
    });

    const result = await ConversationService.fetchConversation(1);
    expect(result).toEqual({
      conversation: transformConversation(conversation),
    });

    expect(apiService.get).toHaveBeenCalledWith('conversations/1');
  });

  it('should toggle conversation status', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({
      data: {
        payload: {
          conversation_id: 1,
          current_status: 'resolved',
          snoozed_until: null,
        },
      },
    });

    const result = await ConversationService.toggleConversationStatus({
      conversationId: 1,
      payload: { status: 'resolved', snoozed_until: null },
    });
    expect(apiService.post).toHaveBeenCalledWith('conversations/1/toggle_status', {
      status: 'resolved',
      snoozed_until: null,
    });

    expect(result).toEqual({
      conversationId: 1,
      currentStatus: 'resolved',
      snoozedUntil: null,
    });
  });

  it('should mute conversation', async () => {
    await ConversationService.muteConversation({ conversationId: 1 });

    expect(apiService.post).toHaveBeenCalledWith('conversations/1/mute');
  });

  it('should retry a message', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: { id: 12 } });

    const result = await ConversationService.retryMessage({ conversationId: 1, messageId: 12 });

    expect(apiService.post).toHaveBeenCalledWith('conversations/1/messages/12/retry');
    expect(result).toEqual({ id: 12 });
  });
});
