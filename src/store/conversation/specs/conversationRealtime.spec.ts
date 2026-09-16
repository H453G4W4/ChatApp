import type { Message } from '@/types';
import type { RootState } from '@/store';
import { getLastMessage } from '@/utils/conversationUtils';
import { getFilteredConversations } from '../conversationSelectors';
import { defaultFilterState } from '../conversationFilterSlice';
import reducer, {
  addConversation,
  addOrUpdateMessage,
  clearAllConversations,
  hydrateConversationMessages,
  receiveMessageCreated,
  updateConversation,
} from '../conversationSlice';
import { conversation } from './conversationMockData';
import { conversationActions } from '../conversationActions';

const incoming = (overrides: Partial<Message> = {}): Message => ({
  id: 20,
  accountId: 1,
  conversationId: conversation.id,
  inboxId: 1,
  createdAt: 300,
  messageType: 0,
  content: 'Latest incoming message',
  contentType: 'text',
  attachments: [],
  echoId: null,
  private: false,
  sourceId: null,
  status: 'sent',
  senderId: 1,
  lastNonActivityMessage: null,
  conversation: { lastActivityAt: 300, unreadCount: 3, assigneeId: 42 },
  ...overrides,
});

// Queue order is derived, so ordering assertions go through the real selector.
const queueIds = (conversations: ReturnType<typeof reducer>) =>
  getFilteredConversations({ conversations } as unknown as RootState, defaultFilterState).map(
    item => item.id,
  );

describe('global queue realtime reducer', () => {
  it('moves an incoming customer message to #1 and raises unread, whoever it is assigned to', () => {
    let state = reducer(
      undefined,
      addConversation({ ...conversation, id: 999, lastActivityAt: 200 }),
    );
    state = reducer(
      state,
      addConversation({
        ...conversation,
        lastActivityAt: 100,
        unreadCount: 0,
        // Assigned to a different agent than the one holding this session.
        meta: { ...conversation.meta, assignee: { ...conversation.meta.assignee, id: 42 } },
      }),
    );
    expect(queueIds(state)).toEqual([999, conversation.id]);

    state = reducer(state, receiveMessageCreated(incoming()));

    const updated = state.entities[conversation.id]!;
    expect(queueIds(state)).toEqual([conversation.id, 999]);
    expect(updated.lastActivityAt).toBe(300);
    expect(updated.unreadCount).toBe(3);
    expect(getLastMessage(updated)?.content).toBe('Latest incoming message');
    expect(updated.meta.assignee.id).toBe(42);
  });

  it('increments unread locally when the event carries no conversation summary', () => {
    let state = reducer(undefined, addConversation({ ...conversation, unreadCount: 0 }));
    state = reducer(state, receiveMessageCreated(incoming({ conversation: undefined })));
    expect(state.entities[conversation.id]!.unreadCount).toBe(1);
    expect(state.entities[conversation.id]!.lastActivityAt).toBe(300);
  });

  it('does not increment unread for the agent’s own outgoing message', () => {
    let state = reducer(undefined, addConversation({ ...conversation, unreadCount: 0 }));
    state = reducer(
      state,
      receiveMessageCreated(
        incoming({
          messageType: 1,
          content: 'Reply sent by this agent',
          conversation: undefined,
        }),
      ),
    );
    const updated = state.entities[conversation.id]!;
    expect(updated.unreadCount).toBe(0);
    expect(updated.lastActivityAt).toBe(300);
    expect(getLastMessage(updated)?.content).toBe('Reply sent by this agent');
  });

  it('keeps a private note out of the unread count while still refreshing activity', () => {
    let state = reducer(undefined, addConversation({ ...conversation, unreadCount: 0 }));
    state = reducer(
      state,
      receiveMessageCreated(
        incoming({
          messageType: 1,
          private: true,
          content: 'Internal note',
          conversation: undefined,
        }),
      ),
    );
    const updated = state.entities[conversation.id]!;
    expect(updated.unreadCount).toBe(0);
    expect(updated.lastActivityAt).toBe(300);
    expect(getLastMessage(updated)?.private).toBe(true);
  });

  it('raises activity without reordering the stored ids array', () => {
    let state = reducer(
      undefined,
      addConversation({ ...conversation, id: 999, lastActivityAt: 300 }),
    );
    state = reducer(state, addConversation(conversation));
    const storedIds = state.ids;

    state = reducer(state, receiveMessageCreated(incoming()));

    // Entity order is never mutated to express ranking; the selector derives it.
    expect(state.ids).toEqual(storedIds);
    expect(state.entities[conversation.id]!.lastActivityAt).toBe(300);
    // 999 wins the tie at 300 because id DESC is the deterministic tie-breaker.
    expect(queueIds(state)).toEqual([999, conversation.id]);
  });

  it('stores older messages without regressing preview, activity or unread count', () => {
    let state = reducer(undefined, addConversation(conversation));
    state = reducer(state, receiveMessageCreated(incoming()));
    state = reducer(
      state,
      receiveMessageCreated(
        incoming({
          id: 19,
          createdAt: 200,
          content: 'Delayed older message',
          conversation: { lastActivityAt: 200, unreadCount: 1 },
        }),
      ),
    );
    const updated = state.entities[conversation.id]!;
    expect(updated.messages).toHaveLength(2);
    expect(updated.lastActivityAt).toBe(300);
    expect(updated.unreadCount).toBe(3);
    expect(getLastMessage(updated)?.id).toBe(20);
  });

  it('does not let an older message ID in the same second replace the preview', () => {
    let state = reducer(undefined, addConversation(conversation));
    state = reducer(state, receiveMessageCreated(incoming()));
    state = reducer(
      state,
      receiveMessageCreated(
        incoming({
          id: 19,
          content: 'Earlier in the same second',
          conversation: { lastActivityAt: 300, unreadCount: 2 },
        }),
      ),
    );
    expect(getLastMessage(state.entities[conversation.id]!)?.id).toBe(20);
    expect(state.entities[conversation.id]!.unreadCount).toBe(3);
  });

  it('preserves unread count for message.updated without a conversation summary', () => {
    let state = reducer(undefined, addConversation(conversation));
    state = reducer(state, receiveMessageCreated(incoming()));
    state = reducer(
      state,
      addOrUpdateMessage(
        incoming({
          content: 'Edited preview',
          conversation: undefined,
        }),
      ),
    );
    expect(state.entities[conversation.id]!.unreadCount).toBe(3);
    expect(getLastMessage(state.entities[conversation.id]!)?.content).toBe('Edited preview');
  });

  it('does not duplicate data when the same message event is delivered twice', () => {
    let state = reducer(undefined, addConversation({ ...conversation, unreadCount: 0 }));
    state = reducer(state, receiveMessageCreated(incoming({ conversation: undefined })));
    const afterFirst = state.entities[conversation.id]!.unreadCount;

    state = reducer(state, receiveMessageCreated(incoming({ conversation: undefined })));

    const updated = state.entities[conversation.id]!;
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages.map(message => message.id)).toEqual([20]);
    expect(afterFirst).toBe(1);
    expect(updated.unreadCount).toBe(1);
    expect(updated.lastActivityAt).toBe(300);
  });

  it('deduplicates incoming events and preserves a subsequent read', () => {
    let state = reducer(undefined, addConversation(conversation));
    state = reducer(state, receiveMessageCreated(incoming()));
    state = reducer(
      state,
      conversationActions.markMessageRead.fulfilled(
        {
          conversationId: conversation.id,
          unreadCount: 0,
          agentLastSeenAt: 400,
        },
        'read',
        { conversationId: conversation.id },
      ),
    );
    state = reducer(state, receiveMessageCreated(incoming()));
    expect(state.entities[conversation.id]!.messages).toHaveLength(1);
    expect(state.entities[conversation.id]!.unreadCount).toBe(0);
  });

  it.each(['list', 'show', 'event'])(
    'preserves realtime summary when stale %s data arrives',
    source => {
      let state = reducer(undefined, addConversation(conversation));
      state = reducer(state, receiveMessageCreated(incoming()));
      const stale = { ...conversation, lastActivityAt: 200, unreadCount: 1 };
      const action =
        source === 'list'
          ? conversationActions.fetchConversations.fulfilled(
              {
                conversations: [stale],
                meta: { mineCount: 0, allCount: 1, unassignedCount: 0 },
              },
              'list',
              { page: 1, status: 'all', assigneeType: 'all', sortBy: 'last_activity_at_desc' },
            )
          : source === 'show'
            ? conversationActions.fetchConversation.fulfilled(
                { conversation: stale },
                'show',
                conversation.id,
              )
            : updateConversation(stale);
      state = reducer(state, action);
      expect(state.entities[conversation.id]!.lastActivityAt).toBe(300);
      expect(state.entities[conversation.id]!.unreadCount).toBe(3);
      expect(getLastMessage(state.entities[conversation.id]!)?.id).toBe(20);
    },
  );

  it('does not replace newer locally loaded data when hydration completes', () => {
    let state = reducer(undefined, addConversation(conversation));
    state = reducer(state, receiveMessageCreated(incoming()));
    state = reducer(
      state,
      hydrateConversationMessages({
        conversation: { ...conversation, lastActivityAt: 100 },
        messages: [
          incoming({
            id: 18,
            createdAt: 100,
            conversation: { unreadCount: 1, lastActivityAt: 100 },
          }),
        ],
      }),
    );
    expect(getLastMessage(state.entities[conversation.id]!)?.id).toBe(20);
    expect(state.entities[conversation.id]!.lastActivityAt).toBe(300);
    expect(state.entities[conversation.id]!.unreadCount).toBe(3);
  });

  it('selects the newest preview even if search history is stored newest first', () => {
    const newest = incoming();
    const older = incoming({ id: 18, createdAt: 100 });
    expect(getLastMessage({ ...conversation, messages: [newest, older] })).toEqual(newest);
  });

  it('ignores old list responses after a newer request or queue reset', () => {
    const params = {
      page: 1,
      status: 'all',
      assigneeType: 'all',
      sortBy: 'last_activity_at_desc',
    } as const;
    const payload = {
      conversations: [conversation],
      meta: { mineCount: 0, allCount: 1, unassignedCount: 0 },
    };
    let state = reducer(undefined, conversationActions.fetchConversations.pending('old', params));
    state = reducer(state, conversationActions.fetchConversations.pending('new', params));
    state = reducer(
      state,
      conversationActions.fetchConversations.fulfilled(payload, 'old', params),
    );
    expect(state.ids).toEqual([]);
    expect(state.isLoadingConversations).toBe(true);
    state = reducer(
      state,
      conversationActions.fetchConversations.fulfilled(payload, 'new', params),
    );
    expect(state.ids).toEqual([conversation.id]);
    state = reducer(state, clearAllConversations());
    state = reducer(
      state,
      conversationActions.fetchConversations.fulfilled(payload, 'new', params),
    );
    expect(state.ids).toEqual([]);
    expect(state.isLoadingConversations).toBe(false);
    expect(state.isAllConversationsFetched).toBe(false);
  });

  it('does not let a stale request rejection clear a newer request loading state', () => {
    const params = {
      page: 1,
      status: 'all',
      assigneeType: 'all',
      sortBy: 'last_activity_at_desc',
    } as const;
    let state = reducer(undefined, conversationActions.fetchConversations.pending('old', params));
    state = reducer(state, conversationActions.fetchConversations.pending('new', params));
    state = reducer(
      state,
      conversationActions.fetchConversations.rejected(new Error('old failure'), 'old', params),
    );
    expect(state.isLoadingConversations).toBe(true);
  });
});
