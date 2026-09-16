import type { RootState } from '@/store';
import type { Message } from '@/types';
import reducer, { addConversation, receiveMessageCreated } from '../conversationSlice';
import { getFilteredConversations, getMessagesByConversationId } from '../conversationSelectors';
import { defaultFilterState } from '../conversationFilterSlice';
import { conversation } from './conversationMockData';

const incoming = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 900,
    accountId: 1,
    conversationId: conversation.id,
    inboxId: 1,
    createdAt: 500,
    messageType: 0,
    content: 'Realtime arrival',
    contentType: 'text',
    attachments: [],
    private: false,
    sourceId: null,
    status: 'sent',
    senderId: 1,
    lastNonActivityMessage: null,
    conversation: { lastActivityAt: 500, unreadCount: 1 },
    ...overrides,
  }) as unknown as Message;

const asState = (conversations: ReturnType<typeof reducer>) =>
  ({ conversations }) as unknown as RootState;

describe('chat thread realtime behaviour', () => {
  it('shows a realtime message exactly once in the open thread', () => {
    let state = reducer(undefined, addConversation({ ...conversation, messages: [] }));
    state = reducer(state, receiveMessageCreated(incoming()));

    const messages = getMessagesByConversationId(asState(state), {
      conversationId: conversation.id,
    });
    expect(messages.map(message => message.id)).toEqual([900]);
  });

  it('still shows it once when the same event is delivered twice', () => {
    // ActionCable can redeliver on reconnect; the thread must not double up.
    let state = reducer(undefined, addConversation({ ...conversation, messages: [] }));
    state = reducer(state, receiveMessageCreated(incoming()));
    state = reducer(state, receiveMessageCreated(incoming()));

    const messages = getMessagesByConversationId(asState(state), {
      conversationId: conversation.id,
    });
    expect(messages.map(message => message.id)).toEqual([900]);
  });

  it('orders the thread newest-first regardless of arrival order', () => {
    let state = reducer(undefined, addConversation({ ...conversation, messages: [] }));
    state = reducer(state, receiveMessageCreated(incoming({ id: 901, createdAt: 600 })));
    state = reducer(state, receiveMessageCreated(incoming({ id: 900, createdAt: 500 })));

    const messages = getMessagesByConversationId(asState(state), {
      conversationId: conversation.id,
    });
    expect(messages.map(message => message.id)).toEqual([901, 900]);
  });

  it('keeps the Phase 1 queue order after a thread receives a message', () => {
    let state = reducer(undefined, addConversation({ ...conversation, lastActivityAt: 10 }));
    state = reducer(state, addConversation({ ...conversation, id: 900001, lastActivityAt: 400 }));
    expect(
      getFilteredConversations(asState(state), defaultFilterState).map(item => item.id),
    ).toEqual([900001, conversation.id]);

    state = reducer(state, receiveMessageCreated(incoming()));

    // lastActivityAt DESC still decides, with no help from stored entity order.
    expect(
      getFilteredConversations(asState(state), defaultFilterState).map(item => item.id),
    ).toEqual([conversation.id, 900001]);
  });

  it('breaks an exact timestamp tie by id DESC, as Phase 1 requires', () => {
    let state = reducer(undefined, addConversation({ ...conversation, lastActivityAt: 500 }));
    state = reducer(state, addConversation({ ...conversation, id: 900001, lastActivityAt: 500 }));

    expect(
      getFilteredConversations(asState(state), defaultFilterState).map(item => item.id),
    ).toEqual([900001, conversation.id]);
  });
});
